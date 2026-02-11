// src/shared/palettes/index.js
// All 14 Palettes

const {
  compose, IDENTITY, lerpMatrix,
  brightnessMatrix, contrastMatrix, saturationMatrix,
  channelScaleMatrix, tintMatrix, hueRotateMatrix
} = require('../matrix-ops');

const { buildParametricDarkMode, buildDarkDim } = require('./dark-mode');

const PALETTES = [
  {
    id: 'dark_mode',
    name: 'Dark Mode',
    description: 'Convert to dark Mode ',
    icon: '🌙',
    category: 'essential',
    previewColors: ['#1e1e24', '#2d2d36'],
    matrix: buildParametricDarkMode({
      invertStrength: 1.0, warmth: 0.5, contrast: 0.88,
      saturation: 1.15, brightness: -0.08,
    }),
  },
  {
    id: 'dark_dim',
    name: 'Dark Dim',
    description: 'Dims screen, preserves photos',
    icon: '🔅',
    category: 'essential',
    previewColors: ['#707070', '#606060'],
    matrix: buildDarkDim(),
  },
  {
    id: 'night_filter',
    name: 'Night Filter',
    description: 'Reduce blue light',
    icon: '🔅',
    category: 'essential',
    previewColors: [ '#ff8c00', '#ffe4b5'],
    matrix: compose(
      brightnessMatrix(-0.05),
      channelScaleMatrix(1.0, 0.9, 0.6),
      tintMatrix(0.05, 0.02, 0),
    ),
  },
  {
    id: 'pastel',
    name: 'Pastel Dream',
    description: 'Soft Color',
    icon: '🌸',
    category: 'style',
    previewColors: ['#fce4ec', '#e0f2f1'],
    matrix: compose(
      brightnessMatrix(0.08),
      saturationMatrix(0.55),
      contrastMatrix(0.85),
      tintMatrix(0.06, 0.04, 0.08),
    ),
  },
  {
    id: 'neon',
    name: 'Neon Glow',
    description: 'Vibrant colors',
    icon: '⚡',
    category: 'style',
    previewColors: [ '#ff00ff', '#00ffff', ],
    matrix: compose(
      saturationMatrix(1.80),
      contrastMatrix(1.25),
      brightnessMatrix(-0.05),
    ),
  },
  {
    id: 'sepia',
    name: 'Vintage Sepia',
    description: 'Warm antique',
    icon: '📜',
    category: 'style',
    previewColors: ['#c49a6c', '#f5e6cc',],
    matrix: [
      0.393, 0.349, 0.272, 0, 0,
      0.769, 0.686, 0.534, 0, 0,
      0.189, 0.168, 0.131, 0, 0,
      0,     0,     0,     1, 0,
      0,     0,     0,     0, 1,
    ],
  },
  {
    id: 'warm',
    name: 'Warm Amber',
    description: 'Warm tones',
    icon: '🔥',
    category: 'style',
    previewColors: [ '#ff9800', '#ffcc80',],
    matrix: compose(
      channelScaleMatrix(1.08, 0.97, 0.82),
      tintMatrix(0.06, 0.03, -0.02),
    ),
  },
  {
    id: 'cool',
    name: 'Cool Blue',
    description: 'Blue atmosphere',
    icon: '❄️',
    category: 'style',
    previewColors: [ '#1565c0', '#90caf9',],
    matrix: compose(
      channelScaleMatrix(0.88, 0.94, 1.08),
      tintMatrix(-0.02, 0.01, 0.05),
    ),
  },
  {
    id: 'forest',
    name: 'Forest',
    description: 'Deep greens and earth tones',
    icon: '🌲',
    category: 'style',
    previewColors: ['#2e7d32', '#a5d6a7', ],
    matrix: compose(
      channelScaleMatrix(0.85, 1.05, 0.80),
      saturationMatrix(0.90),
      tintMatrix(0.00, 0.03, -0.02),
    ),
  },
  {
    id: 'high_contrast',
    name: 'High Contrast',
    description: 'Maximum readability',
    icon: '🔲',
    category: 'accessibility',
    previewColors: [ '#ffffff', '#ffff00', ],
    matrix: compose(
      saturationMatrix(1.30),
      contrastMatrix(1.50),
      brightnessMatrix(-0.08),
    ),
  },
  {
    id: 'grayscale',
    name: 'Grayscale',
    description: 'Remove all color',
    icon: '🩶',
    category: 'accessibility',
    previewColors: ['#666666', '#aaaaaa'],
    matrix: saturationMatrix(0),
  },
  {
    id: 'solarized',
    name: 'Solarized',
    description: 'Low-contrast color ',
    icon: '☀️',
    category: 'style',
    previewColors: ['#859900', '#b58900'],
    matrix: buildParametricDarkMode({
      invertStrength: 0.85, warmth: 0.3, contrast: 0.82,
      saturation: 1.05, brightness: -0.05,
    }),
  },
   {
    id: 'cmu_tartan',
    name: 'CMU Tartan',
    description: 'CMU color',
    icon: '🏴',
    category: 'style',
    previewColors: ['#c41230', '#1a2744', '#2d8a4e'],
    matrix: compose(
      saturationMatrix(1.25),
      contrastMatrix(1.12),
      tintMatrix(0.07, -0.01, -0.04),
      channelScaleMatrix(1.12, 0.88, 0.85),
      brightnessMatrix(-0.03),
    ),
  },
  {
    id: 'mosaic',
    name: 'Mosaic',
    description: 'Stain Glass',
    icon: '🪟',
    category: 'style',
    previewColors: [],
    matrix: compose(
      saturationMatrix(1.60),
      contrastMatrix(1.70),
      brightnessMatrix(-0.05),
      channelScaleMatrix(1.02, 1.00, 0.98),
    ),
  },
  {
    id: 'custom',
    name: 'Custom',
    description: 'Build your own',
    icon: 'Ctrl',
    category: 'custom',
    previewColors: ['#9c27b0', '#e91e63', '#ff9800', '#4caf50'],
    matrix: [...IDENTITY],
  },
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function buildCustomPaletteMatrix(rgb = {}) {
  const r = clamp(Number(rgb.r ?? 100), 0, 200) / 100;
  const g = clamp(Number(rgb.g ?? 100), 0, 200) / 100;
  const b = clamp(Number(rgb.b ?? 100), 0, 200) / 100;
  return channelScaleMatrix(r, g, b);
}

function applyIntensity(matrix, intensity) {
  if (intensity <= 0) return [...IDENTITY];
  if (intensity >= 1) return [...matrix];
  return lerpMatrix(IDENTITY, matrix, intensity);
}

function getPaletteById(id) {
  return PALETTES.find(p => p.id === id) || null;
}

module.exports = { PALETTES, applyIntensity, getPaletteById, buildCustomPaletteMatrix };
