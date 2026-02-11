// window_filter.cpp -- Per-window color filter via Magnifier control overlay
//
// Performance notes:
//   - Position tracking is primarily event-driven via SetWinEventHook.
//   - A light heartbeat timer is used as a fallback to refresh capture.
//   - Avoid synchronous UpdateWindow calls that can stall app rendering.

#ifdef _WIN32

#include "window_filter.h"
#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>
#include <magnification.h>
#include <dwmapi.h>
#include <unordered_map>
#include <vector>
#include <algorithm>

#pragma comment(lib, "magnification.lib")
#pragma comment(lib, "dwmapi.lib")

#ifndef WDA_EXCLUDEFROMCAPTURE
#define WDA_EXCLUDEFROMCAPTURE 0x00000011
#endif

// -- Filter state ----------------------------------------------------------

struct FilterState {
    uint32_t    id;
    HWND        targetHwnd;
    HWND        hostHwnd;
    HWND        magHwnd;
    UINT_PTR    timerId;
    UINT        timerPeriodMs;
    HMONITOR    lastMonitor;
    MAGCOLOREFFECT effect;
    bool        visible;
    RECT        lastRect;
    uint32_t    tickCount;
    bool        resizing;
    bool        suspendedByExternalMove;
    bool        owned;      // true if overlay is owned by target (auto z-order)
};

static std::unordered_map<uint32_t, FilterState*> g_filters;
static uint32_t g_nextFilterId = 1;
static bool g_classRegistered = false;
static const wchar_t* HOST_CLASS = L"ScreenTintFilterHost";
static const uint32_t kDefaultTargetFps = 60;
static const uint32_t kMinTargetFps = 45;
static const uint32_t kMaxTargetFps = 165;
static const uint32_t kMinTimerMs = 6;
static const uint32_t kMaxTimerMs = 33;
static uint32_t g_userTargetFps = 0;                 // 0 = auto by monitor Hz

static HWINEVENTHOOK g_locationHook = NULL;
static HWINEVENTHOOK g_foregroundHook = NULL;
static HWINEVENTHOOK g_moveSizeHook = NULL;

// -- Helpers ---------------------------------------------------------------

static void SetIdentityEffect(MAGCOLOREFFECT* eff) {
    memset(eff, 0, sizeof(MAGCOLOREFFECT));
    eff->transform[0][0] = 1.0f;
    eff->transform[1][1] = 1.0f;
    eff->transform[2][2] = 1.0f;
    eff->transform[3][3] = 1.0f;
    eff->transform[4][4] = 1.0f;
}

static bool GetTargetRect(HWND target, RECT* out) {
    HRESULT hr = DwmGetWindowAttribute(target,
        DWMWA_EXTENDED_FRAME_BOUNDS, out, sizeof(RECT));
    if (SUCCEEDED(hr)) return true;
    return GetWindowRect(target, out) == TRUE;
}

static bool IsWindowCloaked(HWND hwnd) {
    BOOL cloaked = FALSE;
    DwmGetWindowAttribute(hwnd, DWMWA_CLOAKED, &cloaked, sizeof(cloaked));
    return cloaked != FALSE;
}

static uint32_t ClampTargetFps(uint32_t fps) {
    return std::max(kMinTargetFps, std::min(kMaxTargetFps, fps));
}

static uint32_t GetMonitorRefreshHz(HMONITOR monitor) {
    if (!monitor) return kDefaultTargetFps;

    MONITORINFOEXW mi = {};
    mi.cbSize = sizeof(mi);
    if (!GetMonitorInfoW(monitor, &mi)) return kDefaultTargetFps;

    DEVMODEW dm = {};
    dm.dmSize = sizeof(dm);
    if (!EnumDisplaySettingsW(mi.szDevice, ENUM_CURRENT_SETTINGS, &dm)) {
        return kDefaultTargetFps;
    }

    DWORD hz = dm.dmDisplayFrequency;
    if (hz <= 1 || hz > 1000) return kDefaultTargetFps;
    return (uint32_t)hz;
}

static uint32_t GetDesiredTargetFps(HWND target, HMONITOR monitor) {
    if (g_userTargetFps > 0) return ClampTargetFps(g_userTargetFps);
    HMONITOR mon = monitor ? monitor : MonitorFromWindow(target, MONITOR_DEFAULTTONEAREST);
    return ClampTargetFps(GetMonitorRefreshHz(mon));
}

