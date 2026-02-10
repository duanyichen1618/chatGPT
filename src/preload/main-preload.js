const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mainApi', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  setPaused: (paused) => ipcRenderer.invoke('set-paused', paused),
  toggleAutoLaunch: (enabled) => ipcRenderer.invoke('toggle-auto-launch', enabled),
  openListenerWindow: () => ipcRenderer.invoke('open-listener-window'),
  toggleDevtools: () => ipcRenderer.invoke('toggle-devtools', 'main'),
  onCountdown: (callback) => ipcRenderer.on('countdown', (_, payload) => callback(payload)),
  onLog: (callback) => ipcRenderer.on('runtime-log', (_, line) => callback(line))
});
