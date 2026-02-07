// src/shared/matrix-test-harness.js
// Visual Quality Checker
//
// Usage:
//   node src/shared/matrix-test-harness.js          → test dark mode
//   node src/shared/matrix-test-harness.js --all    → test all palettes

const TEST_COLORS = {
  white:     [1.00, 1.00, 1.00],
  nearWhite: [0.96, 0.96, 0.96],
  lightGray: [0.90, 0.90, 0.90],
  black:     [0.00, 0.00, 0.00],
  darkGray:  [0.20, 0.20, 0.20],
  medGray:   [0.50, 0.50, 0.50],
  blue:      [0.00, 0.47, 0.84],
  red:       [0.84, 0.18, 0.18],
  green:     [0.18, 0.65, 0.18],
  yellow:    [1.00, 0.76, 0.03],
  orange:    [1.00, 0.47, 0.00],
  titleBar:  [0.00, 0.47, 0.84],
  scrollBar: [0.80, 0.80, 0.80],
  menuBg:    [0.94, 0.94, 0.94],
  skinLight: [0.96, 0.80, 0.69],
  skinMedium:[0.76, 0.57, 0.42],
  skinDark:  [0.36, 0.22, 0.13],
};

// Convention: output = Matrix × [R, G, B, A, 1]^T  (column-vector)
// R' = m[0]*R + m[1]*G + m[2]*B + m[3]*A + m[4]*1
function applyMatrix(matrix, rgb) {
  const [r, g, b] = rgb;
  const a = 1;
  return [
    Math.max(0, Math.min(1, matrix[0]*r + matrix[1]*g + matrix[2]*b  + matrix[3]*a + matrix[4])),
    Math.max(0, Math.min(1, matrix[5]*r + matrix[6]*g + matrix[7]*b  + matrix[8]*a + matrix[9])),
    Math.max(0, Math.min(1, matrix[10]*r + matrix[11]*g + matrix[12]*b + matrix[13]*a + matrix[14])),
  ];
}

function luminance(rgb) {
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

function contrastRatio(color1, color2) {
  const l1 = luminance(color1);
  const l2 = luminance(color2);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

function toHex(rgb) {
  return '#' + rgb.map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
}

function testPalette(name, matrix, isDarkMode = true) {
  console.log('\n' + '='.repeat(50));
  console.log('  Testing: ' + name);
  console.log('='.repeat(50) + '\n');

  let passed = 0, failed = 0, warned = 0;

  const results = {};
  for (const [colorName, color] of Object.entries(TEST_COLORS)) {
    results[colorName] = { original: color, transformed: applyMatrix(matrix, color) };
  }

  if (isDarkMode) {
    const bg = results.white.transformed;
    const bgLum = luminance(bg);
    const bgPass = bgLum < 0.15;
    console.log('CHECK 1: White → Dark background');
    console.log('  Result: ' + toHex(bg) + ' (lum=' + bgLum.toFixed(3) + ')');
    console.log('  ' + (bgPass ? '✅ PASS' : '❌ FAIL') + ' (need lum < 0.15)');
    bgPass ? passed++ : failed++;

    const text = results.black.transformed;
    const textLum = luminance(text);
    const textPass = textLum > 0.5;
    console.log('\nCHECK 2: Black → Light text');
    console.log('  Result: ' + toHex(text) + ' (lum=' + textLum.toFixed(3) + ')');
    console.log('  ' + (textPass ? '✅ PASS' : '❌ FAIL') + ' (need lum > 0.5)');
    textPass ? passed++ : failed++;

    const ratio = contrastRatio(text, bg);
    const aaPass = ratio >= 4.5;
    const aaaPass = ratio >= 7.0;
    console.log('\nCHECK 3: Contrast ratio = ' + ratio.toFixed(1) + ':1');
    console.log('  ' + (aaPass ? '✅ PASS' : '❌ FAIL') + ' WCAG AA (≥ 4.5:1)');
    console.log('  ' + (aaaPass ? '✅ PASS' : '⚠️  WARN') + ' WCAG AAA (≥ 7.0:1)');
    aaPass ? passed++ : failed++;
    aaaPass ? passed++ : warned++;

    const grayRamp = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
    const tRamp = grayRamp.map(v => luminance(applyMatrix(matrix, [v, v, v])));
    let monotonic = true;
    for (let i = 1; i < tRamp.length; i++) {
      if (tRamp[i] > tRamp[i - 1] + 0.01) monotonic = false;
    }
    console.log('\nCHECK 4: Gray ramp monotonic');
    console.log('  ' + tRamp.map(v => v.toFixed(2)).join(' → '));
    console.log('  ' + (monotonic ? '✅ PASS' : '❌ FAIL'));
    monotonic ? passed++ : failed++;
  }

  console.log('\nCHECK 5-7: Hue preservation');
  for (const [colorName, dominant, others, desc] of [
    ['blue', 2, [0, 1], 'Blue channel dominates'],
    ['red',  0, [1, 2], 'Red channel dominates'],
    ['green', 1, [0, 2], 'Green channel dominates'],
  ]) {
    const c = results[colorName].transformed;
    const ok = others.every(o => c[dominant] > c[o]);
    console.log('  ' + colorName + ': ' + toHex(c) + ' ' + (ok ? '✅' : '⚠️ ') + ' ' + desc);
    ok ? passed++ : warned++;
  }

  let clipped = 0;
  for (const { transformed } of Object.values(results)) {
    for (const v of transformed) {
      if (v <= 0.001 || v >= 0.999) clipped++;
    }
  }
  console.log('\nCHECK 8: Clipping = ' + clipped + '/51 ' + (clipped < 5 ? '✅' : '⚠️ '));
  clipped < 5 ? passed++ : warned++;

  console.log('\n── Full Color Map ──────────────────────────────');
  console.log('Color'.padEnd(12) + 'Original'.padEnd(18) + '→ ' + 'Transformed'.padEnd(18) + 'Hex'.padEnd(10) + 'Lum');
  for (const [name, { original, transformed }] of Object.entries(results)) {
    const o = '(' + original.map(v => Math.round(v*255)).join(',') + ')';
    const t = '(' + transformed.map(v => Math.round(v*255)).join(',') + ')';
    console.log(name.padEnd(12) + o.padEnd(18) + '→ ' + t.padEnd(18) + toHex(transformed).padEnd(10) + luminance(transformed).toFixed(3));
  }

  console.log('\n── Summary: ✅' + passed + '  ❌' + failed + '  ⚠️ ' + warned + '\n');
  return { passed, failed, warned };
}

if (require.main === module) {
  if (process.argv.includes('--all')) {
    const { PALETTES } = require('./palettes/index');
    let tp = 0, tf = 0;
    for (const p of PALETTES) {
      if (p.id === 'custom') continue;
      const isDark = p.id === 'dark_mode' || p.id === 'solarized';
      const r = testPalette(p.name + ' (' + p.id + ')', p.matrix, isDark);
      tp += r.passed; tf += r.failed;
    }
    console.log('\n' + '='.repeat(50));
    console.log('  ALL: ' + tp + ' passed, ' + tf + ' failed');
    console.log('='.repeat(50));
  } else {
    const { buildParametricDarkMode } = require('./palettes/dark-mode');
    testPalette('Dark Mode (default params)', buildParametricDarkMode(), true);
  }
}

module.exports = { TEST_COLORS, applyMatrix, luminance, contrastRatio, toHex, testPalette };
