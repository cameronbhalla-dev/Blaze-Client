const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('blaze', {
  getInfo: () => ipcRenderer.invoke('blaze:get-info'),
  openFolder: which => ipcRenderer.invoke('blaze:open-folder', which),
  createProfile: name => ipcRenderer.invoke('blaze:create-profile', name),
  listProfiles: () => ipcRenderer.invoke('blaze:list-profiles'),
  scanInstance: profile => ipcRenderer.invoke('blaze:scan-instance', profile),
  modrinthSearch: args => ipcRenderer.invoke('blaze:modrinth-search', args),
  modrinthInstall: args => ipcRenderer.invoke('blaze:modrinth-install', args)
});
