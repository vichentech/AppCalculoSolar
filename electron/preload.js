import { contextBridge, ipcRenderer } from 'electron';

// Expose safe APIs to the renderer process if needed
contextBridge.exposeInMainWorld('electronAPI', {
  // Example:
  // sendMessage: (message) => ipcRenderer.send('message', message),
});
