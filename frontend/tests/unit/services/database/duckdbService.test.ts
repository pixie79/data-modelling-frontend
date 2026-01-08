/**
 * Unit tests for DuckDB Service
 * Tests DuckDB-WASM service API and behavior
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DuckDBService, getDuckDBService } from '@/services/database/duckdbService';
import { StorageMode, ExportFormat } from '@/types/duckdb';

// Mock @duckdb/duckdb-wasm
vi.mock('@duckdb/duckdb-wasm', () => ({
  ConsoleLogger: vi.fn().mockImplementation(() => ({})),
  LogLevel: {
    DEBUG: 0,
    WARNING: 2,
  },
  AsyncDuckDB: vi.fn().mockImplementation(() => ({
    instantiate: vi.fn().mockResolvedValue(undefined),
    open: vi.fn().mockResolvedValue(undefined),
    connect: vi.fn().mockResolvedValue({
      query: vi.fn().mockResolvedValue({
        toArray: () => [{ version: '1.4.3' }],
        schema: { fields: [{ name: 'version', type: { toString: () => 'VARCHAR' } }] },
      }),
      prepare: vi.fn().mockResolvedValue({
        query: vi.fn().mockResolvedValue({
          toArray: () => [],
          schema: { fields: [] },
        }),
        close: vi.fn().mockResolvedValue(undefined),
      }),
      close: vi.fn().mockResolvedValue(undefined),
    }),
    terminate: vi.fn().mockResolvedValue(undefined),
  })),
  selectBundle: vi.fn().mockResolvedValue({
    mainModule: '/duckdb/duckdb-eh.wasm',
    mainWorker: '/duckdb/duckdb-browser-eh.worker.js',
  }),
}));

// Mock Worker
class MockWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
}
vi.stubGlobal('Worker', MockWorker);

// Mock navigator.storage
Object.defineProperty(global, 'navigator', {
  value: {
    storage: {
      estimate: vi.fn().mockResolvedValue({ usage: 1000000, quota: 100000000 }),
      getDirectory: vi.fn().mockResolvedValue({}),
    },
  },
  writable: true,
});

describe('DuckDBService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    DuckDBService.resetInstance();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance on multiple calls', () => {
      const instance1 = getDuckDBService();
      const instance2 = getDuckDBService();
      expect(instance1).toBe(instance2);
    });

    it('should return a new instance after reset', () => {
      const instance1 = getDuckDBService();
      DuckDBService.resetInstance();
      const instance2 = getDuckDBService();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('Service API', () => {
    it('should have initialize method', () => {
      const service = getDuckDBService();
      expect(typeof service.initialize).toBe('function');
    });

    it('should have query method', () => {
      const service = getDuckDBService();
      expect(typeof service.query).toBe('function');
    });

    it('should have execute method', () => {
      const service = getDuckDBService();
      expect(typeof service.execute).toBe('function');
    });

    it('should have transaction method', () => {
      const service = getDuckDBService();
      expect(typeof service.transaction).toBe('function');
    });

    it('should have getStats method', () => {
      const service = getDuckDBService();
      expect(typeof service.getStats).toBe('function');
    });

    it('should have getOPFSStatus method', () => {
      const service = getDuckDBService();
      expect(typeof service.getOPFSStatus).toBe('function');
    });

    it('should have export method', () => {
      const service = getDuckDBService();
      expect(typeof service.export).toBe('function');
    });

    it('should have import method', () => {
      const service = getDuckDBService();
      expect(typeof service.import).toBe('function');
    });

    it('should have reset method', () => {
      const service = getDuckDBService();
      expect(typeof service.reset).toBe('function');
    });

    it('should have terminate method', () => {
      const service = getDuckDBService();
      expect(typeof service.terminate).toBe('function');
    });
  });

  describe('Initialization State', () => {
    it('should start as not initialized', () => {
      const service = getDuckDBService();
      expect(service.isInitialized()).toBe(false);
    });

    it('should return null for connection when not initialized', () => {
      const service = getDuckDBService();
      expect(service.getConnection()).toBeNull();
    });

    it('should return null for database when not initialized', () => {
      const service = getDuckDBService();
      expect(service.getDatabase()).toBeNull();
    });
  });

  describe('Query when not initialized', () => {
    it('should return error for query when not initialized', async () => {
      const service = getDuckDBService();
      const result = await service.query('SELECT 1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('DuckDB is not initialized');
      expect(result.rows).toEqual([]);
      expect(result.rowCount).toBe(0);
    });

    it('should return error for execute when not initialized', async () => {
      const service = getDuckDBService();
      const result = await service.execute('INSERT INTO test VALUES (1)');

      expect(result.success).toBe(false);
      expect(result.error).toBe('DuckDB is not initialized');
    });

    it('should return error for transaction when not initialized', async () => {
      const service = getDuckDBService();
      const result = await service.transaction(async () => 'test');

      expect(result.success).toBe(false);
      expect(result.error).toBe('DuckDB is not initialized');
    });

    it('should return error for reset when not initialized', async () => {
      const service = getDuckDBService();
      const result = await service.reset();

      expect(result.success).toBe(false);
    });
  });

  describe('Export when not initialized', () => {
    it('should throw error for export when not initialized', async () => {
      const service = getDuckDBService();

      await expect(service.export({ format: ExportFormat.JSON })).rejects.toThrow(
        'DuckDB is not initialized'
      );
    });
  });

  describe('Import when not initialized', () => {
    it('should return error for import when not initialized', async () => {
      const service = getDuckDBService();
      const blob = new Blob(['{}'], { type: 'application/json' });

      const result = await service.import(blob, { mergeStrategy: 'merge' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('DuckDB is not initialized');
    });
  });

  describe('Statistics when not initialized', () => {
    it('should return default stats when not initialized', async () => {
      const service = getDuckDBService();
      const stats = await service.getStats();

      expect(stats.isInitialized).toBe(false);
      expect(stats.tableCount).toBe(0);
      expect(stats.tables).toEqual([]);
    });
  });

  describe('Storage Mode', () => {
    it('should return a valid storage mode', () => {
      const service = getDuckDBService();
      const mode = service.getStorageMode();

      expect([StorageMode.Memory, StorageMode.OPFS]).toContain(mode);
    });
  });

  describe('Termination', () => {
    it('should handle termination when not initialized', async () => {
      const service = getDuckDBService();

      // Should not throw
      await expect(service.terminate()).resolves.not.toThrow();
    });
  });

  describe('ExportFormat enum', () => {
    it('should have JSON format', () => {
      expect(ExportFormat.JSON).toBeDefined();
    });

    it('should have CSV format', () => {
      expect(ExportFormat.CSV).toBeDefined();
    });

    it('should have Parquet format', () => {
      expect(ExportFormat.Parquet).toBeDefined();
    });

    it('should have DuckDB format', () => {
      expect(ExportFormat.DuckDB).toBeDefined();
    });
  });

  describe('StorageMode enum', () => {
    it('should have Memory mode', () => {
      expect(StorageMode.Memory).toBeDefined();
    });

    it('should have OPFS mode', () => {
      expect(StorageMode.OPFS).toBeDefined();
    });
  });
});