static UINT TimerPeriodForFps(uint32_t fps) {
    uint32_t clamped = ClampTargetFps(fps);
    UINT period = (1000u + clamped - 1u) / clamped;
    return std::max((UINT)kMinTimerMs, std::min((UINT)kMaxTimerMs, period));
}

static uint32_t TicksForMs(UINT timerPeriodMs, uint32_t targetMs) {
    if (timerPeriodMs == 0) return 1;
    uint32_t ticks = (targetMs + timerPeriodMs - 1u) / timerPeriodMs;
    return std::max(1u, ticks);
}

static void RetuneFilterTimer(FilterState* fs, HMONITOR monitor = NULL) {
    if (!fs || !IsWindow(fs->hostHwnd)) return;
    HMONITOR mon = monitor ? monitor : MonitorFromWindow(fs->targetHwnd, MONITOR_DEFAULTTONEAREST);
    fs->lastMonitor = mon;
    UINT periodMs = TimerPeriodForFps(GetDesiredTargetFps(fs->targetHwnd, mon));
    if (periodMs == fs->timerPeriodMs && fs->timerId != 0) return;

    if (fs->timerId != 0) {
        KillTimer(fs->hostHwnd, fs->timerId);
    }
    fs->timerId = SetTimer(fs->hostHwnd, (UINT_PTR)fs->id, periodMs, NULL);
    fs->timerPeriodMs = periodMs;
    fs->tickCount = 0;
}

static bool IsTargetForegroundProcess(HWND target) {
    HWND fg = GetForegroundWindow();
    if (!fg || !target) return false;
    if (fg == target) return true;

    DWORD targetPid = 0, fgPid = 0;
    GetWindowThreadProcessId(target, &targetPid);
    GetWindowThreadProcessId(fg, &fgPid);
    return targetPid != 0 && targetPid == fgPid;
}

static void HideFilterOverlay(FilterState* fs) {
    if (fs->visible && IsWindow(fs->hostHwnd)) {
        ShowWindow(fs->hostHwnd, SW_HIDE);
        fs->visible = false;
    }
}

static void ForceImmediateRefresh(FilterState* fs) {
    if (!fs->visible || !IsWindow(fs->magHwnd)) return;
    MagSetWindowSource(fs->magHwnd, fs->lastRect);
    InvalidateRect(fs->magHwnd, NULL, FALSE);
    RedrawWindow(fs->magHwnd, NULL, NULL,
        RDW_INVALIDATE | RDW_UPDATENOW | RDW_ALLCHILDREN);
}

static void EnsureOverlayZOrder(FilterState* fs) {
    if (fs->owned || fs->resizing || fs->suspendedByExternalMove || !fs->visible) return;
    if (!IsWindow(fs->hostHwnd) || !IsWindow(fs->targetHwnd)) return;

    HWND above = GetWindow(fs->targetHwnd, GW_HWNDPREV);
    if (above == fs->hostHwnd) return;

    UINT flags = SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_NOCOPYBITS;
    if (above) {
        SetWindowPos(fs->hostHwnd, above, 0, 0, 0, 0, flags);
    } else {
        SetWindowPos(fs->hostHwnd, HWND_TOP, 0, 0, 0, 0, flags);
    }
}

// -- Core position update --------------------------------------------------

