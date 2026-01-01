/**
 * Browser-specific platform implementations
 */

import { getPlatform } from './platform';

/**
 * Browser file operations using File API
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
};

/**
 * Browser platform detection
 */
export function isBrowserPlatform(): boolean {
  return getPlatform() === 'browser';
}

