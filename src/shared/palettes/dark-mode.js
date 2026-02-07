// src/shared/palettes/dark-mode.js
// Dark Mode Matrix Builder
//
// Strategy: The core is INVERT + HUE-ROTATE(180°).
// - Inversion flips brightness (white→black, black→white) 
// - But it also flips colors (blue→yellow, red→cyan) 
// - Hue-rotating 180° undoes the color flip 
//
// Then layer on adjustments:
// - Reduce contrast slightly (pure inversion is too harsh)
// - Boost saturation (the process desaturates colors)
// - Add warm tint (humans prefer warm darks over cold blue-gray)
// - Adjust brightness to hit target dark-background luminance

const {
  compose, invertMatrix, saturationMatrix, contrastMatrix,
  tintMatrix, brightnessMatrix, hueRotateMatrix,
  lerpMatrix, IDENTITY
} = require('../matrix-ops');

//  Naive Inversion 
const naive = invertMatrix();

//  Invert + Hue Rotate (decent base) ───
const invertHueRotate = compose(
  hueRotateMatrix(180),
  invertMatrix()
);

// Tuned dark mode 
function buildDarkModeMatrix() {
  return compose(
    saturationMatrix(1.15),       // 4. boost saturation (inversion desaturates)
    contrastMatrix(0.88),         // 3. soften contrast
    tintMatrix(0.04, 0.02, -0.01),// 2. warm shift
    brightnessMatrix(-0.08),      // 1. darken slightly (inversion is too bright)
    hueRotateMatrix(180),         // 0b. undo color flip
    invertMatrix()                // 0a. flip brightness
  );
}

//  Parametric (this works best)
const DEFAULT_PARAMS = {
  invertStrength: 1.0,    // how much of the inversion to apply (lerp with identity)
  warmth: 0.5,            // 0 = neutral, 1 = very warm
  contrast: 0.88,         // 0.5–1.5, lower = softer
  saturation: 1.15,       // 0.5–2.0, >1 compensates for desaturation
  brightness: -0.08,      // additional brightness offset (-0.2 to +0.2)
};

function buildParametricDarkMode(params) {
  const p = Object.assign({}, DEFAULT_PARAMS, params);

  // Base: invert + hue-rotate (preserves hues)
  const base = compose(
    hueRotateMatrix(180),
    invertMatrix()
  );

  // Apply intensity: blend between identity and full inversion
  const invertBlended = p.invertStrength >= 1
    ? base
    : lerpMatrix(IDENTITY, base, p.invertStrength);

  // Warm tint based on warmth parameter
  const warmR = p.warmth * 0.06;
  const warmG = p.warmth * 0.03;
  const warmB = p.warmth * -0.02;

  // Compose all adjustments on top of the base inversion
  return compose(
    saturationMatrix(p.saturation),
    contrastMatrix(p.contrast),
    tintMatrix(warmR, warmG, warmB),
    brightnessMatrix(p.brightness),
    invertBlended
  );
}

module.exports = {
  naive,
  invertHueRotate,
  buildDarkModeMatrix,
  buildParametricDarkMode,
  DEFAULT_PARAMS,
};
