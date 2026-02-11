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

## Installer Return Codes
Use this section as installer handling documentation URL for app portals.

Silent install switch (NSIS): `/S`

| Scenario | Return code |
|---|---:|
| Installation successful | `0` |
| Installation cancelled by user | `2` |
| Application already exists | `0` |
| Installation already in progress | `1223` |
| Disk space is full | `112` |
| Reboot required | `3010` |
| Network failure | `12029` |
| Package rejected during installation (policy) | `1625` |
| Miscellaneous install failure | `1` |

Notes:
- NSIS/electron installs can collapse many failures to `1`.
- “Application already exists” is typically treated as success/upgrade and returns `0`.