static void UpdateFilterPosition(FilterState* fs, bool forceSourceRefresh = false) {
    // Safety: if host was auto-destroyed (owned window cleanup), bail out
    if (!IsWindow(fs->hostHwnd)) return;

    // During move/resize we intentionally suspend overlay updates to avoid drag lag.
    if (fs->resizing || fs->suspendedByExternalMove) return;

    if (!IsWindow(fs->targetHwnd)) {
        HideFilterOverlay(fs);
        return;
    }

    if (IsIconic(fs->targetHwnd) || IsWindowCloaked(fs->targetHwnd) ||
        !IsWindowVisible(fs->targetHwnd)) {
        HideFilterOverlay(fs);
        return;
    }

    HMONITOR currentMonitor = MonitorFromWindow(fs->targetHwnd, MONITOR_DEFAULTTONEAREST);
    if (currentMonitor != fs->lastMonitor) {
        RetuneFilterTimer(fs, currentMonitor);
    }

    RECT r;
    if (!GetTargetRect(fs->targetHwnd, &r)) return;

    int w = r.right - r.left;
    int h = r.bottom - r.top;
    if (w <= 0 || h <= 0) return;

    bool rectChanged = (r.left != fs->lastRect.left || r.top != fs->lastRect.top ||
        r.right != fs->lastRect.right || r.bottom != fs->lastRect.bottom);

    if (fs->owned) {
        // Owned window: Windows keeps us above owner automatically
        if (rectChanged) {
            fs->lastRect = r;
            SetWindowPos(fs->hostHwnd, NULL, r.left, r.top, w, h,
                SWP_NOACTIVATE | SWP_NOCOPYBITS | SWP_NOZORDER);
            SetWindowPos(fs->magHwnd, NULL, 0, 0, w, h,
                SWP_NOZORDER | SWP_NOACTIVATE | SWP_NOCOPYBITS);
            MagSetWindowSource(fs->magHwnd, r);
        }
    } else {
        // Unowned fallback: manually manage z-order
        HWND above = GetWindow(fs->targetHwnd, GW_HWNDPREV);
        bool zOrderCorrect = (above == fs->hostHwnd);

        if (rectChanged || !zOrderCorrect) {
            fs->lastRect = r;
            UINT flags = SWP_NOACTIVATE | SWP_NOCOPYBITS;

            if (zOrderCorrect) {
                SetWindowPos(fs->hostHwnd, NULL, r.left, r.top, w, h,
                    flags | SWP_NOZORDER);
            } else if (above) {
                SetWindowPos(fs->hostHwnd, above, r.left, r.top, w, h, flags);
            } else {
                SetWindowPos(fs->hostHwnd, HWND_TOP, r.left, r.top, w, h, flags);
            }

            SetWindowPos(fs->magHwnd, NULL, 0, 0, w, h,
                SWP_NOZORDER | SWP_NOACTIVATE | SWP_NOCOPYBITS);
            MagSetWindowSource(fs->magHwnd, r);
        }
    }

    if (!fs->visible && !fs->resizing) {
        ShowWindow(fs->hostHwnd, SW_SHOWNOACTIVATE);
        fs->visible = true;
        forceSourceRefresh = true;
    }

    // Keep repaints asynchronous to avoid blocking UI threads.
    if (!fs->resizing && (forceSourceRefresh || rectChanged)) {
        InvalidateRect(fs->magHwnd, NULL, FALSE);
    }
}

// -- WinEvent hooks --------------------------------------------------------

static void CALLBACK LocationEventProc(HWINEVENTHOOK hook, DWORD event,
    HWND hwnd, LONG idObject, LONG idChild,
    DWORD dwEventThread, DWORD dwmsEventTime)
{
    if (idObject != 0 || idChild != 0) return;

    for (auto& pair : g_filters) {
        FilterState* fs = pair.second;
        if (fs->suspendedByExternalMove) continue;
        if (fs->targetHwnd == hwnd) {
            if (!fs->resizing) {
                UpdateFilterPosition(fs, true);
            }
        } else {
            // Keep non-target overlays under moving windows to prevent trails.
            EnsureOverlayZOrder(fs);
        }
    }
}

static void CALLBACK ForegroundEventProc(HWINEVENTHOOK hook, DWORD event,
    HWND hwnd, LONG idObject, LONG idChild,
    DWORD dwEventThread, DWORD dwmsEventTime)
{
    for (auto& pair : g_filters) {
        FilterState* fs = pair.second;
        if (fs->suspendedByExternalMove) continue;
        if (!fs->resizing) {
            UpdateFilterPosition(fs, true);
            EnsureOverlayZOrder(fs);
        }
    }
}

static void CALLBACK MoveSizeEventProc(HWINEVENTHOOK hook, DWORD event,
    HWND hwnd, LONG idObject, LONG idChild,
    DWORD dwEventThread, DWORD dwmsEventTime)
{
    if (event == EVENT_SYSTEM_MOVESIZESTART) {
        // Suspend all overlays while any top-level window is moving/resizing.
        for (auto& pair : g_filters) {
            FilterState* fs = pair.second;
            if (fs->targetHwnd == hwnd) {
                fs->resizing = true;
            } else {
                fs->suspendedByExternalMove = true;
            }
            HideFilterOverlay(fs);
        }
        return;
    }

    if (event == EVENT_SYSTEM_MOVESIZEEND) {
        for (auto& pair : g_filters) {
            FilterState* fs = pair.second;
            if (fs->targetHwnd == hwnd) {
                fs->resizing = false;
            }
            fs->suspendedByExternalMove = false;
            UpdateFilterPosition(fs, true);
            ForceImmediateRefresh(fs);
        }
    }
}

