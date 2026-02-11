const { PALETTES, applyIntensity, getPaletteById, buildCustomPaletteMatrix } = require('./palettes/index');
const { transposeMatrix, IDENTITY } = require('./matrix-ops');
const { TransitionEngine, Easings } = require('./transition-engine');
const fs = require('fs');
const path = require('path');

// ── Load native addon ───────────────────────────────────────────
let native = null;
let nativeReady = false;

const addonCandidates = [
  path.join(process.resourcesPath || '', 'native', 'screentint_native.node'),
  path.join(process.resourcesPath || '', 'app.asar.unpacked', 'build', 'Release', 'screentint_native.node'),
  path.join(__dirname, '../../build/Release/screentint_native.node'),
  path.join(__dirname, '../../build/Release/screentint_native'),
];

for (const candidate of addonCandidates) {
  try {
    if (!candidate || !fs.existsSync(candidate)) continue;
    native = require(candidate);
    console.log('[Vision] Loaded native addon from:', candidate);
    break;
  } catch (e) {
    console.warn('[Vision] Failed loading native addon from', candidate, '-', e.message);
  }
}

if (native && native.isAvailable && native.isAvailable()) {
  try {
    nativeReady = native.init();
    if (nativeReady) console.log('[Vision] Native Magnification API ready');
  } catch (e) {
    console.warn('[Vision] Native init failed:', e.message);
  }
}
if (!nativeReady) console.log('[Vision] Native not available');

// ── State ───────────────────────────────────────────────────────
const transition = new TransitionEngine();
let currentMatrix = [...IDENTITY];
let mode = 'none';            // 'none' | 'fullscreen' | 'app'
let effectApplied = false;

// Multi-filter state: filterId -> { hwnd, paletteId, intensity, processName, title }
const perWindowFilters = new Map();

function findFilterEntryByHwnd(hwnd) {
  for (const [filterId, filter] of perWindowFilters) {
    if (filter.hwnd === hwnd) return { filterId, filter };
  }
  return null;
}

function removeDuplicateFiltersForHwnd(hwnd, keepFilterId = null) {
  for (const [filterId, filter] of [...perWindowFilters.entries()]) {
    if (filter.hwnd !== hwnd || filterId === keepFilterId) continue;
    native.destroyWindowFilter(filterId);
    perWindowFilters.delete(filterId);
  }
}

function setPerAppTargetFps(fps = 0) {
  if (!nativeReady || !native.setPerWindowTargetFps) return 0;
  const requested = Number.isFinite(fps) ? Math.round(fps) : 0;
  return native.setPerWindowTargetFps(requested);
}

function getPerAppTargetFps() {
  if (!nativeReady || !native.getPerWindowTargetFps) return 0;
  return native.getPerWindowTargetFps();
}

// ── GPU control (fullscreen only) ───────────────────────────────
function gpuApply(matrix) {
  if (!nativeReady) return;
  native.applyMatrix(transposeMatrix(matrix));
  effectApplied = true;
}

function gpuReset() {
  if (!nativeReady) return;
  native.resetMatrix();
  effectApplied = false;
}

function pushMatrix(matrix) {
  currentMatrix = [...matrix];
  if (mode === 'fullscreen') {
    gpuApply(matrix);
  }
}

function resolvePaletteMatrix(paletteId, intensity = 1.0, customRgb = null) {
  if (paletteId === 'custom') {
    const custom = buildCustomPaletteMatrix(customRgb || {});
    return applyIntensity(custom, intensity);
  }
  const p = getPaletteById(paletteId);
  if (!p) return null;
  return applyIntensity(p.matrix, intensity);
}

// ═════════════════════════════════════════════════════════════════
// PUBLIC API — Fullscreen mode
// ═════════════════════════════════════════════════════════════════

function activateFullscreen() {
  // Clear any per-window filters first
  destroyAllPerWindowFilters();
  mode = 'fullscreen';
  if (!isIdentity(currentMatrix)) gpuApply(currentMatrix);
  return true;
}

function transitionTo(paletteId, intensity = 1.0, durationMs = 400, customRgb = null) {
  const targetMatrix = resolvePaletteMatrix(paletteId, intensity, customRgb);
  if (!targetMatrix) return;
  transition.animate({
    from: transition.getCurrentMatrix(),
    to: targetMatrix,
    duration: durationMs,
    easing: Easings.easeInOutCubic,
    onFrame: (m) => pushMatrix(m),
  });
}

// ═════════════════════════════════════════════════════════════════
// PUBLIC API — Per-window multi-filter mode
// ═════════════════════════════════════════════════════════════════

