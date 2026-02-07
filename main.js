const { app, BrowserWindow, desktopCapturer, ipcMain } = require('electron');
const windowManager = require('node-window-manager').windowManager;

let overlayWin;
let pickerWin;
let trackingInterval = null;

// Handle request for window list
ipcMain.on('get-sources', async (event) => {
  const sources = await desktopCapturer.getSources({ types: ['window'] });
  event.reply('sources-list', sources);
});

// Handle window selection
ipcMain.on('window-selected', (event, windowInfo) => {
  createOverlay(windowInfo);
  // pickerWin.close();
});

// Handle filter selection
ipcMain.on('filter_select', (event, filter_type) => {
  console.log(filter_type);
});

// handle screenshots
ipcMain.on('take-screenshot', async (event, windowInfo) => {
  const sources = await desktopCapturer.getSources({ 
    types: ['window'],
    thumbnailSize: { width: 1920, height: 1080 }
    // thumbnailSize: { width: 800, height: 600 } 
  });
  const targetSource = sources.find(s => s.name === windowInfo.name);
  
  if (targetSource) {
    const screenshot = targetSource.thumbnail.toDataURL();
    event.reply('screenshot-ready', screenshot);
  }
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
  
  // Close overlay when picker window closes
  pickerWin.on('closed', () => {
    if (trackingInterval) {
      clearInterval(trackingInterval);
      trackingInterval = null;
    }
    
    if (overlayWin && !overlayWin.isDestroyed()) {
      overlayWin.close();
    }
    
    pickerWin = null;
  });
});

function createOverlay(windowInfo) {
  // Clean up any existing interval
  if (trackingInterval) {
    clearInterval(trackingInterval);
    trackingInterval = null;
  }
  
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

  overlayWin.webContents.on('did-finish-load', () => {
    overlayWin.webContents.send('window-info', windowInfo);
  });

  overlayWin.setIgnoreMouseEvents(true, { forward: true });
  
  // Clean up interval when overlay closes
  overlayWin.on('closed', () => {
    if (trackingInterval) {
      clearInterval(trackingInterval);
      trackingInterval = null;
    }
    overlayWin = null;
  });
  
  // Track window movement
  if (targetWindow) {
    trackingInterval = setInterval(() => {
      if (!overlayWin || overlayWin.isDestroyed()) {
        clearInterval(trackingInterval);
        trackingInterval = null;
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