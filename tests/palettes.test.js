// tests/palettes.test.js
const { PALETTES, applyIntensity, getPaletteById, buildCustomPaletteMatrix } = require('../src/shared/palettes');
const { IDENTITY } = require('../src/shared/matrix-ops');
const { applyMatrix, luminance, contrastRatio } = require('../src/shared/matrix-test-harness');

describe('PALETTES', () => {
  test('has 15 palettes', () => expect(PALETTES).toHaveLength(15));

  test('every palette has required fields and valid matrix', () => {
    for (const p of PALETTES) {
      expect(p).toHaveProperty('id');
      expect(p).toHaveProperty('name');
      expect(p).toHaveProperty('matrix');
      expect(p.matrix).toHaveLength(25);
      expect(p.matrix.every(v => typeof v === 'number' && !isNaN(v))).toBe(true);
    }
  });

  test('unique ids', () => {
    const ids = PALETTES.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('custom palette is identity', () => {
    getPaletteById('custom').matrix.forEach((v, i) => expect(v).toBeCloseTo(IDENTITY[i], 10));
  });
});

describe('Dark Mode quality', () => {
  const dm = getPaletteById('dark_mode');

  test('white → dark (lum < 0.15)', () => {
    expect(luminance(applyMatrix(dm.matrix, [1,1,1]))).toBeLessThan(0.15);
  });

  test('black → light (lum > 0.5)', () => {
    expect(luminance(applyMatrix(dm.matrix, [0,0,0]))).toBeGreaterThan(0.5);
  });

  test('contrast ≥ 4.5:1 (WCAG AA)', () => {
    const bg = applyMatrix(dm.matrix, [1,1,1]);
    const text = applyMatrix(dm.matrix, [0,0,0]);
    expect(contrastRatio(bg, text)).toBeGreaterThanOrEqual(4.5);
  });

  test('blue stays blue', () => {
    const b = applyMatrix(dm.matrix, [0, 0.47, 0.84]);
    expect(b[2]).toBeGreaterThan(b[0]);
    expect(b[2]).toBeGreaterThan(b[1]);
  });

  test('red stays red', () => {
    const r = applyMatrix(dm.matrix, [0.84, 0.18, 0.18]);
    expect(r[0]).toBeGreaterThan(r[1]);
    expect(r[0]).toBeGreaterThan(r[2]);
  });
});

describe('Dark Dim quality', () => {
  const dd = getPaletteById('dark_dim');

  test('exists with correct metadata', () => {
    expect(dd).not.toBeNull();
    expect(dd.name).toBe('Dark Dim');
    expect(dd.category).toBe('essential');
  });

  test('white → dimmed (lum < 0.65)', () => {
    expect(luminance(applyMatrix(dd.matrix, [1,1,1]))).toBeLessThan(0.65);
  });

  test('white → not too dark (lum > 0.30)', () => {
    expect(luminance(applyMatrix(dd.matrix, [1,1,1]))).toBeGreaterThan(0.30);
  });

  test('black → near black (lum < 0.05)', () => {
    expect(luminance(applyMatrix(dd.matrix, [0,0,0]))).toBeLessThan(0.05);
  });

  test('does NOT invert — white lum > black lum', () => {
    const wLum = luminance(applyMatrix(dd.matrix, [1,1,1]));
    const bLum = luminance(applyMatrix(dd.matrix, [0,0,0]));
    expect(wLum).toBeGreaterThan(bLum);
  });

  test('contrast ≥ 4:1', () => {
    const bg = applyMatrix(dd.matrix, [1,1,1]);
    const text = applyMatrix(dd.matrix, [0,0,0]);
    expect(contrastRatio(bg, text)).toBeGreaterThanOrEqual(4.0);
  });

  test('blue stays blue', () => {
    const b = applyMatrix(dd.matrix, [0, 0.47, 0.84]);
    expect(b[2]).toBeGreaterThan(b[0]);
    expect(b[2]).toBeGreaterThan(b[1]);
  });

  test('monotonic gray ramp (no inversion)', () => {
    const ramp = [0, 0.25, 0.5, 0.75, 1.0];
    const lums = ramp.map(v => luminance(applyMatrix(dd.matrix, [v, v, v])));
    for (let i = 1; i < lums.length; i++) {
      expect(lums[i]).toBeGreaterThanOrEqual(lums[i-1] - 0.001);
    }
  });
});

describe('applyIntensity', () => {
  const dm = getPaletteById('dark_mode');

  test('0 → identity', () => {
    applyIntensity(dm.matrix, 0).forEach((v, i) => expect(v).toBeCloseTo(IDENTITY[i], 10));
  });

  test('1 → full palette', () => {
    applyIntensity(dm.matrix, 1).forEach((v, i) => expect(v).toBeCloseTo(dm.matrix[i], 10));
  });

  test('0.5 is between identity and palette', () => {
    const r = applyIntensity(dm.matrix, 0.5);
    for (let i = 0; i < 25; i++) {
      const lo = Math.min(IDENTITY[i], dm.matrix[i]);
      const hi = Math.max(IDENTITY[i], dm.matrix[i]);
      expect(r[i]).toBeGreaterThanOrEqual(lo - 0.001);
      expect(r[i]).toBeLessThanOrEqual(hi + 0.001);
    }
  });
});

describe('getPaletteById', () => {
  test('finds dark_mode', () => {
    expect(getPaletteById('dark_mode')).not.toBeNull();
    expect(getPaletteById('dark_mode').name).toBe('Dark Mode');
  });
  test('returns null for nonexistent', () => {
    expect(getPaletteById('nonexistent')).toBeNull();
  });
});

describe('custom palette builder', () => {
  test('100/100/100 is identity', () => {
    const m = buildCustomPaletteMatrix({ r: 100, g: 100, b: 100 });
    m.forEach((v, i) => expect(v).toBeCloseTo(IDENTITY[i], 10));
  });

  test('200/100/50 scales channels independently', () => {
    const out = applyMatrix(buildCustomPaletteMatrix({ r: 200, g: 100, b: 50 }), [0.5, 0.4, 0.8]);
    expect(out[0]).toBeCloseTo(1.0, 10);
    expect(out[1]).toBeCloseTo(0.4, 10);
    expect(out[2]).toBeCloseTo(0.4, 10);
  });
});
describe('CMU Tartan palette', () => {
  const tartan = getPaletteById('cmu_tartan');

  test('exists with correct metadata', () => {
    expect(tartan).not.toBeNull();
    expect(tartan.name).toBe('CMU Tartan');
    expect(tartan.category).toBe('style');
    expect(tartan.matrix).toHaveLength(25);
  });

  test('red channel is dominant — white gains red tint', () => {
    const t = applyMatrix(tartan.matrix, [1, 1, 1]);
    // Under CMU tartan grading, whites should be warm (R > G, R > B)
    expect(t[0]).toBeGreaterThan(t[1]);
    expect(t[0]).toBeGreaterThan(t[2]);
  });

  test('red stays strongly red', () => {
    const r = applyMatrix(tartan.matrix, [0.84, 0.18, 0.18]);
    expect(r[0]).toBeGreaterThan(r[1]);
    expect(r[0]).toBeGreaterThan(r[2]);
  });

  test('does not invert brightness — white stays lighter than black', () => {
    const white = applyMatrix(tartan.matrix, [1, 1, 1]);
    const black = applyMatrix(tartan.matrix, [0, 0, 0]);
    expect(luminance(white)).toBeGreaterThan(luminance(black));
  });

  test('blue input stays recognizably blue but is muted', () => {
    const b = applyMatrix(tartan.matrix, [0, 0.47, 0.84]);
    // Blue should still dominate (hue preserved)
    expect(b[2]).toBeGreaterThan(b[1]);
    // But overall blue luminance is reduced vs identity (tartan warms things)
    const identityBlue = [0, 0.47, 0.84];
    expect(luminance(b)).toBeLessThan(luminance(identityBlue));
  });
});

describe('Mosaic palette', () => {
  const mosaic = getPaletteById('mosaic');

  test('exists with correct metadata', () => {
    expect(mosaic).not.toBeNull();
    expect(mosaic.name).toBe('Mosaic');
    expect(mosaic.category).toBe('style');
    expect(mosaic.matrix).toHaveLength(25);
  });

  test('high contrast — white and black stay far apart', () => {
    const white = applyMatrix(mosaic.matrix, [1, 1, 1]);
    const black = applyMatrix(mosaic.matrix, [0, 0, 0]);
    expect(contrastRatio(white, black)).toBeGreaterThan(5.0);
  });

  test('vivid saturation — pure red output still dominated by R', () => {
    const r = applyMatrix(mosaic.matrix, [0.84, 0.18, 0.18]);
    expect(r[0]).toBeGreaterThan(r[1]);
    expect(r[0]).toBeGreaterThan(r[2]);
  });

  test('vivid saturation — pure blue output still dominated by B', () => {
    const b = applyMatrix(mosaic.matrix, [0, 0.47, 0.84]);
    expect(b[2]).toBeGreaterThan(b[0]);
  });

  test('mid gray has higher contrast than identity would', () => {
    // Mosaic should push mid-tones away from center
    const midIdentity = luminance([0.5, 0.5, 0.5]); // ~0.5
    const midMosaic = luminance(applyMatrix(mosaic.matrix, [0.5, 0.5, 0.5]));
    // After high contrast, mid-gray should shift (not stay exactly at 0.5)
    // With contrast 1.7, mid should move
    expect(Math.abs(midMosaic - midIdentity)).toBeGreaterThan(0.01);
  });
});
