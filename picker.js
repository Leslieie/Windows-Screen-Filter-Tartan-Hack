const { desktopCapturer, ipcRenderer } = require('electron');

async function loadWindows() {
  const sources = await desktopCapturer.getSources({ 
    types: ['window'],
    thumbnailSize: { width: 150, height: 150 }
  });

  const container = document.getElementById('windows');
  
  sources.forEach(source => {
    const div = document.createElement('div');
    div.className = 'window-item';
    div.innerHTML = `<strong>${source.name}</strong>`;
    div.onclick = () => selectWindow(source);
    container.appendChild(div);
  });
}

function selectWindow(source) {
  // Send window info to main process
  ipcRenderer.send('window-selected', {
    name: source.name,
    id: source.id,
    x: 100, // You'll need to get actual position
    y: 100,
    width: 800,
    height: 600
  });
}

loadWindows();