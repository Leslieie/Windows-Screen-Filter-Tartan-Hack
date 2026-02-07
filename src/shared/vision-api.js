const { PALETTES, applyIntensity, getPaletteById } = require('./palettes/index');
const { transposeMatrix, IDENTITY } = require('./matrix-ops');
const { TransitionEngine, Easings } = require('./transition-engine');

// ── Load native addon ───────────────────────────────────────────
let native = null;
let nativeReady = false;

try {
  native = require('../../build/Release/screentint_native.node');
} catch {
  try { native = require('../../build/Release/screentint_native'); } catch { native = null; }
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
let targetHwnd = null;        // for app mode
let focusPoller = null;       // interval for app mode
let effectApplied = false;    

// ── GPU control ─────────────────────────────────────────────────
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
  } else if (mode === 'app') {
    // Only apply if target is focused right now
    if (targetHwnd && nativeReady && native.isForeground(targetHwnd)) {
      gpuApply(matrix);
    }
  }
}

// ── App-mode focus polling ──────────────────────────────────────
function startFocusPoller() {
  stopFocusPoller();
  focusPoller = setInterval(() => {
    if (!targetHwnd || !nativeReady) return;

    const isFg = native.isForeground(targetHwnd);

    if (isFg && !effectApplied) {
      // Target just gained focus → apply
      gpuApply(currentMatrix);
    } else if (!isFg && effectApplied) {
      // Target lost focus → reset
      gpuReset();
    }
  }, 100); // 10 checks/sec is plenty
}

function stopFocusPoller() {
  if (focusPoller) {
    clearInterval(focusPoller);
    focusPoller = null;
  }
}

// ═════════════════════════════════════════════════════════════════
// PUBLIC API
// ═════════════════════════════════════════════════════════════════

function applyPalette(paletteId, intensity = 1.0) {
  const p = getPaletteById(paletteId);
  if (!p) return false;
  pushMatrix(applyIntensity(p.matrix, intensity));
  return true;
}

function applyRawMatrix(matrix) {
  if (!Array.isArray(matrix) || matrix.length !== 25) return false;
  pushMatrix(matrix);
  return true;
}

function transitionTo(paletteId, intensity = 1.0, durationMs = 400) {
  const p = getPaletteById(paletteId);
  if (!p) return;
  transition.animate({
    from: transition.getCurrentMatrix(),
    to: applyIntensity(p.matrix, intensity),
    duration: durationMs,
    easing: Easings.easeInOutCubic,
    onFrame: (m) => pushMatrix(m),
  });
}

// ── Mode control ────────────────────────────────────────────────

function activateFullscreen() {
  stopFocusPoller();
  mode = 'fullscreen';
  targetHwnd = null;
  // Apply current matrix immediately
  if (!isIdentity(currentMatrix)) gpuApply(currentMatrix);
  return true;
}

function activateForApp(hwnd) {
  if (!nativeReady) return false;
  mode = 'app';
  targetHwnd = hwnd;
  startFocusPoller();
  // If target is already focused, apply immediately
  if (native.isForeground(hwnd) && !isIdentity(currentMatrix)) {
    gpuApply(currentMatrix);
  }
  return true;
}

function reset() {
  transition.cancel();
  stopFocusPoller();
  gpuReset();
  currentMatrix = [...IDENTITY];
  mode = 'none';
  targetHwnd = null;
}

function getVisibleWindows() {
  if (!nativeReady) return [];
  return native.enumVisibleWindows();
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
  stopFocusPoller();
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
  applyPalette, applyRawMatrix, transitionTo,
  activateFullscreen, activateForApp, reset,
  getVisibleWindows, getPalettes, getCurrentMatrix,
  getMode, isNativeAvailable, shutdown,
};