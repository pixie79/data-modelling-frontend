/**
 * Browser-specific platform implementations
 */

import { getPlatform } from './platform';
import JSZip from 'jszip';

/**
 * File System Access API directory handle cache
 * Stores directory handles for auto-save functionality
 */
const directoryHandleCache: Map<string, FileSystemDirectoryHandle> = new Map();

/**
 * Browser file operations using File API and File System Access API
 */
export const browserFileService = {
  /**
   * Read file using File API
   */
  async readFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          resolve(e.target.result as string);
        } else {
          reject(new Error('Failed to read file'));
        }
      };
      reader.onerror = () => reject(new Error('File read error'));
      reader.readAsText(file);
    });
  },

  /**
   * Create download link for file
   */
  downloadFile(content: string, filename: string, mimeType: string = 'text/yaml'): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  /**
   * Open file picker
   */
  async pickFile(accept: string = '.yaml,.yml,.json'): Promise<File | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = accept;
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0] || null;
        resolve(file);
      };
      input.click();
    });
  },

  /**
   * Open folder picker (directory)
   * Returns FileList with all files in the selected directory tree
   */
  async pickFolder(): Promise<FileList | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.webkitdirectory = true; // Enable directory selection
      input.onchange = (e) => {
        const files = (e.target as HTMLInputElement).files;
        resolve(files);
      };
      input.oncancel = () => {
        resolve(null);
      };
      input.click();
    });
  },

  /**
   * Request directory access using File System Access API
   * Returns a directory handle that can be used for saving files
   */
  async requestDirectoryAccess(workspaceName: string): Promise<FileSystemDirectoryHandle | null> {
    // Check if File System Access API is supported
    if (!('showDirectoryPicker' in window)) {
      console.warn('[BrowserFileService] File System Access API not supported');
      return null;
    }

    try {
      const handle = await (window as any).showDirectoryPicker({
        mode: 'readwrite',
        startIn: 'documents',
      });
      
      // Cache the handle for this workspace
      directoryHandleCache.set(workspaceName, handle);
      console.log('[BrowserFileService] Directory access granted:', workspaceName);
      return handle;
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        console.log('[BrowserFileService] User cancelled directory picker');
      } else {
        console.error('[BrowserFileService] Failed to request directory access:', error);
      }
      return null;
    }
  },

  /**
   * Get cached directory handle for a workspace
   */
  getCachedDirectoryHandle(workspaceName: string): FileSystemDirectoryHandle | undefined {
    return directoryHandleCache.get(workspaceName);
  },

  /**
   * Save file to directory using File System Access API
   */
  async saveFileToDirectory(
    directoryHandle: FileSystemDirectoryHandle,
    filename: string,
    content: string,
    _mimeType: string = 'text/yaml'
  ): Promise<void> {
    try {
      // Create file handle (creates file if it doesn't exist)
      const fileHandle = await directoryHandle.getFileHandle(filename, { create: true });
      
      // Get writable stream
      const writable = await fileHandle.createWritable();
      
      // Write content
      await writable.write(content);
      
      // Close the file
      await writable.close();
      
      console.log(`[BrowserFileService] Saved file: ${filename}`);
    } catch (error) {
      console.error(`[BrowserFileService] Failed to save file ${filename}:`, error);
      throw error;
    }
  },

  /**
   * Save multiple files to a directory structure
   * Creates subdirectories as needed
   */
  async saveFilesToDirectory(
    directoryHandle: FileSystemDirectoryHandle,
    files: Array<{ path: string; content: string; mimeType?: string }>
  ): Promise<void> {
    for (const file of files) {
      const pathParts = file.path.split('/');
      let currentHandle = directoryHandle;

      // Navigate/create subdirectories
      for (let i = 0; i < pathParts.length - 1; i++) {
        const dirName = pathParts[i];
        if (!dirName) continue;
        try {
          currentHandle = await currentHandle.getDirectoryHandle(dirName, { create: true });
        } catch (error) {
          console.error(`[BrowserFileService] Failed to create directory ${dirName}:`, error);
          throw error;
        }
      }

      // Save file
      const filename = pathParts[pathParts.length - 1];
      if (!filename) {
        throw new Error('Invalid file path: missing filename');
      }
      await this.saveFileToDirectory(
        currentHandle,
        filename,
        file.content,
        file.mimeType || 'text/yaml'
      );
    }
  },

  /**
   * Create and download a ZIP file containing multiple files
   */
  async downloadZip(files: Array<{ path: string; content: string }>, zipFilename: string): Promise<void> {
    const zip = new JSZip();

    // Add all files to ZIP
    for (const file of files) {
      zip.file(file.path, file.content);
    }

    // Generate ZIP blob
    const blob = await zip.generateAsync({ type: 'blob' });
    
    // Download ZIP
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = zipFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    console.log(`[BrowserFileService] Downloaded ZIP: ${zipFilename} (${files.length} files)`);
  },
};

/**
 * Browser platform detection
 */
export function isBrowserPlatform(): boolean {
  return getPlatform() === 'browser';
}

