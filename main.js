const { app, BrowserWindow, desktopCapturer, ipcMain } = require('electron');

let overlayWin;
let pickerWin;

// Handle request for window list
ipcMain.on('get-sources', async (event) => {
  const sources = await desktopCapturer.getSources({ types: ['window'] });
  event.reply('sources-list', sources);
});

// Handle window selection
ipcMain.on('window-selected', (event, windowInfo) => {
  createOverlay(windowInfo);
  pickerWin.close();
});

app.whenReady().then(() => {
  // Create picker window
  pickerWin = new BrowserWindow({
    width: 500,
    height: 400,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  pickerWin.loadFile('picker.html');
  // pickerWin.webContents.openDevTools(); // Debug console
});

function createOverlay(windowInfo) {
  overlayWin = new BrowserWindow({
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    hasShadow: false,
    focusable: false,
    skipTaskbar: true,
    x: windowInfo.x,
    y: windowInfo.y,
    width: windowInfo.width,
    height: windowInfo.height,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  overlayWin.loadFile('overlay.html');
  overlayWin.setIgnoreMouseEvents(true, { forward: true });
}