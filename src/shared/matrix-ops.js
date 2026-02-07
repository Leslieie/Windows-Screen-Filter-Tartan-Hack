const IDENTITY = [
  1, 0, 0, 0, 0,
  0, 1, 0, 0, 0,
  0, 0, 1, 0, 0,
  0, 0, 0, 1, 0,
  0, 0, 0, 0, 1,
];

function multiplyMatrices(a, b) {
  const result = new Array(25).fill(0);
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      let sum = 0;
      for (let k = 0; k < 5; k++) {
        sum += a[row * 5 + k] * b[k * 5 + col];
      }
      result[row * 5 + col] = sum;
    }
  }
  return result;
}

// amount: -1.0 (black) to +1.0 (white), 0 = no change
function brightnessMatrix(amount) {
  return [
    1, 0, 0, 0, amount,
    0, 1, 0, 0, amount,
    0, 0, 1, 0, amount,
    0, 0, 0, 1, 0,
    0, 0, 0, 0, 1,
  ];
}

// amount: 0.0 (all gray) to 2.0 (high contrast), 1.0 = no change
function contrastMatrix(amount) {
  const offset = (1 - amount) / 2;
  return [
    amount, 0, 0, 0, offset,
    0, amount, 0, 0, offset,
    0, 0, amount, 0, offset,
    0, 0, 0, 1, 0,
    0, 0, 0, 0, 1,
  ];
}

// amount: 0.0 (grayscale) to 2.0 (oversaturated), 1.0 = no change
function saturationMatrix(amount) {
  const lumR = 0.2126, lumG = 0.7152, lumB = 0.0722;
  const sr = (1 - amount) * lumR;
  const sg = (1 - amount) * lumG;
  const sb = (1 - amount) * lumB;
  return [
    sr + amount, sg,          sb,          0, 0,
    sr,          sg + amount, sb,          0, 0,
    sr,          sg,          sb + amount, 0, 0,
    0,           0,           0,           1, 0,
    0,           0,           0,           0, 1,
  ];
}

// degrees: 0-360
function hueRotateMatrix(degrees) {
  const rad = (degrees * Math.PI) / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  const lumR = 0.2126, lumG = 0.7152, lumB = 0.0722;
  return [
    lumR + cos*(1-lumR) + sin*(-lumR),    lumG + cos*(-lumG) + sin*(-lumG),      lumB + cos*(-lumB) + sin*(1-lumB),  0, 0,
    lumR + cos*(-lumR) + sin*0.143,       lumG + cos*(1-lumG) + sin*0.140,       lumB + cos*(-lumB) + sin*(-0.283), 0, 0,
    lumR + cos*(-lumR) + sin*(-(1-lumR)), lumG + cos*(-lumG) + sin*lumG,         lumB + cos*(1-lumB) + sin*lumB,    0, 0,
    0, 0, 0, 1, 0,
    0, 0, 0, 0, 1,
  ];
}

// r, g, b: -1.0 to 1.0 offset per channel
function tintMatrix(r, g, b) {
  return [
    1, 0, 0, 0, r,
    0, 1, 0, 0, g,
    0, 0, 1, 0, b,
    0, 0, 0, 1, 0,
    0, 0, 0, 0, 1,
  ];
}

function channelScaleMatrix(r, g, b) {
  return [
    r, 0, 0, 0, 0,
    0, g, 0, 0, 0,
    0, 0, b, 0, 0,
    0, 0, 0, 1, 0,
    0, 0, 0, 0, 1,
  ];
}

function invertMatrix() {
  return [
    -1, 0,  0,  0, 1,
    0,  -1, 0,  0, 1,
    0,  0,  -1, 0, 1,
    0,  0,  0,  1, 0,
    0,  0,  0,  0, 1,
  ];
}

function lerpMatrix(a, b, t) {
  return a.map((val, i) => val + (b[i] - val) * t);
}

// Applied right to left: compose(A, B, C) means C first, then B, then A
function compose(...matrices) {
  return matrices.reduce((acc, m) => multiplyMatrices(acc, m), [...IDENTITY]);
}

// Convert to Windows Magnification API format (row-vector convention)
function transposeMatrix(m) {
  const result = new Array(25);
  for (let r = 0; r < 5; r++)
    for (let c = 0; c < 5; c++)
      result[c * 5 + r] = m[r * 5 + c];
  return result;
}

module.exports = {
  IDENTITY, multiplyMatrices, brightnessMatrix, contrastMatrix,
  saturationMatrix, hueRotateMatrix, tintMatrix, channelScaleMatrix,
  invertMatrix, lerpMatrix, compose, transposeMatrix,
};
