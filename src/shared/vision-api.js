// src/shared/vision-api.js — THE BRIDGE
//
// Two backends:
//   1. NATIVE (Windows) — MagSetFullscreenColorEffect on GPU. Zero lag.
//      No overlay window needed. Matrix applied by DWM compositor.
//
//   2. OVERLAY (fallback) — Screenshot + SVG feColorMatrix.
//      Used on non-Windows or when native addon isn't built.
//      Per-window only (full-screen is too expensive).
//
// main.js doesn't care which backend — it calls the same functions.

const { PALETTES, applyIntensity, getPaletteById } = require('./palettes/index');
const { transposeMatrix, IDENTITY } = require('./matrix-ops');
const { TransitionEngine, Easings } = require('./transition-engine');

// ── Try to load native addon ────────────────────────────────────
let native = null;
try {
  native = require('../../build/Release/screentint_native.node');
} catch (e1) {
  try {
    // electron-rebuild puts it here sometimes
    native = require('../../build/Release/screentint_native');
  } catch (e2) {
    native = null;
  }
}

let nativeReady = false;
if (native && native.isAvailable && native.isAvailable()) {
  try {
    nativeReady = native.init();
    if (nativeReady) console.log('[Vision] ✓ Native Magnification API ready (zero-lag GPU mode)');
  } catch (e) {
    console.warn('[Vision] Native init failed:', e.message);
    nativeReady = false;
  }
}

if (!nativeReady) {
  console.log('[Vision] Native not available — using overlay fallback');
}

// ── State ───────────────────────────────────────────────────────
const transition = new TransitionEngine();
let currentMatrix = [...IDENTITY];
let onMatrixChange = null; // callback for overlay mode

// ── Apply matrix to screen ──────────────────────────────────────
function applyToScreen(matrix) {
  currentMatrix = [...matrix];

  if (nativeReady) {
    // Native: transpose to row-vector convention, send to GPU
    const transposed = transposeMatrix(matrix);
    native.applyMatrix(transposed);
  }

  // Always fire callback (overlay mode uses this)
  if (onMatrixChange) onMatrixChange(matrix);
}

// ═════════════════════════════════════════════════════════════════
// PUBLIC API
// ═════════════════════════════════════════════════════════════════

function setOnMatrixChange(cb) { onMatrixChange = cb; }

function applyPalette(paletteId, intensity = 1.0) {
  const palette = getPaletteById(paletteId);
  if (!palette) return false;
  applyToScreen(applyIntensity(palette.matrix, intensity));
  return true;
}

function applyRawMatrix(matrix) {
  if (!Array.isArray(matrix) || matrix.length !== 25) return false;
  applyToScreen(matrix);
  return true;
}

function reset() {
  transition.cancel();
  applyToScreen([...IDENTITY]);
  if (nativeReady) native.reset();
  return true;
}

function transitionTo(paletteId, intensity = 1.0, durationMs = 400) {
  const palette = getPaletteById(paletteId);
  if (!palette) return;
  const target = applyIntensity(palette.matrix, intensity);

  transition.animate({
    from: transition.getCurrentMatrix(),
    to: target,
    duration: durationMs,
    easing: Easings.easeInOutCubic,
    onFrame: (m) => applyToScreen(m),
  });
}

function transitionToRaw(matrix, durationMs = 400) {
  if (!Array.isArray(matrix) || matrix.length !== 25) return;
  transition.animate({
    from: transition.getCurrentMatrix(),
    to: matrix,
    duration: durationMs,
    easing: Easings.easeInOutCubic,
    onFrame: (m) => applyToScreen(m),
  });
}

function getPalettes() {
  return PALETTES.map(p => ({
    id: p.id, name: p.name, description: p.description,
    icon: p.icon, category: p.category, previewColors: p.previewColors,
  }));
}

function getCurrentMatrix() { return [...currentMatrix]; }

function isNativeAvailable() { return nativeReady; }

/** Which backend is active */
function getBackend() { return nativeReady ? 'native' : 'overlay'; }

function shutdown() {
  transition.cancel();
  if (nativeReady) {
    native.reset();
    native.shutdown();
    nativeReady = false;
  }
  currentMatrix = [...IDENTITY];
}

module.exports = {
  setOnMatrixChange,
  applyPalette,
  applyRawMatrix,
  reset,
  transitionTo,
  transitionToRaw,
  getPalettes,
  getCurrentMatrix,
  isNativeAvailable,
  getBackend,
  shutdown,
};