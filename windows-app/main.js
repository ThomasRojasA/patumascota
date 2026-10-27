import { app, BrowserWindow, dialog } from 'electron';

const appUrl = 'https://pa-la-mascota.onrender.com/';
const appOrigin = new URL(appUrl).origin;

function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 650,
    backgroundColor: '#f8fbfd',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  window.webContents.on('will-navigate', (event, url) => {
    if (!URL.canParse(url) || new URL(url).origin !== appOrigin) {
      event.preventDefault();
    }
  });

  window.loadURL(appUrl).catch(error => {
    console.error('No se pudo cargar Pa la mascota:', error);
    if (!window.isDestroyed()) {
      dialog.showErrorBox(
        'No se pudo conectar',
        'Verifica tu conexión a internet e inténtalo nuevamente. El servicio puede tardar en iniciar después de un período sin actividad.'
      );
    }
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
