# ScreenTint
Windows screen filter app with:
- Fullscreen color filters
- Per-app filters
- Custom RGB palette

## Run locally
```bash
npm install
npm run build:native
npm start
```

## Rebuild native addon (after C++ changes)
```bash
npm run build:native
```

## Package as `.exe` installer (Windows)
This project does not yet include a packager. Fastest path is `electron-builder`:

```bash
npm install -D electron-builder
```

Add this to `package.json`:
```json
{
  "scripts": {
    "dist": "electron-builder --win nsis"
  },
  "build": {
    "appId": "com.screentint.app",
    "productName": "ScreenTint",
    "files": ["**/*", "!bin/**"],
    "asarUnpack": ["build/Release/*.node"],
    "win": { "target": "nsis" }
  }
}
```

Then build installer:
```bash
npm run dist
```

Installer output will be in `dist/`.
