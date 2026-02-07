// src/shared/vision-api.js — THE BRIDGE
//
// This connects main.js (Electron) to the vision modules.
// Two backends:
//   1. "native"  — Windows Magnification API (GPU, zero CPU cost, full-screen only)
//   2. "overlay" — Screenshot + SVG feColorMatrix on canvas (cross-platform, works NOW)
//
// main.js calls these functions. Vision side owns everything behind them.

const { PALETTES, applyIntensity, getPaletteById } = require('./palettes/index');
const { transposeMatrix, IDENTITY, compose } = require('./matrix-ops');
const { TransitionEngine, Easings } = require('./transition-engine');

// --- Try to load native addon (Windows only) ---
let nativeAddon = null;
try {
  nativeAddon = require('../../build/Release/module.node');
  if (nativeAddon && nativeAddon.init && nativeAddon.init()) {
    console.log('[VisionAPI] Native Magnification API initialized');
  } else {
    nativeAddon = null;
  }
} catch (e) {
  // Expected on non-Windows or if addon isn't built yet
  nativeAddon = null;
}

// --- State ---
const transition = new TransitionEngine();
let currentMatrix = [...IDENTITY];
let onMatrixChange = null; // callback set by main.js for overlay mode

// --- Internal: apply a matrix to the screen ---
function applyToScreen(matrix) {
  currentMatrix = [...matrix];

  if (nativeAddon) {
    // Native path: transpose to row-vector convention and send to GPU
    const transposed = transposeMatrix(matrix);
    nativeAddon.applyMatrix(transposed);
  }

  // Always fire callback (for overlay mode or UI preview)
  if (onMatrixChange) {
    onMatrixChange(matrix);
  }
}

// ============================================================
// PUBLIC API — what main.js calls
// ============================================================

/**
 * Set a callback for when the matrix changes.
 * In overlay mode, this sends the matrix to the overlay window.
 */
function setOnMatrixChange(callback) {
  onMatrixChange = callback;
}

/**
 * Apply a named palette at given intensity.
 * @param {string} paletteId - e.g. 'dark_mode', 'night_filter'
 * @param {number} intensity - 0.0 (off) to 1.0 (full)
 * @returns {boolean}
 */
function applyPalette(paletteId, intensity = 1.0) {
  const palette = getPaletteById(paletteId);
  if (!palette) return false;

  const matrix = applyIntensity(palette.matrix, intensity);
  applyToScreen(matrix);
  return true;
}

/**
 * Apply a raw 5x5 matrix directly.
 * @param {number[]} matrix - 25-element flat array
 * @returns {boolean}
 */
function applyRawMatrix(matrix) {
  if (!Array.isArray(matrix) || matrix.length !== 25) return false;
  applyToScreen(matrix);
  return true;
}

/**
 * Remove all effects.
 */
function reset() {
  transition.cancel();
  applyToScreen([...IDENTITY]);
  if (nativeAddon) nativeAddon.reset();
  return true;
}

/**
 * Smoothly transition to a target palette.
 * @param {string} paletteId
 * @param {number} intensity
 * @param {number} durationMs - transition time in ms (default 400)
 */
function transitionTo(paletteId, intensity = 1.0, durationMs = 400) {
  const palette = getPaletteById(paletteId);
  if (!palette) return;

  const target = applyIntensity(palette.matrix, intensity);

  transition.animate({
    from: transition.getCurrentMatrix(),
    to: target,
    duration: durationMs,
    easing: Easings.easeInOutCubic,
    onFrame: (matrix) => applyToScreen(matrix),
    onComplete: () => console.log(`[VisionAPI] Transitioned to ${paletteId}`),
  });
}

/**
 * Get all available palettes (for UI to display).
 */
function getPalettes() {
  return PALETTES.map(p => ({
    id: p.id,
    name: p.name,
    description: p.description,
    icon: p.icon,
    category: p.category,
    previewColors: p.previewColors,
  }));
}

/**
 * Get the current active matrix.
 */
function getCurrentMatrix() {
  return [...currentMatrix];
}

/**
 * Check if native backend is available.
 */
function isNativeAvailable() {
  return nativeAddon !== null;
}

/**
 * Cleanup on app exit.
 */
function shutdown() {
  transition.cancel();
  if (nativeAddon) nativeAddon.reset();
  currentMatrix = [...IDENTITY];
}

module.exports = {
  setOnMatrixChange,
  applyPalette,
  applyRawMatrix,
  reset,
  transitionTo,
  getPalettes,
  getCurrentMatrix,
  isNativeAvailable,
  shutdown,
};
