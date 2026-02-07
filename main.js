const { app, BrowserWindow, desktopCapturer } = require('electron');

app.whenReady().then(() => {
  const win = new BrowserWindow({
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  
  win.loadFile('index.html');
});