static void InstallEventHooks() {
    if (!g_locationHook) {
        g_locationHook = SetWinEventHook(
            EVENT_OBJECT_LOCATIONCHANGE, EVENT_OBJECT_LOCATIONCHANGE,
            NULL, LocationEventProc, 0, 0, WINEVENT_OUTOFCONTEXT);
    }
    if (!g_foregroundHook) {
        g_foregroundHook = SetWinEventHook(
            EVENT_SYSTEM_FOREGROUND, EVENT_SYSTEM_FOREGROUND,
            NULL, ForegroundEventProc, 0, 0, WINEVENT_OUTOFCONTEXT);
    }
    if (!g_moveSizeHook) {
        g_moveSizeHook = SetWinEventHook(
            EVENT_SYSTEM_MOVESIZESTART, EVENT_SYSTEM_MOVESIZEEND,
            NULL, MoveSizeEventProc, 0, 0, WINEVENT_OUTOFCONTEXT);
    }
}

static void UninstallEventHooks() {
    if (g_locationHook)   { UnhookWinEvent(g_locationHook);   g_locationHook = NULL; }
    if (g_foregroundHook) { UnhookWinEvent(g_foregroundHook); g_foregroundHook = NULL; }
    if (g_moveSizeHook)   { UnhookWinEvent(g_moveSizeHook);   g_moveSizeHook = NULL; }
}

// -- Window class ----------------------------------------------------------

static LRESULT CALLBACK HostWndProc(HWND hwnd, UINT msg,
                                     WPARAM wParam, LPARAM lParam) {
    if (msg == WM_TIMER) {
        uint32_t filterId = static_cast<uint32_t>(wParam);
        auto it = g_filters.find(filterId);
        if (it == g_filters.end()) return 0;

        FilterState* fs = it->second;
        fs->tickCount++;

        if (fs->suspendedByExternalMove) return 0;

        uint32_t positionPollTicks = TicksForMs(fs->timerPeriodMs, 64);
        if (fs->tickCount % positionPollTicks == 0) {
            UpdateFilterPosition(fs, false);
        }

        EnsureOverlayZOrder(fs);

        if (fs->visible && !fs->resizing) {
            uint32_t refreshTicks = IsTargetForegroundProcess(fs->targetHwnd)
                ? 1
                : TicksForMs(fs->timerPeriodMs, 32);
            if (fs->tickCount % refreshTicks != 0) return 0;
            InvalidateRect(fs->magHwnd, NULL, FALSE);
        }
        return 0;
    }
    return DefWindowProc(hwnd, msg, wParam, lParam);
}

static bool EnsureHostClass() {
    if (g_classRegistered) return true;
    WNDCLASSEXW wc = {};
    wc.cbSize = sizeof(wc);
    wc.lpfnWndProc = HostWndProc;
    wc.hInstance = GetModuleHandle(NULL);
    wc.lpszClassName = HOST_CLASS;
    wc.hCursor = LoadCursor(NULL, IDC_ARROW);
    if (!RegisterClassExW(&wc)) return false;
    g_classRegistered = true;
    return true;
}

// -- N-API functions -------------------------------------------------------

