// The bridge the web app gets as window.luso (no Node access in the page itself). Only the web
// app's own pages get it; the main process checks the sender of every call as well.
const { contextBridge, ipcRenderer } = require('electron')

// The app's version and the web app's address, from the main process.
const info = ipcRenderer.sendSync('desktop:info')

if (location.protocol === 'file:') {
  // The offline page: only its retry button.
  contextBridge.exposeInMainWorld('lusoOffline', { retry: () => ipcRenderer.send('offline:retry') })
} else if (location.origin === info.origin) {
  contextBridge.exposeInMainWorld('luso', {
    version: info.version,
    keyStatus: () => ipcRenderer.invoke('key:status'),
    setKey: (provider, key) => ipcRenderer.invoke('key:set', provider, key),
    clearKey: (provider) => ipcRenderer.invoke('key:clear', provider),
    saveFile: (name, data, filters) => ipcRenderer.invoke('file:save', name, data, filters),
    ai: (req) => ipcRenderer.invoke('ai:run', req),
    cancelAi: () => ipcRenderer.invoke('ai:cancel'),
    signIn: () => ipcRenderer.invoke('auth:signIn'),
    cancelSignIn: () => ipcRenderer.invoke('auth:cancel'),
  })
}
