const { app, BrowserWindow, ipcMain } = require('electron');
const visionAPI = require('./src/shared/vision-api');

let pickerWin = null;

// ── Info queries ─────────────────────────────────────────────────
ipcMain.handle('get-palettes', () => visionAPI.getPalettes());
ipcMain.handle('is-native', () => visionAPI.isNativeAvailable());
ipcMain.handle('get-windows', () => visionAPI.getVisibleWindows());

// ── Activate modes ───────────────────────────────────────────────
ipcMain.on('activate-fullscreen', (_, { paletteId, intensity }) => {
  visionAPI.activateFullscreen();
  visionAPI.transitionTo(paletteId, intensity ?? 1.0, 400);
});

ipcMain.on('activate-for-app', (_, { hwnd, paletteId, intensity }) => {
  visionAPI.activateForApp(hwnd);
  visionAPI.transitionTo(paletteId, intensity ?? 1.0, 400);
});

// ── Live updates (while active) ──────────────────────────────────
ipcMain.on('transition-palette', (_, { paletteId, intensity, duration }) => {
  visionAPI.transitionTo(paletteId, intensity ?? 1.0, duration ?? 300);
});

// ── Stop ─────────────────────────────────────────────────────────
ipcMain.on('reset', () => visionAPI.reset());

// ── App lifecycle ────────────────────────────────────────────────
app.whenReady().then(() => {
  pickerWin = new BrowserWindow({
    width: 540, height: 720,
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });
  pickerWin.loadFile('picker.html');
});

app.on('before-quit', () => visionAPI.shutdown());
app.on('window-all-closed', () => { visionAPI.shutdown(); app.quit(); });

