const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const visionAPI = require('./src/shared/vision-api');

let pickerWin = null;

// ── Profile persistence ─────────────────────────────────────────
const profilePath = () => path.join(app.getPath('userData'), 'filter-profiles.json');

function loadProfiles() {
  try {
    return JSON.parse(fs.readFileSync(profilePath(), 'utf8'));
  } catch { return {}; }
}

function saveProfiles(profiles) {
  fs.writeFileSync(profilePath(), JSON.stringify(profiles, null, 2), 'utf8');
}

// ── Info queries ─────────────────────────────────────────────────
ipcMain.handle('get-palettes', () => visionAPI.getPalettes());
ipcMain.handle('is-native', () => visionAPI.isNativeAvailable());
ipcMain.handle('get-windows', () => visionAPI.getVisibleWindows());
ipcMain.handle('get-per-app-fps', () => visionAPI.getPerAppTargetFps());
ipcMain.handle('set-per-app-fps', (_, fps) => visionAPI.setPerAppTargetFps(fps));

// ── Fullscreen mode ──────────────────────────────────────────────
ipcMain.on('activate-fullscreen', (_, { paletteId, intensity, customRgb }) => {
  visionAPI.activateFullscreen();
  visionAPI.transitionTo(paletteId, intensity ?? 1.0, 400, customRgb ?? null);
});

ipcMain.on('transition-palette', (_, { paletteId, intensity, duration, customRgb }) => {
  visionAPI.transitionTo(paletteId, intensity ?? 1.0, duration ?? 300, customRgb ?? null);
});

// ── Per-window multi-filter mode ─────────────────────────────────
ipcMain.handle('apply-per-window-filter', (_, { hwnd, paletteId, intensity, processName, title, customRgb }) => {
  return visionAPI.applyPerWindowFilter(hwnd, paletteId, intensity, processName, title, customRgb ?? null);
});

ipcMain.on('update-per-window-filter', (_, { filterId, paletteId, intensity, customRgb }) => {
  visionAPI.updatePerWindowFilter(filterId, paletteId, intensity, customRgb ?? null);
});

ipcMain.on('remove-per-window-filter', (_, { filterId }) => {
  visionAPI.removePerWindowFilter(filterId);
});

ipcMain.handle('get-active-filters', () => visionAPI.getActiveFilters());

// ── Stop all ─────────────────────────────────────────────────────
ipcMain.on('reset', () => visionAPI.reset());

// ── Profile persistence IPC ──────────────────────────────────────
ipcMain.handle('load-filter-profiles', () => loadProfiles());

ipcMain.handle('save-filter-profiles', (_, profiles) => {
  saveProfiles(profiles);
  return true;
});

// ── App lifecycle ────────────────────────────────────────────────
app.whenReady().then(() => {
  pickerWin = new BrowserWindow({
    width: 540, height: 820,
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });
  pickerWin.loadFile('picker.html');
});

app.on('before-quit', () => visionAPI.shutdown());
app.on('window-all-closed', () => { visionAPI.shutdown(); app.quit(); });
