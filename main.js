const { app, BrowserWindow, desktopCapturer, ipcMain, screen } = require('electron');
const visionAPI = require('./src/shared/vision-api');

let overlayWin;
let pickerWin;

// ============================================================
// Wire vision-api → overlay: when matrix changes, push to overlay
// ============================================================
visionAPI.setOnMatrixChange((matrix) => {
  if (overlayWin && !overlayWin.isDestroyed()) {
    overlayWin.webContents.send('apply-matrix', matrix);
  }
});

// ============================================================
// IPC: Palette control (called from picker UI)
// ============================================================

ipcMain.handle('get-palettes', () => {
  return visionAPI.getPalettes();
});

ipcMain.on('apply-palette', (event, { paletteId, intensity }) => {
  visionAPI.applyPalette(paletteId, intensity ?? 1.0);
});

ipcMain.on('transition-palette', (event, { paletteId, intensity, duration }) => {
  visionAPI.transitionTo(paletteId, intensity ?? 1.0, duration ?? 400);
});

ipcMain.on('apply-raw-matrix', (event, matrix) => {
  visionAPI.applyRawMatrix(matrix);
});

ipcMain.on('reset-palette', () => {
  visionAPI.reset();
});

// ============================================================
// IPC: Screenshot capture for overlay mode
// ============================================================

ipcMain.on('take-screenshot-fullscreen', async (event) => {
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: 1920, height: 1080 }
  });
  if (sources.length > 0) {
    event.reply('screenshot-ready', sources[0].thumbnail.toDataURL());
  }
});

ipcMain.on('take-screenshot', async (event, windowInfo) => {
  const sources = await desktopCapturer.getSources({
    types: ['window'],
    thumbnailSize: { width: 1920, height: 1080 }
  });
  const targetSource = sources.find(s => s.name === windowInfo.name);
  if (targetSource) {
    event.reply('screenshot-ready', targetSource.thumbnail.toDataURL());
  }
});

ipcMain.on('get-sources', async (event) => {
  const sources = await desktopCapturer.getSources({ types: ['window'] });
  event.reply('sources-list', sources);
});

// ============================================================
// Window creation
// ============================================================

app.whenReady().then(() => {
  pickerWin = new BrowserWindow({
    width: 520,
    height: 650,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  pickerWin.loadFile('picker.html');
});

/**
 * Full-screen overlay: captures entire screen, applies color matrix via SVG filter.
 */
function createFullScreenOverlay() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.size;

  overlayWin = new BrowserWindow({
    x: 0,
    y: 0,
    width,
    height,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    hasShadow: false,
    focusable: false,
    skipTaskbar: true,
    fullscreen: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  overlayWin.loadFile('overlay.html');

  overlayWin.webContents.on('did-finish-load', () => {
    overlayWin.webContents.send('start-fullscreen', { width, height });

    // Push current matrix if one is already active
    const current = visionAPI.getCurrentMatrix();
    const isIdentity = current.every((v, i) => {
      const row = Math.floor(i / 5), col = i % 5;
      return Math.abs(v - (row === col ? 1 : 0)) < 0.001;
    });
    if (!isIdentity) {
      overlayWin.webContents.send('apply-matrix', current);
    }
  });

  overlayWin.setIgnoreMouseEvents(true, { forward: true });
}

ipcMain.on('start-fullscreen-mode', () => {
  if (!overlayWin || overlayWin.isDestroyed()) {
    createFullScreenOverlay();
  }
});

ipcMain.on('stop-overlay', () => {
  visionAPI.reset();
  if (overlayWin && !overlayWin.isDestroyed()) {
    overlayWin.close();
    overlayWin = null;
  }
});

app.on('before-quit', () => visionAPI.shutdown());
app.on('window-all-closed', () => {
  visionAPI.shutdown();
  app.quit();
});
