// module.cpp -- Windows Magnification API native addon
//
// Uses MagSetFullscreenColorEffect (the ONLY reliable zero-lag API).
// Per-window mode is faked by toggling the effect on/off based on
// which window is in the foreground -- tracked from JS via polling.
//
// Build: npx electron-rebuild -f -w screentint_native

#include <napi.h>

#ifdef _WIN32
#include <windows.h>
#include <magnification.h>
#include <vector>
#include <string>

#pragma comment(lib, "magnification.lib")

static bool g_initialized = false;

// ---- Init / Shutdown ------------------------------------------------

Napi::Value Init(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (g_initialized) return Napi::Boolean::New(env, true);
  g_initialized = (MagInitialize() == TRUE);
  return Napi::Boolean::New(env, g_initialized);
}

Napi::Value Shutdown(const Napi::CallbackInfo& info) {
  if (g_initialized) {
    // Reset to identity before shutdown
    MAGCOLOREFFECT id = {};
    id.transform[0][0] = id.transform[1][1] = id.transform[2][2] =
    id.transform[3][3] = id.transform[4][4] = 1.0f;
    MagSetFullscreenColorEffect(&id);
    MagUninitialize();
    g_initialized = false;
  }
  return Napi::Boolean::New(info.Env(), true);
}

Napi::Value IsAvailable(const Napi::CallbackInfo& info) {
  return Napi::Boolean::New(info.Env(), true);
}

// ---- Full-screen color effect ---------------------------------------

Napi::Value ApplyMatrix(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (!g_initialized) return Napi::Boolean::New(env, false);
  if (info.Length() < 1 || !info[0].IsArray()) return Napi::Boolean::New(env, false);

  Napi::Array arr = info[0].As<Napi::Array>();
  if (arr.Length() != 25) return Napi::Boolean::New(env, false);

  MAGCOLOREFFECT effect;
  for (uint32_t i = 0; i < 25; i++) {
    effect.transform[i / 5][i % 5] =
      (float)arr.Get(i).As<Napi::Number>().DoubleValue();
  }
  return Napi::Boolean::New(env, MagSetFullscreenColorEffect(&effect) == TRUE);
}

Napi::Value ResetMatrix(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (!g_initialized) return Napi::Boolean::New(env, false);

  MAGCOLOREFFECT id = {};
  id.transform[0][0] = id.transform[1][1] = id.transform[2][2] =
  id.transform[3][3] = id.transform[4][4] = 1.0f;
  return Napi::Boolean::New(env, MagSetFullscreenColorEffect(&id) == TRUE);
}

// ---- Window enumeration ---------------------------------------------

struct WinInfo { uintptr_t hwnd; std::string title; };

static BOOL CALLBACK EnumWinProc(HWND hwnd, LPARAM lParam) {
  if (!IsWindowVisible(hwnd)) return TRUE;

  TCHAR title[256];
  int len = GetWindowText(hwnd, title, 256);
  if (len == 0) return TRUE;

  // Skip tiny/tool windows
  RECT r;
  GetWindowRect(hwnd, &r);
  if ((r.right - r.left) < 100 || (r.bottom - r.top) < 50) return TRUE;

  // Skip cloaked windows (UWP background, etc.)
  // DwmGetWindowAttribute DWMWA_CLOAKED = 14
  // Skipping for simplicity -- EnumWindows already filters most

  int utf8Len = WideCharToMultiByte(CP_UTF8, 0, title, len, NULL, 0, NULL, NULL);
  std::string utf8(utf8Len, 0);
  WideCharToMultiByte(CP_UTF8, 0, title, len, &utf8[0], utf8Len, NULL, NULL);

  auto* vec = reinterpret_cast<std::vector<WinInfo>*>(lParam);
  vec->push_back({ (uintptr_t)hwnd, utf8 });
  return TRUE;
}

Napi::Value EnumVisibleWindows(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  std::vector<WinInfo> wins;
  ::EnumWindows(EnumWinProc, (LPARAM)&wins);

  Napi::Array result = Napi::Array::New(env, wins.size());
  for (uint32_t i = 0; i < wins.size(); i++) {
    Napi::Object obj = Napi::Object::New(env);
    obj.Set("hwnd", Napi::Number::New(env, (double)wins[i].hwnd));
    obj.Set("title", Napi::String::New(env, wins[i].title));
    result.Set(i, obj);
  }
  return result;
}

// ---- Foreground window tracking -------------------------------------

Napi::Value GetForegroundHwnd(const Napi::CallbackInfo& info) {
  HWND fg = ::GetForegroundWindow();
  return Napi::Number::New(info.Env(), (double)(uintptr_t)fg);
}

// Check if a specific hwnd is the foreground or one of its children is
Napi::Value IsForeground(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 1 || !info[0].IsNumber()) return Napi::Boolean::New(env, false);

  HWND target = (HWND)(uintptr_t)info[0].As<Napi::Number>().Int64Value();
  HWND fg = ::GetForegroundWindow();

  if (fg == target) return Napi::Boolean::New(env, true);

  // Check if foreground is a child/owned window of the target process
  DWORD targetPid = 0, fgPid = 0;
  GetWindowThreadProcessId(target, &targetPid);
  GetWindowThreadProcessId(fg, &fgPid);

  return Napi::Boolean::New(env, targetPid == fgPid && targetPid != 0);
}

#else
// ---- Non-Windows stubs ----------------------------------------------
Napi::Value Init(const Napi::CallbackInfo& i) { return Napi::Boolean::New(i.Env(), false); }
Napi::Value Shutdown(const Napi::CallbackInfo& i) { return Napi::Boolean::New(i.Env(), true); }
Napi::Value IsAvailable(const Napi::CallbackInfo& i) { return Napi::Boolean::New(i.Env(), false); }
Napi::Value ApplyMatrix(const Napi::CallbackInfo& i) { return Napi::Boolean::New(i.Env(), false); }
Napi::Value ResetMatrix(const Napi::CallbackInfo& i) { return Napi::Boolean::New(i.Env(), false); }
Napi::Value EnumVisibleWindows(const Napi::CallbackInfo& i) { return Napi::Array::New(i.Env()); }
Napi::Value GetForegroundHwnd(const Napi::CallbackInfo& i) { return Napi::Number::New(i.Env(), 0); }
Napi::Value IsForeground(const Napi::CallbackInfo& i) { return Napi::Boolean::New(i.Env(), false); }
#endif

// ---- Module ---------------------------------------------------------

Napi::Object InitModule(Napi::Env env, Napi::Object exports) {
  exports.Set("init",               Napi::Function::New(env, Init));
  exports.Set("shutdown",           Napi::Function::New(env, Shutdown));
  exports.Set("isAvailable",        Napi::Function::New(env, IsAvailable));
  exports.Set("applyMatrix",        Napi::Function::New(env, ApplyMatrix));
  exports.Set("resetMatrix",        Napi::Function::New(env, ResetMatrix));
  exports.Set("enumVisibleWindows", Napi::Function::New(env, EnumVisibleWindows));
  exports.Set("getForegroundHwnd",  Napi::Function::New(env, GetForegroundHwnd));
  exports.Set("isForeground",       Napi::Function::New(env, IsForeground));
  return exports;
}

NODE_API_MODULE(screentint_native, InitModule)
