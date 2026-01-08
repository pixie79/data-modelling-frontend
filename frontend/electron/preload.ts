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

  // ============================================================================
  // DuckDB-related operations
  // ============================================================================

  /**
   * Export database data to a native file
   */
  duckdbExport: async (options: {
    data: ArrayBuffer | string;
    defaultPath?: string;
    format: 'json' | 'csv' | 'duckdb';
  }): Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }> => {
    return await ipcRenderer.invoke('duckdb:export', options);
  },

  /**
   * Import database file from native filesystem
   */
  duckdbImport: async (options?: {
    formats?: ('json' | 'csv' | 'duckdb')[];
  }): Promise<{
    success: boolean;
    filePath?: string;
    format?: 'json' | 'csv' | 'duckdb' | 'unknown';
    content?: string;
    size?: number;
    canceled?: boolean;
    error?: string;
  }> => {
    return await ipcRenderer.invoke('duckdb:import', options || {});
  },

  /**
   * Get database file info
   */
  duckdbFileInfo: async (
    filePath: string
  ): Promise<{
    success: boolean;
    size?: number;
    created?: string;
    modified?: string;
    isFile?: boolean;
    error?: string;
  }> => {
    return await ipcRenderer.invoke('duckdb:file-info', filePath);
  },

  /**
   * Check if database file exists
   */
  duckdbFileExists: async (filePath: string): Promise<boolean> => {
    return await ipcRenderer.invoke('duckdb:file-exists', filePath);
  },

  /**
   * Delete a database file
   */
  duckdbDeleteFile: async (filePath: string): Promise<{ success: boolean; error?: string }> => {
    return await ipcRenderer.invoke('duckdb:delete-file', filePath);
  },

  /**
   * Create a backup of a database file
   */
  duckdbBackup: async (options: {
    sourcePath: string;
    backupPath?: string;
  }): Promise<{ success: boolean; backupPath?: string; error?: string }> => {
    return await ipcRenderer.invoke('duckdb:backup', options);
  },
});
