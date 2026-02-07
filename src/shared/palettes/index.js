// src/shared/palettes/index.js
// All 14 Palettes

const {
  compose, IDENTITY, lerpMatrix,
  brightnessMatrix, contrastMatrix, saturationMatrix,
  channelScaleMatrix, tintMatrix, hueRotateMatrix
} = require('../matrix-ops');

const { buildParametricDarkMode } = require('./dark-mode');

const PALETTES = [
  {
    id: 'dark_mode',
    name: 'Dark Mode',
    description: 'Comfortable inverted brightness with warm tones',
    icon: '🌙',
    category: 'essential',
    previewColors: ['#1e1e24', '#2d2d36', '#d4cfc8', '#f0ebe4'],
    matrix: buildParametricDarkMode({
      invertStrength: 1.0, warmth: 0.5, contrast: 0.88,
      saturation: 1.15, brightness: -0.08,
    }),
  },
  {
    id: 'night_filter',
    name: 'Night Filter',
    description: 'Reduce blue light for nighttime comfort',
    icon: '🔅',
    category: 'essential',
    previewColors: ['#1a1207', '#ff8c00', '#ffe4b5', '#332200'],
    matrix: compose(
      brightnessMatrix(-0.05),
      channelScaleMatrix(1.0, 0.9, 0.6),
      tintMatrix(0.05, 0.02, 0),
    ),
  },
  {
    id: 'pastel',
    name: 'Pastel Dream',
    description: 'Soft desaturated colors with gentle warmth',
    icon: '🌸',
    category: 'style',
    previewColors: ['#fce4ec', '#e8eaf6', '#e0f2f1', '#fff3e0'],
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
    description: 'Oversaturated vibrant colors',
    icon: '⚡',
    category: 'style',
    previewColors: ['#0d0221', '#ff00ff', '#00ffff', '#39ff14'],
    matrix: compose(
      saturationMatrix(1.80),
      contrastMatrix(1.25),
      brightnessMatrix(-0.05),
    ),
  },
  {
    id: 'sepia',
    name: 'Vintage Sepia',
    description: 'Warm antique photograph feel',
    icon: '📜',
    category: 'style',
    previewColors: ['#704214', '#c49a6c', '#f5e6cc', '#2c1810'],
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
    description: 'Cozy warm tones',
    icon: '🔥',
    category: 'style',
    previewColors: ['#2d1b00', '#ff9800', '#ffcc80', '#3e2723'],
    matrix: compose(
      channelScaleMatrix(1.08, 0.97, 0.82),
      tintMatrix(0.06, 0.03, -0.02),
    ),
  },
  {
    id: 'cool',
    name: 'Cool Blue',
    description: 'Crisp blue atmosphere',
    icon: '❄️',
    category: 'style',
    previewColors: ['#0a1929', '#1565c0', '#90caf9', '#e3f2fd'],
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
    previewColors: ['#1b2d1b', '#2e7d32', '#a5d6a7', '#3e2723'],
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
    previewColors: ['#000000', '#ffffff', '#ffff00', '#00ff00'],
    matrix: compose(
      saturationMatrix(1.30),
      contrastMatrix(1.50),
      brightnessMatrix(-0.08),
    ),
  },
  {
    id: 'grayscale',
    name: 'Grayscale',
    description: 'Remove all color — reduce distractions',
    icon: '🩶',
    category: 'accessibility',
    previewColors: ['#1a1a1a', '#666666', '#aaaaaa', '#e0e0e0'],
    matrix: saturationMatrix(0),
  },
  {
    id: 'solarized',
    name: 'Solarized',
    description: 'Precision-tuned low-contrast color scheme',
    icon: '☀️',
    category: 'style',
    previewColors: ['#002b36', '#268bd2', '#859900', '#b58900'],
    matrix: buildParametricDarkMode({
      invertStrength: 0.85, warmth: 0.3, contrast: 0.82,
      saturation: 1.05, brightness: -0.05,
    }),
  },
   {
    id: 'cmu_tartan',
    name: 'CMU Tartan',
    description: 'Carnegie Mellon tartan color grading — bold reds, deep navy, warm gold',
    icon: '🏴',
    category: 'style',
    previewColors: ['#c41230', '#1a2744', '#f0b400', '#2d8a4e'],
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
    description: 'Posterized stained-glass look — vivid flat color blocks',
    icon: '🪟',
    category: 'style',
    previewColors: ['#e01050', '#1060d0', '#10b040', '#f0c010'],
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
    description: 'Build your own color transformation',
    icon: '🎨',
    category: 'custom',
    previewColors: ['#9c27b0', '#e91e63', '#ff9800', '#4caf50'],
    matrix: [...IDENTITY],
  },
];

function applyIntensity(matrix, intensity) {
  if (intensity <= 0) return [...IDENTITY];
  if (intensity >= 1) return [...matrix];
  return lerpMatrix(IDENTITY, matrix, intensity);
}

function getPaletteById(id) {
  return PALETTES.find(p => p.id === id) || null;
}

module.exports = { PALETTES, applyIntensity, getPaletteById };
