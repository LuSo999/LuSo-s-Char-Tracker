// The bridge the renderer gets as window.luso (no Node access in the page itself).
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('luso', {
  keyStatus: () => ipcRenderer.invoke('key:status'),
  setKey: (provider, key) => ipcRenderer.invoke('key:set', provider, key),
  clearKey: (provider) => ipcRenderer.invoke('key:clear', provider),
  listTemplates: () => ipcRenderer.invoke('templates:list'),
  saveTemplate: (template, pdf) => ipcRenderer.invoke('templates:save', template, pdf),
  deleteTemplate: (id) => ipcRenderer.invoke('templates:delete', id),
  templatePdf: (id) => ipcRenderer.invoke('templates:pdf', id),
  saveFile: (name, data, filters) => ipcRenderer.invoke('file:save', name, data, filters),
  ai: (req) => ipcRenderer.invoke('ai:run', req),
  cancelAi: () => ipcRenderer.invoke('ai:cancel'),
})
