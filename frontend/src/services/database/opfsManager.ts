/**
 * OPFS (Origin Private File System) Manager
 *
 * Manages persistent browser storage using the OPFS API.
 * Provides file operations for DuckDB database files and backup management.
 *
 * @module services/database/opfsManager
 */

import { StorageMode, checkBrowserCapabilities } from '@/types/duckdb';

/**
 * OPFS file info
 */
export interface OPFSFileInfo {
  name: string;
  size: number;
  type: 'file' | 'directory';
  lastModified?: number;
}

/**
 * OPFS storage quota info
 */
export interface OPFSQuotaInfo {
  usage: number;
  quota: number;
  usagePercent: number;
  available: number;
}

/**
 * OPFS Manager class
 */
class OPFSManager {
  private static instance: OPFSManager | null = null;
  private rootDirectory: FileSystemDirectoryHandle | null = null;
  private dataDirectory: FileSystemDirectoryHandle | null = null;
  private initialized = false;

  /** Directory name for database files within OPFS */
  private readonly DATA_DIR = 'data-modelling';

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): OPFSManager {
    if (!OPFSManager.instance) {
      OPFSManager.instance = new OPFSManager();
    }
    return OPFSManager.instance;
  }

  /**
   * Check if OPFS is supported
   */
  isSupported(): boolean {
    const capabilities = checkBrowserCapabilities();
    return capabilities.opfs;
  }

  /**
   * Initialize OPFS access
   */
  async initialize(): Promise<{ success: boolean; error?: string }> {
    if (this.initialized && this.rootDirectory) {
      return { success: true };
    }

    if (!this.isSupported()) {
      return {
        success: false,
        error: 'OPFS is not supported in this browser',
      };
    }

    try {
      // Get the root OPFS directory
      this.rootDirectory = await navigator.storage.getDirectory();

      // Create or get the data-modelling subdirectory
      this.dataDirectory = await this.rootDirectory.getDirectoryHandle(this.DATA_DIR, {
        create: true,
      });

      this.initialized = true;
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Failed to initialize OPFS: ${errorMessage}`,
      };
    }
  }

  /**
   * Get storage quota information
   */
  async getQuotaInfo(): Promise<OPFSQuotaInfo | null> {
    if (!navigator.storage || !navigator.storage.estimate) {
      return null;
    }

    try {
      const estimate = await navigator.storage.estimate();
      const usage = estimate.usage || 0;
      const quota = estimate.quota || 0;

      return {
        usage,
        quota,
        usagePercent: quota > 0 ? (usage / quota) * 100 : 0,
        available: quota - usage,
      };
    } catch {
      return null;
    }
  }

  /**
   * Request persistent storage
   */
  async requestPersistence(): Promise<boolean> {
    if (!navigator.storage || !navigator.storage.persist) {
      return false;
    }

    try {
      return await navigator.storage.persist();
    } catch {
      return false;
    }
  }

  /**
   * Check if storage is persisted
   */
  async isPersisted(): Promise<boolean> {
    if (!navigator.storage || !navigator.storage.persisted) {
      return false;
    }

    try {
      return await navigator.storage.persisted();
    } catch {
      return false;
    }
  }

  /**
   * List files in the data directory
   */
  async listFiles(): Promise<OPFSFileInfo[]> {
    if (!this.dataDirectory) {
      const initResult = await this.initialize();
      if (!initResult.success || !this.dataDirectory) {
        return [];
      }
    }

    const files: OPFSFileInfo[] = [];

    try {
      // Cast to access iterator methods not yet in TypeScript lib
      const dirHandle = this.dataDirectory as FileSystemDirectoryHandle & {
        keys(): AsyncIterableIterator<string>;
      };

      for await (const name of dirHandle.keys()) {
        try {
          // Try to get as file first
          const fileHandle = await this.dataDirectory.getFileHandle(name);
          const file = await fileHandle.getFile();
          files.push({
            name,
            size: file.size,
            type: 'file',
            lastModified: file.lastModified,
          });
        } catch {
          // If not a file, try as directory
          try {
            await this.dataDirectory.getDirectoryHandle(name);
            files.push({
              name,
              size: 0,
              type: 'directory',
            });
          } catch {
            // Skip if neither file nor directory
          }
        }
      }
    } catch (error) {
      console.error('Failed to list OPFS files:', error);
    }

    return files;
  }

  /**
   * Get a file from OPFS
   */
  async getFile(filename: string): Promise<File | null> {
    if (!this.dataDirectory) {
      const initResult = await this.initialize();
      if (!initResult.success || !this.dataDirectory) {
        return null;
      }
    }

    try {
      const fileHandle = await this.dataDirectory.getFileHandle(filename);
      return await fileHandle.getFile();
    } catch {
      return null;
    }
  }

  /**
   * Write a file to OPFS
   */
  async writeFile(
    filename: string,
    data: Blob | ArrayBuffer | string
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.dataDirectory) {
      const initResult = await this.initialize();
      if (!initResult.success || !this.dataDirectory) {
        return { success: false, error: 'OPFS not initialized' };
      }
    }

    try {
      const fileHandle = await this.dataDirectory.getFileHandle(filename, { create: true });
      const writable = await fileHandle.createWritable();

      if (typeof data === 'string') {
        await writable.write(new TextEncoder().encode(data));
      } else {
        await writable.write(data);
      }

      await writable.close();
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Delete a file from OPFS
   */
  async deleteFile(filename: string): Promise<{ success: boolean; error?: string }> {
    if (!this.dataDirectory) {
      const initResult = await this.initialize();
      if (!initResult.success || !this.dataDirectory) {
        return { success: false, error: 'OPFS not initialized' };
      }
    }

    try {
      await this.dataDirectory.removeEntry(filename);
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Check if a file exists
   */
  async fileExists(filename: string): Promise<boolean> {
    if (!this.dataDirectory) {
      const initResult = await this.initialize();
      if (!initResult.success || !this.dataDirectory) {
        return false;
      }
    }

    try {
      await this.dataDirectory.getFileHandle(filename);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the size of a file
   */
  async getFileSize(filename: string): Promise<number> {
    const file = await this.getFile(filename);
    return file?.size || 0;
  }

  /**
   * Create a backup of a file
   */
  async createBackup(
    filename: string,
    backupSuffix?: string
  ): Promise<{ success: boolean; backupName?: string; error?: string }> {
    const file = await this.getFile(filename);
    if (!file) {
      return { success: false, error: 'Source file not found' };
    }

    const timestamp = backupSuffix || new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `${filename}.backup-${timestamp}`;

    const writeResult = await this.writeFile(backupName, await file.arrayBuffer());
    if (!writeResult.success) {
      return { success: false, error: writeResult.error };
    }

    return { success: true, backupName };
  }

  /**
   * List backup files for a given filename
   */
  async listBackups(filename: string): Promise<OPFSFileInfo[]> {
    const allFiles = await this.listFiles();
    return allFiles.filter((f) => f.name.startsWith(`${filename}.backup-`) && f.type === 'file');
  }

  /**
   * Restore from a backup
   */
  async restoreBackup(
    backupName: string,
    targetName: string
  ): Promise<{ success: boolean; error?: string }> {
    const backupFile = await this.getFile(backupName);
    if (!backupFile) {
      return { success: false, error: 'Backup file not found' };
    }

    return await this.writeFile(targetName, await backupFile.arrayBuffer());
  }

  /**
   * Delete old backups, keeping only the most recent N
   */
  async pruneBackups(
    filename: string,
    keepCount: number
  ): Promise<{ success: boolean; deletedCount: number }> {
    const backups = await this.listBackups(filename);

    // Sort by lastModified descending (newest first)
    backups.sort((a, b) => (b.lastModified ?? 0) - (a.lastModified ?? 0));

    let deletedCount = 0;
    for (let i = keepCount; i < backups.length; i++) {
      const backup = backups[i];
      if (backup) {
        const result = await this.deleteFile(backup.name);
        if (result.success) {
          deletedCount++;
        }
      }
    }

    return { success: true, deletedCount };
  }

  /**
   * Get total storage used by all data-modelling files
   */
  async getTotalStorageUsed(): Promise<number> {
    const files = await this.listFiles();
    return files.reduce((total, file) => total + file.size, 0);
  }

  /**
   * Clear all data-modelling files from OPFS
   */
  async clearAll(): Promise<{ success: boolean; error?: string }> {
    if (!this.rootDirectory) {
      const initResult = await this.initialize();
      if (!initResult.success || !this.rootDirectory) {
        return { success: false, error: 'OPFS not initialized' };
      }
    }

    try {
      // Remove the entire data-modelling directory
      await this.rootDirectory.removeEntry(this.DATA_DIR, { recursive: true });

      // Recreate the empty directory
      this.dataDirectory = await this.rootDirectory.getDirectoryHandle(this.DATA_DIR, {
        create: true,
      });

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Export a file from OPFS to a downloadable Blob
   */
  async exportFile(filename: string): Promise<Blob | null> {
    const file = await this.getFile(filename);
    if (!file) {
      return null;
    }

    return new Blob([await file.arrayBuffer()], { type: file.type });
  }

  /**
   * Import a file into OPFS
   */
  async importFile(filename: string, blob: Blob): Promise<{ success: boolean; error?: string }> {
    return await this.writeFile(filename, await blob.arrayBuffer());
  }

  /**
   * Get the storage mode based on OPFS availability
   */
  getStorageMode(): StorageMode {
    return this.isSupported() ? StorageMode.OPFS : StorageMode.Memory;
  }
}

/**
 * Get the OPFS manager singleton
 */
export function getOPFSManager(): OPFSManager {
  return OPFSManager.getInstance();
}

/**
 * Export the manager class for testing
 */
export { OPFSManager };
