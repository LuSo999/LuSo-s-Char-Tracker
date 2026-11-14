// The bridge the renderer gets as window.luso (no Node access in the page itself).
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('luso', {
  keyStatus: () => ipcRenderer.invoke('key:status'),
  setKey: (key) => ipcRenderer.invoke('key:set', key),
  clearKey: () => ipcRenderer.invoke('key:clear'),
  listTemplates: () => ipcRenderer.invoke('templates:list'),
  saveTemplate: (template, pdf) => ipcRenderer.invoke('templates:save', template, pdf),
  deleteTemplate: (id) => ipcRenderer.invoke('templates:delete', id),
  templatePdf: (id) => ipcRenderer.invoke('templates:pdf', id),
  saveFile: (name, data, filters) => ipcRenderer.invoke('file:save', name, data, filters),
  claude: (req) => ipcRenderer.invoke('claude:run', req),
  cancelClaude: () => ipcRenderer.invoke('claude:cancel'),
})
