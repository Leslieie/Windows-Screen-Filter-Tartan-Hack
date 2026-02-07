# Color Science & Matrix Math (Summary)

## File Structure

```
src/shared/
├── matrix-ops.js            # Core math toolbox
├── matrix-test-harness.js   # Quality validation CLI
├── transition-engine.js     # Smooth palette animation
└── palettes/
    ├── index.js             # 12 palettes + intensity control
    └── dark-mode.js         # Parametric dark mode builder
tests/
├── matrix-ops.test.js       # 19 tests
└── palettes.test.js         # 14 tests
```

## Core Functions — matrix-ops.js

| Function | Purpose |
|---|---|
| `multiplyMatrices(a, b)` | Multiply two 5×5 matrices (25-element arrays) |
| `brightnessMatrix(amount)` | Shift all channels by `amount` (-1 to +1) |
| `contrastMatrix(amount)` | Scale around midpoint 0.5 (0=gray, 1=normal, 2=max) |
| `saturationMatrix(amount)` | 0=grayscale, 1=normal, 2=vivid. Uses BT.709 luma weights |
| `hueRotateMatrix(degrees)` | Rotate hue in color space (0–360°) |
| `tintMatrix(r, g, b)` | Add constant RGB offset |
| `channelScaleMatrix(r, g, b)` | Multiply individual channels |
| `invertMatrix()` | Flip 0↔1 on RGB channels |
| `lerpMatrix(a, b, t)` | Linear interpolation between two matrices |
| `compose(...matrices)` | Chain transforms right-to-left |
| `transposeMatrix(m)` | Convert column-vector → row-vector convention |

**All matrices:** 25-element flat arrays representing 5×5 column-vector convention.

Formula: `R' = m[0]*R + m[1]*G + m[2]*B + m[3]*A + m[4]*1`

## Dark Mode Algorithm — dark-mode.js

```
invertMatrix()           ← flip brightness (white→black, black→white)
  → hueRotateMatrix(180) ← undo the color flip from inversion
  → brightnessMatrix(-0.08)
  → tintMatrix(0.04, 0.02, -0.01)  ← warm shift
  → contrastMatrix(0.88)
  → saturationMatrix(1.15)
```

Tunable params: `invertStrength`, `warmth`, `contrast`, `saturation`, `brightness`

## 12 Palettes — palettes/index.js

| ID | Type | Method |
|---|---|---|
| `dark_mode` | Essential | Invert + hue-rotate + tuning |
| `night_filter` | Essential | Blue light reduction via channelScale |
| `high_contrast` | Accessibility | Boosted contrast + saturation |
| `grayscale` | Accessibility | saturationMatrix(0) |
| `sepia` | Style | Fixed sepia tone matrix |
| `warm` | Style | channelScale + tint |
| `cool` | Style | channelScale + tint |
| `pastel` | Style | Low saturation + bright + soft tint |
| `neon` | Style | High saturation + contrast |
| `forest` | Style | Green-boosted channelScale |
| `solarized` | Style | Partial invert + warm tint |
| `custom` | Custom | Identity (no change) |

Key exports: `getPaletteById(id)`, `PALETTES`, `applyIntensity(matrix, 0.0–1.0)`

## Transition Engine — transition-engine.js

Smoothly interpolates between two matrices over time using `lerpMatrix`.

```javascript
engine.animate({
  from: identityMatrix,
  to: darkModeMatrix,
  duration: 300,         // ms
  easing: Easings.easeInOutCubic,
  onFrame(matrix) { },   // called every frame with interpolated matrix
  onComplete() { }
});
```

Easings: `linear`, `easeInOutCubic`, `easeOutQuad`, `easeInQuad`

## Test Results

```
npm test       → 43/43 passing( added cmu tartan and mosaic)
npm run harness → Dark Mode: 8/8
```

Quality checks: white→dark bg, black→light text, WCAG AAA contrast (16.8:1), monotonic gray ramp, hue preservation (blue/red/green stay correct), minimal clipping.

---

## Integration With Other Persons

### Data Flow

```
Person A (UI)          Person D (you)         Person C (C++ addon)      Windows
─────────────         ────────────────        ──────────────────        ───────
User clicks           getPaletteById()        NativeBridge              GPU
"Dark Mode"    →      returns 25-number  →    .applyMatrix(matrix) →   applies to
button                array                   calls C++ addon          every pixel
```

### How to Uses Code(for vision part Person C)

```javascript
// Person C's native-bridge.js calls transposeMatrix() before sending to GPU
// because Windows Magnification API uses row-vector convention

const { transposeMatrix } = require('../shared/matrix-ops');

applyMatrix(matrix) {
  const transposed = transposeMatrix(matrix);  // column→row convention
  addon.applyColorMatrix(new Float32Array(transposed));
}
```

### How Person A/B Uses Code

```javascript
// Person A's React UI or Person B's IPC handler
const { getPaletteById, applyIntensity } = require('../shared/palettes');
const { TransitionEngine, Easings } = require('../shared/transition-engine');

// Apply palette
const dm = getPaletteById('dark_mode'); //this is call mode name
const matrix = applyIntensity(dm.matrix, 0.8);  // this call function to call the Intensity(how much you want to apply)
NativeBridge.applyMatrix(matrix);

// Smooth transition
engine.animate({
  from: currentMatrix,
  to: matrix,
  duration: 300,
  easing: Easings.easeInOutCubic,
  onFrame(m) { NativeBridge.applyMatrix(m); }
});

// List palettes for UI
const { PALETTES } = require('../shared/palettes');
// → [{id, name, category, matrix}, ...]
```

### Convention Agreement

| Item | Person D (you) | Person C |
|---|---|---|
| Matrix format | 25-element flat array | Same |
| Convention | Column-vector | Transposes to row-vector before GPU call |
| Values range | 0.0 – 1.0 | Same |
| Identity | `[1,0,0,0,0, 0,1,0,0,0, ...]` | Same |

- Person C delivers working `NativeBridge.applyMatrix()`. You plug your matrices in → screen actually changes.

