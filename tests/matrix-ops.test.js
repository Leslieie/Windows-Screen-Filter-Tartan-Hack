// tests/matrix-ops.test.js
const {
  IDENTITY, multiplyMatrices, brightnessMatrix, contrastMatrix,
  saturationMatrix, invertMatrix, lerpMatrix, compose, tintMatrix,
} = require('../src/shared/matrix-ops');

// Column-vector convention: output = M × [R,G,B,A,1]^T
function applyMatrix(matrix, rgb) {
  const [r, g, b] = rgb;
  const a = 1;
  return [
    Math.max(0, Math.min(1, matrix[0]*r + matrix[1]*g + matrix[2]*b + matrix[3]*a + matrix[4])),
    Math.max(0, Math.min(1, matrix[5]*r + matrix[6]*g + matrix[7]*b + matrix[8]*a + matrix[9])),
    Math.max(0, Math.min(1, matrix[10]*r + matrix[11]*g + matrix[12]*b + matrix[13]*a + matrix[14])),
  ];
}

describe('IDENTITY', () => {
  test('has 25 elements', () => expect(IDENTITY).toHaveLength(25));

  test('does not change any color', () => {
    for (const c of [[0,0,0], [1,1,1], [0.5, 0.3, 0.7]]) {
      const r = applyMatrix(IDENTITY, c);
      r.forEach((v, i) => expect(v).toBeCloseTo(c[i], 4));
    }
  });
});

describe('multiplyMatrices', () => {
  test('identity × identity = identity', () => {
    const r = multiplyMatrices(IDENTITY, IDENTITY);
    r.forEach((v, i) => expect(v).toBeCloseTo(IDENTITY[i], 10));
  });

  test('identity × M = M', () => {
    const m = brightnessMatrix(0.5);
    const r = multiplyMatrices(IDENTITY, m);
    r.forEach((v, i) => expect(v).toBeCloseTo(m[i], 10));
  });

  test('M × identity = M', () => {
    const m = contrastMatrix(1.5);
    const r = multiplyMatrices(m, IDENTITY);
    r.forEach((v, i) => expect(v).toBeCloseTo(m[i], 10));
  });
});

describe('brightnessMatrix', () => {
  test('amount=0 → identity', () => {
    brightnessMatrix(0).forEach((v, i) => expect(v).toBeCloseTo(IDENTITY[i], 10));
  });
  test('positive brightens', () => {
    expect(applyMatrix(brightnessMatrix(0.2), [0.5,0.5,0.5])[0]).toBeCloseTo(0.7, 2);
  });
  test('negative darkens', () => {
    expect(applyMatrix(brightnessMatrix(-0.2), [0.5,0.5,0.5])[0]).toBeCloseTo(0.3, 2);
  });
});

describe('contrastMatrix', () => {
  test('amount=1 → identity', () => {
    contrastMatrix(1).forEach((v, i) => expect(v).toBeCloseTo(IDENTITY[i], 10));
  });
  test('amount=0 → all gray', () => {
    expect(applyMatrix(contrastMatrix(0), [1,1,1])[0]).toBeCloseTo(0.5, 2);
    expect(applyMatrix(contrastMatrix(0), [0,0,0])[0]).toBeCloseTo(0.5, 2);
  });
});

describe('saturationMatrix', () => {
  test('amount=1 → identity', () => {
    saturationMatrix(1).forEach((v, i) => expect(v).toBeCloseTo(IDENTITY[i], 10));
  });
  test('amount=0 → grayscale', () => {
    const b = applyMatrix(saturationMatrix(0), [0,0,1]);
    expect(b[0]).toBeCloseTo(b[1], 4);
    expect(b[1]).toBeCloseTo(b[2], 4);
  });
});

describe('invertMatrix', () => {
  test('white → black', () => {
    applyMatrix(invertMatrix(), [1,1,1]).forEach(v => expect(v).toBeCloseTo(0, 2));
  });
  test('black → white', () => {
    applyMatrix(invertMatrix(), [0,0,0]).forEach(v => expect(v).toBeCloseTo(1, 2));
  });
});

describe('lerpMatrix', () => {
  test('t=0 → first', () => {
    const a = brightnessMatrix(0.5), b = contrastMatrix(1.5);
    lerpMatrix(a, b, 0).forEach((v, i) => expect(v).toBeCloseTo(a[i], 10));
  });
  test('t=1 → second', () => {
    const a = brightnessMatrix(0.5), b = contrastMatrix(1.5);
    lerpMatrix(a, b, 1).forEach((v, i) => expect(v).toBeCloseTo(b[i], 10));
  });
  test('t=0.5 → midpoint', () => {
    const a = [...IDENTITY];
    const b = [...IDENTITY]; b[0] = 3;
    expect(lerpMatrix(a, b, 0.5)[0]).toBeCloseTo(2, 10);
  });
});

describe('compose', () => {
  test('no args → identity', () => {
    compose().forEach((v, i) => expect(v).toBeCloseTo(IDENTITY[i], 10));
  });
  test('with identity → original', () => {
    const m = brightnessMatrix(0.3);
    compose(m, IDENTITY).forEach((v, i) => expect(v).toBeCloseTo(m[i], 6));
  });
});