Napi::Value CreateWindowFilter(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsNumber())
        return Napi::Number::New(env, 0);

    HWND target = (HWND)(uintptr_t)info[0].As<Napi::Number>().Int64Value();
    if (!IsWindow(target))
        return Napi::Number::New(env, 0);

    if (!EnsureHostClass())
        return Napi::Number::New(env, 0);

    RECT r;
    if (!GetTargetRect(target, &r))
        return Napi::Number::New(env, 0);

    int w = r.right - r.left;
    int h = r.bottom - r.top;
    if (w <= 0 || h <= 0)
        return Napi::Number::New(env, 0);

    DWORD exStyle = WS_EX_LAYERED | WS_EX_TRANSPARENT |
        WS_EX_NOACTIVATE | WS_EX_TOOLWINDOW;

    // Try creating as OWNED window of target (auto z-order, no click flash)
    bool owned = false;
    HWND host = CreateWindowExW(exStyle, HOST_CLASS, L"ScreenTintOverlay",
        WS_POPUP, r.left, r.top, w, h,
        target, NULL, GetModuleHandle(NULL), NULL);

    if (host) {
        owned = true;
    } else {
        // Cross-process ownership failed; fall back to unowned
        host = CreateWindowExW(exStyle, HOST_CLASS, L"ScreenTintOverlay",
            WS_POPUP, r.left, r.top, w, h,
            NULL, NULL, GetModuleHandle(NULL), NULL);
    }

    if (!host) return Napi::Number::New(env, 0);

    // Exclude overlay from screen capture (Win10 2004+)
    SetWindowDisplayAffinity(host, WDA_EXCLUDEFROMCAPTURE);

    // Disable DWM transitions
    BOOL disableTransitions = TRUE;
    DwmSetWindowAttribute(host, DWMWA_TRANSITIONS_FORCEDISABLED,
        &disableTransitions, sizeof(disableTransitions));

    SetLayeredWindowAttributes(host, 0, 255, LWA_ALPHA);

    // No MS_SHOWMAGNIFIEDCURSOR -- cursor stays normal
    HWND mag = CreateWindowW(WC_MAGNIFIER, L"MagChild",
        WS_CHILD | WS_VISIBLE,
        0, 0, w, h,
        host, NULL, GetModuleHandle(NULL), NULL);
    if (!mag) {
        DestroyWindow(host);
        return Napi::Number::New(env, 0);
    }

    MagSetWindowSource(mag, r);

    // INCLUDE filter: magnifier captures ONLY the target window
    MagSetWindowFilterList(mag, MW_FILTERMODE_INCLUDE, 1, &target);

    MAGTRANSFORM xform = {};
    xform.v[0][0] = 1.0f;
    xform.v[1][1] = 1.0f;
    xform.v[2][2] = 1.0f;
    MagSetWindowTransform(mag, &xform);

    MAGCOLOREFFECT effect;
    SetIdentityEffect(&effect);
    MagSetColorEffect(mag, &effect);

    FilterState* fs = new FilterState();
    fs->id = g_nextFilterId++;
    fs->targetHwnd = target;
    fs->hostHwnd = host;
    fs->magHwnd = mag;
    fs->timerId = 0;
    fs->timerPeriodMs = 0;
    fs->lastMonitor = MonitorFromWindow(target, MONITOR_DEFAULTTONEAREST);
    fs->effect = effect;
    fs->visible = true;
    fs->lastRect = r;
    fs->tickCount = 0;
    fs->resizing = false;
    fs->suspendedByExternalMove = false;
    fs->owned = owned;

    if (!owned) {
        // Unowned: position just above target in z-order
        HWND above = GetWindow(target, GW_HWNDPREV);
        if (above) {
            SetWindowPos(host, above, r.left, r.top, w, h,
                SWP_NOACTIVATE | SWP_NOCOPYBITS);
        } else {
            SetWindowPos(host, HWND_TOP, r.left, r.top, w, h,
                SWP_NOACTIVATE | SWP_NOCOPYBITS);
        }
    }

    RetuneFilterTimer(fs, fs->lastMonitor);

    g_filters[fs->id] = fs;

    InstallEventHooks();
    ShowWindow(host, SW_SHOWNOACTIVATE);

    return Napi::Number::New(env, (double)fs->id);
}

Napi::Value SetFilterMatrix(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (info.Length() < 2 || !info[0].IsNumber() || !info[1].IsArray())
        return Napi::Boolean::New(env, false);

    uint32_t id = info[0].As<Napi::Number>().Uint32Value();
    Napi::Array arr = info[1].As<Napi::Array>();
    if (arr.Length() != 25) return Napi::Boolean::New(env, false);

    auto it = g_filters.find(id);
    if (it == g_filters.end()) return Napi::Boolean::New(env, false);

    FilterState* fs = it->second;
    for (uint32_t i = 0; i < 25; i++) {
        fs->effect.transform[i / 5][i % 5] =
            (float)arr.Get(i).As<Napi::Number>().DoubleValue();
    }
    return Napi::Boolean::New(env, MagSetColorEffect(fs->magHwnd, &fs->effect) == TRUE);
}

