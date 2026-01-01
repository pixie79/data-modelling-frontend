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
      showOpenDialog: (options: OpenDialogOptions) => Promise<OpenDialogReturnValue>;
      showSaveDialog: (options: SaveDialogOptions) => Promise<SaveDialogReturnValue>;
      openExternal: (url: string) => Promise<void>;
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
 * Electron platform detection
 */
export function isElectronPlatform(): boolean {
  return getPlatform() === 'electron';
}

