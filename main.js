const { app, BrowserWindow } = require('electron');

let targetWin;
let overlayWin;

app.whenReady().then(() => {
  targetWin = new BrowserWindow({
    width: 800,
    height: 600
  });

  targetWin.loadURL('https://example.com');

  overlayWin = new BrowserWindow({
    parent: targetWin,
    transparent: true,
    frame: false,
    alwaysOnTop: false,
    hasShadow: false,
    focusable: false,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  overlayWin.loadFile('index.html');

  // Click-through
  overlayWin.setIgnoreMouseEvents(true, { forward: true });

  const syncOverlay = () => {
    const bounds = targetWin.getBounds();
    overlayWin.setBounds(bounds);
  };

  // Initial sync
  syncOverlay();

  // Keep in sync
  targetWin.on('move', syncOverlay);
  targetWin.on('resize', syncOverlay);
});