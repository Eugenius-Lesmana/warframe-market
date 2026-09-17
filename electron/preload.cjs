const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("market", {
  analyze: (url) => ipcRenderer.invoke("market:analyze", url),
  sniperAdd: (watch) => ipcRenderer.invoke("market:sniper-add", watch),
  sniperList: () => ipcRenderer.invoke("market:sniper-list"),
  sniperRemove: (id) => ipcRenderer.invoke("market:sniper-remove", id),
  open: (url) => ipcRenderer.invoke("market:open", url),
  copy: (text) => ipcRenderer.invoke("market:copy", text),
  onSniperUpdate: (callback) => { const listener = (_event, watches) => callback(watches); ipcRenderer.on("market:sniper-update", listener); return () => ipcRenderer.removeListener("market:sniper-update", listener); },
});
