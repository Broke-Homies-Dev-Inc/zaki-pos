import { contextBridge, ipcRenderer } from 'electron';

// We are exposing a secure API to the renderer process (your React app)
// We can add functions here later for printing, etc.
contextBridge.exposeInMainWorld('electronAPI', {
  // Example:
  // ping: () => ipcRenderer.invoke('ping'),
});