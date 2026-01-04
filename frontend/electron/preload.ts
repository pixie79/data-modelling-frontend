import { contextBridge, ipcRenderer, shell } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // File system operations
  readFile: async (path: string): Promise<string> => {
    return await ipcRenderer.invoke('read-file', path);
  },
  writeFile: async (path: string, data: string): Promise<void> => {
    return await ipcRenderer.invoke('write-file', path, data);
  },
  ensureDirectory: async (path: string): Promise<boolean> => {
    return await ipcRenderer.invoke('ensure-directory', path);
  },
  readDirectory: async (path: string): Promise<Array<{ name: string; path: string }>> => {
    return await ipcRenderer.invoke('read-directory', path);
  },
  deleteFile: async (path: string): Promise<void> => {
    return await ipcRenderer.invoke('delete-file', path);
  },
  showOpenDialog: async (options: {
    title?: string;
    defaultPath?: string;
    filters?: Array<{ name: string; extensions: string[] }>;
    properties?: Array<'openFile' | 'openDirectory' | 'multiSelections'>;
  }): Promise<{ canceled: boolean; filePaths: string[] }> => {
    return await ipcRenderer.invoke('show-open-dialog', options);
  },
  showSaveDialog: async (options: {
    title?: string;
    defaultPath?: string;
    filters?: Array<{ name: string; extensions: string[] }>;
  }): Promise<{ canceled: boolean; filePath?: string }> => {
    return await ipcRenderer.invoke('show-save-dialog', options);
  },
  // Open external URL in system browser
  openExternal: async (url: string): Promise<void> => {
    shell.openExternal(url);
  },
  // Close the application
  closeApp: async (): Promise<void> => {
    return await ipcRenderer.invoke('close-app');
  },
});