Napi::Value ResetFilterMatrix(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (info.Length() < 1 || !info[0].IsNumber())
        return Napi::Boolean::New(env, false);

    uint32_t id = info[0].As<Napi::Number>().Uint32Value();
    auto it = g_filters.find(id);
    if (it == g_filters.end()) return Napi::Boolean::New(env, false);

    FilterState* fs = it->second;
    SetIdentityEffect(&fs->effect);
    return Napi::Boolean::New(env, MagSetColorEffect(fs->magHwnd, &fs->effect) == TRUE);
}

static void DestroyFilter(FilterState* fs) {
    if (fs->timerId != 0) {
        KillTimer(fs->hostHwnd, fs->timerId);
    }
    if (IsWindow(fs->hostHwnd)) DestroyWindow(fs->hostHwnd);
    delete fs;
}

Napi::Value DestroyWindowFilter(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (info.Length() < 1 || !info[0].IsNumber())
        return Napi::Boolean::New(env, false);

    uint32_t id = info[0].As<Napi::Number>().Uint32Value();
    auto it = g_filters.find(id);
    if (it == g_filters.end()) return Napi::Boolean::New(env, false);

    DestroyFilter(it->second);
    g_filters.erase(it);
    if (g_filters.empty()) UninstallEventHooks();
    return Napi::Boolean::New(env, true);
}

Napi::Value DestroyAllFilters(const Napi::CallbackInfo& info) {
    for (auto& pair : g_filters) {
        DestroyFilter(pair.second);
    }
    g_filters.clear();
    UninstallEventHooks();
    return Napi::Boolean::New(info.Env(), true);
}

Napi::Value ListFilters(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    Napi::Array result = Napi::Array::New(env, g_filters.size());
    uint32_t idx = 0;
    for (auto& pair : g_filters) {
        FilterState* fs = pair.second;
        Napi::Object obj = Napi::Object::New(env);
        obj.Set("id", Napi::Number::New(env, (double)fs->id));
        obj.Set("targetHwnd", Napi::Number::New(env, (double)(uintptr_t)fs->targetHwnd));
        obj.Set("visible", Napi::Boolean::New(env, fs->visible));
        result.Set(idx++, obj);
    }
    return result;
}

Napi::Value SetPerWindowTargetFps(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (info.Length() < 1 || !info[0].IsNumber()) {
        return Napi::Number::New(env, (double)g_userTargetFps);
    }

    int32_t requested = info[0].As<Napi::Number>().Int32Value();
    g_userTargetFps = requested <= 0 ? 0 : ClampTargetFps((uint32_t)requested);

    for (auto& pair : g_filters) {
        RetuneFilterTimer(pair.second);
    }

    return Napi::Number::New(env, (double)g_userTargetFps);
}

Napi::Value GetPerWindowTargetFps(const Napi::CallbackInfo& info) {
    return Napi::Number::New(info.Env(), (double)g_userTargetFps);
}

#else
// -- Non-Windows stubs -----------------------------------------------------
#include "window_filter.h"

Napi::Value CreateWindowFilter(const Napi::CallbackInfo& i) { return Napi::Number::New(i.Env(), 0); }
Napi::Value SetFilterMatrix(const Napi::CallbackInfo& i) { return Napi::Boolean::New(i.Env(), false); }
Napi::Value ResetFilterMatrix(const Napi::CallbackInfo& i) { return Napi::Boolean::New(i.Env(), false); }
Napi::Value DestroyWindowFilter(const Napi::CallbackInfo& i) { return Napi::Boolean::New(i.Env(), false); }
Napi::Value DestroyAllFilters(const Napi::CallbackInfo& i) { return Napi::Boolean::New(i.Env(), true); }
Napi::Value ListFilters(const Napi::CallbackInfo& i) { return Napi::Array::New(i.Env()); }
Napi::Value SetPerWindowTargetFps(const Napi::CallbackInfo& i) { return Napi::Number::New(i.Env(), 0); }
Napi::Value GetPerWindowTargetFps(const Napi::CallbackInfo& i) { return Napi::Number::New(i.Env(), 0); }
#endif
