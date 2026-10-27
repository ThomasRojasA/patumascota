import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { appendFile, mkdir, rename, rm, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sanitizeLogEvent } from './log-utils.js';

app.setName('Pa la mascota');

const appUrl = 'https://pa-la-mascota.onrender.com/';
const appOrigin = new URL(appUrl).origin;
const logDirectory = join(app.getPath('appData'), 'Pa la mascota', 'logs');
const logFile = join(logDirectory, 'api.log');
const archivedLogFile = `${logFile}.1`;
const maxLogSize = 5 * 1024 * 1024;
let logWriteQueue = Promise.resolve();

app.setPath('userData', join(app.getPath('appData'), 'Pa la mascota'));

function isTrustedSender(event) {
  return Boolean(event.senderFrame && URL.canParse(event.senderFrame.url)) &&
    new URL(event.senderFrame.url).origin === appOrigin;
}

async function appendLogEntry(event) {
  await mkdir(logDirectory, { recursive: true });
  try {
    if ((await stat(logFile)).size >= maxLogSize) {
      await rm(archivedLogFile, { force: true });
      await rename(logFile, archivedLogFile);
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const entry = sanitizeLogEvent(event);
  await appendFile(logFile, `${JSON.stringify(entry)}\n`, 'utf8');
}

function queueLogEntry(event) {
  const write = logWriteQueue.then(() => appendLogEntry(event));
  logWriteQueue = write.catch(() => {});
  return write;
}

ipcMain.handle('desktop:log-api-event', (event, payload) => {
  if (!isTrustedSender(event)) throw new Error('Origen no autorizado para escribir registros.');
  return queueLogEntry(payload);
});

ipcMain.handle('desktop:open-logs-folder', async event => {
  if (!isTrustedSender(event)) throw new Error('Origen no autorizado para abrir los registros.');
  await mkdir(logDirectory, { recursive: true });
  const error = await shell.openPath(dirname(logFile));
  if (error) throw new Error(error);
});

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
      sandbox: true,
      preload: fileURLToPath(new URL('./preload.cjs', import.meta.url))
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
  void queueLogEntry({ type: 'desktop', event: 'started' }).catch(error => {
    console.error('No se pudo iniciar el registro local:', error);
    dialog.showErrorBox('Registro local no disponible', `No se pudo crear el registro de actividad: ${error.message}`);
  });
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