function applyPerWindowFilter(hwnd, paletteId, intensity, processName, title, customRgb = null) {
  if (!nativeReady) return null;

  // If in fullscreen mode, reset it first
  if (mode === 'fullscreen') {
    transition.cancel();
    gpuReset();
    currentMatrix = [...IDENTITY];
  }
  mode = 'app';

  const matrix = resolvePaletteMatrix(paletteId, intensity, customRgb);
  if (!matrix) return null;
  const transposed = transposeMatrix(matrix);

  // Enforce one filter per HWND: re-apply updates the existing filter.
  const existing = findFilterEntryByHwnd(hwnd);
  if (existing) {
    const ok = native.setFilterMatrix(existing.filterId, transposed);
    if (ok) {
      existing.filter.paletteId = paletteId;
      existing.filter.intensity = intensity;
      existing.filter.processName = processName || existing.filter.processName || '';
      existing.filter.title = title || existing.filter.title || '';
      existing.filter.customRgb = customRgb ? { ...customRgb } : null;
      removeDuplicateFiltersForHwnd(hwnd, existing.filterId);
      console.log('[Vision] Per-window filter updated, id:', existing.filterId,
        'process:', existing.filter.processName, 'palette:', paletteId);
      return existing.filterId;
    }

    // Native filter may have been destroyed out-of-band; clean stale record.
    perWindowFilters.delete(existing.filterId);
  }

  const filterId = native.createWindowFilter(hwnd);
  if (filterId <= 0) return null;

  native.setFilterMatrix(filterId, transposed);
  removeDuplicateFiltersForHwnd(hwnd, filterId);

  perWindowFilters.set(filterId, {
    hwnd, paletteId, intensity,
    processName: processName || '',
    title: title || '',
    customRgb: customRgb ? { ...customRgb } : null,
  });

  console.log('[Vision] Per-window filter created, id:', filterId,
    'process:', processName, 'palette:', paletteId);
  return filterId;
}

function updatePerWindowFilter(filterId, paletteId, intensity, customRgb = null) {
  const filter = perWindowFilters.get(filterId);
  if (!filter) return false;

  const matrix = resolvePaletteMatrix(paletteId, intensity, customRgb);
  if (!matrix) return false;
  native.setFilterMatrix(filterId, transposeMatrix(matrix));

  filter.paletteId = paletteId;
  filter.intensity = intensity;
  filter.customRgb = customRgb ? { ...customRgb } : null;
  return true;
}

function removePerWindowFilter(filterId) {
  if (!perWindowFilters.has(filterId)) return false;
  native.destroyWindowFilter(filterId);
  perWindowFilters.delete(filterId);
  if (perWindowFilters.size === 0) mode = 'none';
  return true;
}

function getActiveFilters() {
  return Array.from(perWindowFilters.entries()).map(([id, f]) => ({
    filterId: id, hwnd: f.hwnd, paletteId: f.paletteId,
    intensity: f.intensity, processName: f.processName, title: f.title,
    customRgb: f.customRgb || null,
  }));
}

function destroyAllPerWindowFilters() {
  for (const [filterId] of perWindowFilters) {
    native.destroyWindowFilter(filterId);
  }
  perWindowFilters.clear();
}

// ═════════════════════════════════════════════════════════════════
// PUBLIC API — Common
// ═════════════════════════════════════════════════════════════════

function reset() {
  transition.cancel();
  destroyAllPerWindowFilters();
  gpuReset();
  currentMatrix = [...IDENTITY];
  mode = 'none';
}

const BROWSER_NAMES = {
  'msedge.exe': 'Microsoft Edge',
  'chrome.exe': 'Google Chrome',
  'firefox.exe': 'Firefox',
  'brave.exe': 'Brave',
};

function getVisibleWindows() {
  if (!nativeReady) return [];
  const raw = native.enumVisibleWindows();

  // Group browser windows by process to give clean display names
  const browserCounts = {};
  for (const w of raw) {
    const proc = (w.processName || '').toLowerCase();
    if (BROWSER_NAMES[proc]) {
      browserCounts[proc] = (browserCounts[proc] || 0) + 1;
    }
  }

  const browserSeen = {};
  return raw.map(w => {
    const proc = (w.processName || '').toLowerCase();
    const browserName = BROWSER_NAMES[proc];
    if (browserName) {
      browserSeen[proc] = (browserSeen[proc] || 0) + 1;
      const idx = browserSeen[proc];
      const total = browserCounts[proc];
      return {
        ...w,
        displayName: total > 1 ? `${browserName} (Window ${idx})` : browserName,
      };
    }
    return { ...w, displayName: w.title };
  });
}

function getPalettes() {
  return PALETTES.map(p => ({
    id: p.id, name: p.name, description: p.description,
    icon: p.icon, category: p.category, previewColors: p.previewColors,
  }));
}

function getCurrentMatrix() { return [...currentMatrix]; }
function getMode() { return mode; }
function isNativeAvailable() { return nativeReady; }

function shutdown() {
  transition.cancel();
  if (nativeReady) native.destroyAllFilters();
  perWindowFilters.clear();
  if (nativeReady) native.shutdown();
  currentMatrix = [...IDENTITY];
  mode = 'none';
}

function isIdentity(m) {
  return m.every((v, i) => {
    const row = Math.floor(i / 5), col = i % 5;
    return Math.abs(v - (row === col ? 1 : 0)) < 0.001;
  });
}

module.exports = {
  activateFullscreen, transitionTo, reset,
  applyPerWindowFilter, updatePerWindowFilter,
  removePerWindowFilter, getActiveFilters,
  setPerAppTargetFps, getPerAppTargetFps,
  getVisibleWindows, getPalettes, getCurrentMatrix,
  getMode, isNativeAvailable, shutdown,
};
