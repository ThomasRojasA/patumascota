const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('palaMascotaDesktop', {
  logApiEvent: event => ipcRenderer.invoke('desktop:log-api-event', event),
  openLogsFolder: () => ipcRenderer.invoke('desktop:open-logs-folder')
});
