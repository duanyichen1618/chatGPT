const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('listenerApi', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  applyConfigNow: () => ipcRenderer.invoke('apply-config-now'),
  pickSelector: (pageId) => ipcRenderer.invoke('pick-selector', pageId),
  getActivePages: () => ipcRenderer.invoke('get-active-pages'),
  toggleDevtools: () => ipcRenderer.invoke('toggle-devtools', 'listener'),
  onLog: (callback) => ipcRenderer.on('runtime-log', (_, line) => callback(line)),
  onConfigUpdated: (callback) => ipcRenderer.on('config-updated', (_, config) => callback(config))
});
