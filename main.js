const { app, BrowserWindow, desktopCapturer, ipcMain } = require('electron');
const windowManager = require('node-window-manager').windowManager;

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
});

function createOverlay(windowInfo) {
  // Get actual window bounds
  const windows = windowManager.getWindows();
  const targetWindow = windows.find(w => w.getTitle() === windowInfo.name);
  
  let bounds = { x: 100, y: 100, width: 1000, height: 700 }; // fallback
  
  if (targetWindow) {
    const winBounds = targetWindow.getBounds();
    bounds = {
      x: winBounds.x,
      y: winBounds.y,
      width: winBounds.width,
      height: winBounds.height
    };
  }

  overlayWin = new BrowserWindow({
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    hasShadow: false,
    focusable: false,
    skipTaskbar: true,
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  overlayWin.loadFile('overlay.html');
  overlayWin.setIgnoreMouseEvents(true, { forward: true });
  
  // Track window movement
  if (targetWindow) {
    const interval = setInterval(() => {
      if (!overlayWin || overlayWin.isDestroyed()) {
        clearInterval(interval);
        return;
      }
      
      const newBounds = targetWindow.getBounds();
      overlayWin.setBounds({
        x: newBounds.x,
        y: newBounds.y,
        width: newBounds.width,
        height: newBounds.height
      });
    }, 100); // Update every 100ms
  }
}