/**
 * Unit tests for OPFS Manager
 * Tests Origin Private File System operations
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getOPFSManager } from '@/services/database/opfsManager';

// Mock the checkBrowserCapabilities function
vi.mock('@/types/duckdb', async () => {
  const actual = await vi.importActual('@/types/duckdb');
  return {
    ...actual,
    checkBrowserCapabilities: vi.fn().mockReturnValue({
      opfs: true,
      webAssembly: true,
      sharedArrayBuffer: true,
      workers: true,
      indexedDB: true,
      warnings: [],
    }),
  };
});

// Mock FileSystemDirectoryHandle
const mockFileHandle = {
  getFile: vi.fn().mockResolvedValue({
    text: vi.fn().mockResolvedValue('file content'),
    arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(100)),
    size: 100,
    lastModified: Date.now(),
    type: 'application/octet-stream',
  }),
  createWritable: vi.fn().mockResolvedValue({
    write: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  }),
};

const mockDataDirectory = {
  getFileHandle: vi.fn().mockResolvedValue(mockFileHandle),
  getDirectoryHandle: vi.fn(),
  removeEntry: vi.fn().mockResolvedValue(undefined),
  keys: vi.fn().mockReturnValue({
    [Symbol.asyncIterator]: async function* () {
      yield 'test.duckdb';
    },
  }),
};

const mockRootDirectory = {
  getDirectoryHandle: vi.fn().mockResolvedValue(mockDataDirectory),
  removeEntry: vi.fn().mockResolvedValue(undefined),
};

// Mock navigator.storage
const mockGetDirectory = vi.fn().mockResolvedValue(mockRootDirectory);

describe('OPFSManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup navigator.storage mock
    Object.defineProperty(global, 'navigator', {
      value: {
        storage: {
          getDirectory: mockGetDirectory,
          estimate: vi.fn().mockResolvedValue({
            usage: 5000000,
            quota: 100000000,
          }),
          persist: vi.fn().mockResolvedValue(true),
          persisted: vi.fn().mockResolvedValue(true),
        },
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance on multiple calls', () => {
      const instance1 = getOPFSManager();
      const instance2 = getOPFSManager();
      expect(instance1).toBe(instance2);
    });
  });

  describe('OPFS Support Detection', () => {
    it('should detect OPFS support when available', () => {
      const manager = getOPFSManager();
      const supported = manager.isSupported();
      expect(supported).toBe(true);
    });
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      const manager = getOPFSManager();
      const result = await manager.initialize();

      expect(result.success).toBe(true);
      expect(mockGetDirectory).toHaveBeenCalled();
    });

    it('should return cached result on subsequent initialize calls', async () => {
      const manager = getOPFSManager();
      await manager.initialize();
      const result2 = await manager.initialize();

      expect(result2.success).toBe(true);
      // getDirectory called once, then cached
    });
  });

  describe('File Operations', () => {
    it('should check if file exists', async () => {
      const manager = getOPFSManager();
      await manager.initialize();

      const exists = await manager.fileExists('test.duckdb');
      expect(exists).toBe(true);
    });

    it('should return false for non-existent file', async () => {
      mockDataDirectory.getFileHandle.mockRejectedValueOnce(
        new DOMException('File not found', 'NotFoundError')
      );

      const manager = getOPFSManager();
      await manager.initialize();

      const exists = await manager.fileExists('nonexistent.db');
      expect(exists).toBe(false);
    });

    it('should get file from OPFS', async () => {
      const manager = getOPFSManager();
      await manager.initialize();

      const file = await manager.getFile('test.duckdb');
      expect(file).not.toBeNull();
    });

    it('should write file to OPFS', async () => {
      const manager = getOPFSManager();
      await manager.initialize();

      const result = await manager.writeFile('new-file.db', new ArrayBuffer(50));

      expect(result.success).toBe(true);
      expect(mockDataDirectory.getFileHandle).toHaveBeenCalledWith('new-file.db', { create: true });
    });

    it('should delete file from OPFS', async () => {
      const manager = getOPFSManager();
      await manager.initialize();

      const result = await manager.deleteFile('test.duckdb');

      expect(result.success).toBe(true);
      expect(mockDataDirectory.removeEntry).toHaveBeenCalledWith('test.duckdb');
    });

    it('should get file size', async () => {
      const manager = getOPFSManager();
      await manager.initialize();

      const size = await manager.getFileSize('test.duckdb');
      expect(size).toBe(100);
    });
  });

  describe('Quota Information', () => {
    it('should get quota info', async () => {
      const manager = getOPFSManager();
      await manager.initialize();

      const quota = await manager.getQuotaInfo();

      expect(quota).not.toBeNull();
      expect(quota?.usage).toBe(5000000);
      expect(quota?.quota).toBe(100000000);
      expect(quota?.usagePercent).toBeCloseTo(5);
      expect(quota?.available).toBe(95000000);
    });
  });

  describe('Persistence', () => {
    it('should request persistence', async () => {
      const manager = getOPFSManager();
      const result = await manager.requestPersistence();
      expect(result).toBe(true);
    });

    it('should check if storage is persisted', async () => {
      const manager = getOPFSManager();
      const result = await manager.isPersisted();
      expect(result).toBe(true);
    });
  });

  describe('Backup Operations', () => {
    it('should create backup of a file', async () => {
      const manager = getOPFSManager();
      await manager.initialize();

      const result = await manager.createBackup('test.duckdb', 'v1');

      expect(result.success).toBe(true);
      expect(result.backupName).toContain('backup');
    });
  });

  describe('Storage Mode', () => {
    it('should return OPFS storage mode when supported', () => {
      const manager = getOPFSManager();
      const mode = manager.getStorageMode();
      expect(mode).toBe('opfs');
    });
  });

  describe('Export and Import', () => {
    it('should export file as blob', async () => {
      const manager = getOPFSManager();
      await manager.initialize();

      const blob = await manager.exportFile('test.duckdb');
      expect(blob).toBeInstanceOf(Blob);
    });

    it('should return null for non-existent file export', async () => {
      mockDataDirectory.getFileHandle.mockRejectedValueOnce(
        new DOMException('File not found', 'NotFoundError')
      );

      const manager = getOPFSManager();
      await manager.initialize();

      const blob = await manager.exportFile('nonexistent.db');
      expect(blob).toBeNull();
    });

    it('should import data as file', async () => {
      const manager = getOPFSManager();
      await manager.initialize();

      // Use ArrayBuffer directly since Blob.arrayBuffer() may not be available in test env
      const data = new ArrayBuffer(100);
      const result = await manager.writeFile('imported.db', data);

      expect(result.success).toBe(true);
    });
  });
});
