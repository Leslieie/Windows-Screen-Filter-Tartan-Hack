const { app, BrowserWindow, desktopCapturer, ipcMain, screen } = require('electron');
const windowManager = require('node-window-manager').windowManager;
const visionAPI = require('./src/shared/vision-api');

let pickerWin = null;
let overlayWin = null;
let trackingInterval = null;

// ─────────────────────────────────────────────────────────────────
// Wire vision-api → overlay (only used in overlay/fallback mode)
// In native mode, the GPU does everything — no overlay needed.
// ─────────────────────────────────────────────────────────────────
visionAPI.setOnMatrixChange((matrix) => {
  if (overlayWin && !overlayWin.isDestroyed()) {
    overlayWin.webContents.send('apply-matrix', matrix);
  }
});

// ─────────────────────────────────────────────────────────────────
// IPC: Palette control
// ─────────────────────────────────────────────────────────────────

ipcMain.handle('get-palettes', () => visionAPI.getPalettes());
ipcMain.handle('get-backend', () => visionAPI.getBackend());

ipcMain.on('apply-palette', (_, { paletteId, intensity }) => {
  visionAPI.applyPalette(paletteId, intensity ?? 1.0);
});

ipcMain.on('transition-palette', (_, { paletteId, intensity, duration }) => {
  visionAPI.transitionTo(paletteId, intensity ?? 1.0, duration ?? 400);
});

ipcMain.on('apply-raw-matrix', (_, matrix) => {
  visionAPI.applyRawMatrix(matrix);
});

ipcMain.on('reset-palette', () => {
  visionAPI.reset();
  destroyOverlay();
});

// ─────────────────────────────────────────────────────────────────
// IPC: Native mode — just apply, no overlay needed
// ─────────────────────────────────────────────────────────────────

ipcMain.on('activate-native', (_, { paletteId, intensity }) => {
  // In native mode, just apply the palette. The DWM handles the rest.
  visionAPI.transitionTo(paletteId, intensity ?? 1.0, 400);
});

// ─────────────────────────────────────────────────────────────────
// IPC: Overlay mode — per-window targeting (fallback)
// ─────────────────────────────────────────────────────────────────

ipcMain.on('get-sources', async (event) => {
  const sources = await desktopCapturer.getSources({ types: ['window'] });
  event.reply('sources-list', sources);
});

ipcMain.on('start-window-overlay', (_, windowInfo) => {
  createWindowOverlay(windowInfo);
});

// Per-window screenshot (only the target window, much smaller data)
ipcMain.on('take-screenshot', async (event, windowInfo) => {
  const sources = await desktopCapturer.getSources({
    types: ['window'],
    thumbnailSize: { width: windowInfo.width || 1280, height: windowInfo.height || 720 }
  });
  const target = sources.find(s => s.name === windowInfo.name);
  if (target) {
    event.reply('screenshot-ready', target.thumbnail.toDataURL());
  }
});

ipcMain.on('stop-overlay', () => {
  visionAPI.reset();
  destroyOverlay();
});

// ─────────────────────────────────────────────────────────────────
// Window creation
// ─────────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  pickerWin = new BrowserWindow({
    width: 540,
    height: 700,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  pickerWin.loadFile('picker.html');
});

/**
 * Per-window overlay: positioned exactly over the target window.
 * Only captures that one window → much less data than full screen.
 */
function createWindowOverlay(windowInfo) {
  destroyOverlay(); // clean up any existing

  // Get actual window bounds via node-window-manager
  const windows = windowManager.getWindows();
  const targetWindow = windows.find(w => w.getTitle() === windowInfo.name);

  let bounds = { x: 100, y: 100, width: 1000, height: 700 };
  if (targetWindow) {
    const wb = targetWindow.getBounds();
    bounds = { x: wb.x, y: wb.y, width: wb.width, height: wb.height };
  }

  overlayWin = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    hasShadow: false,
    focusable: false,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  overlayWin.loadFile('overlay.html');
  overlayWin.setIgnoreMouseEvents(true, { forward: true });

  overlayWin.webContents.on('did-finish-load', () => {
    overlayWin.webContents.send('start-window-capture', {
      ...windowInfo,
      width: bounds.width,
      height: bounds.height,
    });

    // Push current matrix
    const current = visionAPI.getCurrentMatrix();
    overlayWin.webContents.send('apply-matrix', current);
  });

  // Track the target window's position
  if (targetWindow) {
    trackingInterval = setInterval(() => {
      if (!overlayWin || overlayWin.isDestroyed()) {
        clearInterval(trackingInterval);
        return;
      }
      try {
        const nb = targetWindow.getBounds();
        overlayWin.setBounds({ x: nb.x, y: nb.y, width: nb.width, height: nb.height });
      } catch (e) {
        // Window may have been closed
        destroyOverlay();
      }
    }, 200);
  }
}

function destroyOverlay() {
  if (trackingInterval) {
    clearInterval(trackingInterval);
    trackingInterval = null;
  }
  if (overlayWin && !overlayWin.isDestroyed()) {
    overlayWin.close();
  }
  overlayWin = null;
}

// ─────────────────────────────────────────────────────────────────
// Cleanup
// ─────────────────────────────────────────────────────────────────

app.on('before-quit', () => {
  visionAPI.shutdown();
  destroyOverlay();
});

app.on('window-all-closed', () => {
  visionAPI.shutdown();
  app.quit();
});
