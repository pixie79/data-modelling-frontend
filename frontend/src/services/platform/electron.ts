/**
 * Electron-specific platform implementations
 */

import { getPlatform } from './platform';

// Electron dialog options types
export interface OpenDialogOptions {
  title?: string;
  defaultPath?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
  properties?: Array<'openFile' | 'openDirectory' | 'multiSelections'>;
}

export interface SaveDialogOptions {
  title?: string;
  defaultPath?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
}

export interface OpenDialogReturnValue {
  canceled: boolean;
  filePaths: string[];
}

export interface SaveDialogReturnValue {
  canceled: boolean;
  filePath?: string;
}

declare global {
  interface Window {
    electronAPI?: {
      readFile: (path: string) => Promise<string>;
      writeFile: (path: string, data: string) => Promise<void>;
      ensureDirectory: (path: string) => Promise<boolean>;
      readDirectory: (path: string) => Promise<Array<{ name: string; path: string }>>;
      deleteFile: (path: string) => Promise<void>;
      showOpenDialog: (options: OpenDialogOptions) => Promise<OpenDialogReturnValue>;
      showSaveDialog: (options: SaveDialogOptions) => Promise<SaveDialogReturnValue>;
      openExternal: (url: string) => Promise<void>;
      closeApp: () => Promise<void>;
    };
  }
}

/**
 * Electron file operations using native file system
 */
export const electronFileService = {
  /**
   * Read file using Electron API
   */
  async readFile(path: string): Promise<string> {
    if (!window.electronAPI) {
      throw new Error('Electron API not available');
    }
    return window.electronAPI.readFile(path);
  },

  /**
   * Write file using Electron API
   */
  async writeFile(path: string, data: string): Promise<void> {
    if (!window.electronAPI) {
      throw new Error('Electron API not available');
    }
    return window.electronAPI.writeFile(path, data);
  },

  /**
   * Ensure directory exists (create if it doesn't)
   */
  async ensureDirectory(path: string): Promise<boolean> {
    if (!window.electronAPI) {
      throw new Error('Electron API not available');
    }
    return window.electronAPI.ensureDirectory(path);
  },

  /**
   * Read directory contents
   */
  async readDirectory(path: string): Promise<Array<{ name: string; path: string }>> {
    if (!window.electronAPI) {
      throw new Error('Electron API not available');
    }
    return window.electronAPI.readDirectory(path);
  },

  /**
   * Delete a file
   */
  async deleteFile(path: string): Promise<void> {
    if (!window.electronAPI) {
      throw new Error('Electron API not available');
    }
    return window.electronAPI.deleteFile(path);
  },

  /**
   * Show open file dialog
   */
  async showOpenDialog(options: OpenDialogOptions): Promise<OpenDialogReturnValue> {
    if (!window.electronAPI) {
      throw new Error('Electron API not available');
    }
    return window.electronAPI.showOpenDialog(options);
  },

  /**
   * Show save file dialog
   */
  async showSaveDialog(options: SaveDialogOptions): Promise<SaveDialogReturnValue> {
    if (!window.electronAPI) {
      throw new Error('Electron API not available');
    }
    return window.electronAPI.showSaveDialog(options);
  },
};

/**
 * Close the Electron application
 */
export async function closeElectronApp(): Promise<void> {
  if (!window.electronAPI) {
    throw new Error('Electron API not available. Please ensure you are running in Electron.');
  }
  
  // Check if closeApp function exists
  if (typeof window.electronAPI.closeApp !== 'function') {
    console.error('[closeElectronApp] closeApp function not found on electronAPI. Available methods:', Object.keys(window.electronAPI));
    throw new Error('closeApp function not available. The Electron preload script may need to be rebuilt. Run: npm run build:electron');
  }
  
  return window.electronAPI.closeApp();
}

/**
 * Electron platform detection
 */
export function isElectronPlatform(): boolean {
  return getPlatform() === 'electron';
}

