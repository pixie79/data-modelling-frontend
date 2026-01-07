/**
 * Unit tests for Database Service
 * Tests DuckDB/PostgreSQL database operations via SDK 1.13.1+
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { databaseService } from '@/services/sdk/databaseService';
import { sdkLoader } from '@/services/sdk/sdkLoader';
import { databaseConfigService } from '@/services/storage/databaseConfigService';
import {
  DatabaseBackend,
  ConnectionStatus,
  SyncStatus,
  DEFAULT_DATABASE_CONFIG,
} from '@/types/database';
import type { DatabaseConfig } from '@/types/database';

// Mock dependencies
vi.mock('@/services/sdk/sdkLoader', () => ({
  sdkLoader: {
    hasDatabaseSupport: vi.fn(),
    load: vi.fn(),
  },
}));

vi.mock('@/services/storage/databaseConfigService', () => ({
  databaseConfigService: {
    loadConfig: vi.fn(),
  },
}));

describe('DatabaseService', () => {
  const mockWorkspacePath = '/test/workspace';

  const mockDuckDBConfig: DatabaseConfig = {
    database: {
      backend: DatabaseBackend.DuckDB,
      path: '.data-model.duckdb',
    },
    sync: {
      auto_sync: true,
      watch: false,
      sync_on_save: true,
      conflict_strategy: 'prompt',
    },
    git: {
      hooks_enabled: false,
      pre_commit: true,
      post_checkout: true,
      post_merge: true,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset internal state
    databaseService.clearState();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isSupported', () => {
    it('should return true when SDK has database support', () => {
      vi.mocked(sdkLoader.hasDatabaseSupport).mockReturnValue(true);
      expect(databaseService.isSupported()).toBe(true);
    });

    it('should return false when SDK does not have database support', () => {
      vi.mocked(sdkLoader.hasDatabaseSupport).mockReturnValue(false);
      expect(databaseService.isSupported()).toBe(false);
    });
  });

  describe('initializeDatabase', () => {
    it('should throw error when SDK is not supported', async () => {
      vi.mocked(sdkLoader.hasDatabaseSupport).mockReturnValue(false);

      await expect(databaseService.initializeDatabase(mockWorkspacePath)).rejects.toThrow(
        'Database features require SDK 1.13.1+'
      );
    });

    it('should throw error when database backend is not enabled', async () => {
      vi.mocked(sdkLoader.hasDatabaseSupport).mockReturnValue(true);
      vi.mocked(databaseConfigService.loadConfig).mockResolvedValue(DEFAULT_DATABASE_CONFIG);

      await expect(databaseService.initializeDatabase(mockWorkspacePath)).rejects.toThrow(
        'Database backend is not enabled'
      );
    });

    it('should initialize database successfully', async () => {
      vi.mocked(sdkLoader.hasDatabaseSupport).mockReturnValue(true);
      vi.mocked(databaseConfigService.loadConfig).mockResolvedValue(mockDuckDBConfig);
      const mockDbInit = vi.fn().mockReturnValue(JSON.stringify({ success: true }));
      vi.mocked(sdkLoader.load).mockResolvedValue({
        db_init: mockDbInit,
      } as unknown as ReturnType<typeof sdkLoader.load>);

      await databaseService.initializeDatabase(mockWorkspacePath);

      expect(mockDbInit).toHaveBeenCalledWith(mockWorkspacePath, JSON.stringify(mockDuckDBConfig));
      expect(databaseService.isInitialized(mockWorkspacePath)).toBe(true);
    });

    it('should throw error when db_init method is not available', async () => {
      vi.mocked(sdkLoader.hasDatabaseSupport).mockReturnValue(true);
      vi.mocked(databaseConfigService.loadConfig).mockResolvedValue(mockDuckDBConfig);
      vi.mocked(sdkLoader.load).mockResolvedValue(
        {} as unknown as ReturnType<typeof sdkLoader.load>
      );

      await expect(databaseService.initializeDatabase(mockWorkspacePath)).rejects.toThrow(
        'db_init method not available'
      );
    });

    it('should throw error on initialization failure', async () => {
      vi.mocked(sdkLoader.hasDatabaseSupport).mockReturnValue(true);
      vi.mocked(databaseConfigService.loadConfig).mockResolvedValue(mockDuckDBConfig);
      vi.mocked(sdkLoader.load).mockResolvedValue({
        db_init: vi.fn().mockReturnValue(JSON.stringify({ success: false, error: 'Init failed' })),
      } as unknown as ReturnType<typeof sdkLoader.load>);

      await expect(databaseService.initializeDatabase(mockWorkspacePath)).rejects.toThrow(
        'Init failed'
      );
    });
  });

  describe('syncToDatabase', () => {
    it('should throw error when SDK is not supported', async () => {
      vi.mocked(sdkLoader.hasDatabaseSupport).mockReturnValue(false);

      await expect(databaseService.syncToDatabase(mockWorkspacePath)).rejects.toThrow(
        'Database features require SDK 1.13.1+'
      );
    });

    it('should sync successfully and return result', async () => {
      vi.mocked(sdkLoader.hasDatabaseSupport).mockReturnValue(true);
      const mockDbSync = vi.fn().mockReturnValue(
        JSON.stringify({
          success: true,
          duration_ms: 150,
          files_processed: 10,
          files_added: 3,
          files_updated: 5,
          files_deleted: 2,
          errors: [],
          warnings: [],
        })
      );
      vi.mocked(sdkLoader.load).mockResolvedValue({
        db_sync: mockDbSync,
      } as unknown as ReturnType<typeof sdkLoader.load>);

      const result = await databaseService.syncToDatabase(mockWorkspacePath);

      expect(result.success).toBe(true);
      expect(result.files_processed).toBe(10);
      expect(result.files_added).toBe(3);
      expect(result.files_updated).toBe(5);
      expect(result.files_deleted).toBe(2);
      expect(result.started_at).toBeDefined();
      expect(result.completed_at).toBeDefined();
    });

    it('should return error result on sync failure', async () => {
      vi.mocked(sdkLoader.hasDatabaseSupport).mockReturnValue(true);
      vi.mocked(sdkLoader.load).mockResolvedValue({
        db_sync: vi.fn().mockImplementation(() => {
          throw new Error('Sync error');
        }),
      } as unknown as ReturnType<typeof sdkLoader.load>);

      const result = await databaseService.syncToDatabase(mockWorkspacePath);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.message).toBe('Sync error');
    });
  });

  describe('getDatabaseStatus', () => {
    it('should return disconnected status when database is not enabled', async () => {
      vi.mocked(databaseConfigService.loadConfig).mockResolvedValue(DEFAULT_DATABASE_CONFIG);

      const result = await databaseService.getDatabaseStatus(mockWorkspacePath);

      expect(result.backend).toBe(DatabaseBackend.None);
      expect(result.connection_status).toBe(ConnectionStatus.Disconnected);
    });

    it('should return error status when SDK is not supported', async () => {
      vi.mocked(databaseConfigService.loadConfig).mockResolvedValue(mockDuckDBConfig);
      vi.mocked(sdkLoader.hasDatabaseSupport).mockReturnValue(false);

      const result = await databaseService.getDatabaseStatus(mockWorkspacePath);

      expect(result.backend).toBe(DatabaseBackend.DuckDB);
      expect(result.connection_status).toBe(ConnectionStatus.Error);
      expect(result.error).toContain('SDK 1.13.1+');
    });

    it('should return connected status from SDK', async () => {
      vi.mocked(databaseConfigService.loadConfig).mockResolvedValue(mockDuckDBConfig);
      vi.mocked(sdkLoader.hasDatabaseSupport).mockReturnValue(true);
      vi.mocked(sdkLoader.load).mockResolvedValue({
        db_status: vi.fn().mockReturnValue(
          JSON.stringify({
            connected: true,
            database_path: '/test/.data-model.duckdb',
            database_size: 1024000,
            last_sync: '2024-01-01T00:00:00Z',
            sync_status: 'in-sync',
          })
        ),
      } as unknown as ReturnType<typeof sdkLoader.load>);

      const result = await databaseService.getDatabaseStatus(mockWorkspacePath);

      expect(result.backend).toBe(DatabaseBackend.DuckDB);
      expect(result.connection_status).toBe(ConnectionStatus.Connected);
      expect(result.database_path).toBe('/test/.data-model.duckdb');
      expect(result.sync_status).toBe(SyncStatus.InSync);
    });

    it('should handle status check errors gracefully', async () => {
      vi.mocked(databaseConfigService.loadConfig).mockResolvedValue(mockDuckDBConfig);
      vi.mocked(sdkLoader.hasDatabaseSupport).mockReturnValue(true);
      vi.mocked(sdkLoader.load).mockResolvedValue({
        db_status: vi.fn().mockImplementation(() => {
          throw new Error('Status check failed');
        }),
      } as unknown as ReturnType<typeof sdkLoader.load>);

      const result = await databaseService.getDatabaseStatus(mockWorkspacePath);

      expect(result.connection_status).toBe(ConnectionStatus.Error);
      expect(result.sync_status).toBe(SyncStatus.Error);
      expect(result.error).toBe('Status check failed');
    });
  });

  describe('exportToYaml', () => {
    it('should throw error when SDK is not supported', async () => {
      vi.mocked(sdkLoader.hasDatabaseSupport).mockReturnValue(false);

      await expect(databaseService.exportToYaml(mockWorkspacePath)).rejects.toThrow(
        'Database features require SDK 1.13.1+'
      );
    });

    it('should export successfully and return result', async () => {
      vi.mocked(sdkLoader.hasDatabaseSupport).mockReturnValue(true);
      const mockDbExport = vi.fn().mockReturnValue(
        JSON.stringify({
          success: true,
          duration_ms: 200,
          files_exported: 15,
          errors: [],
        })
      );
      vi.mocked(sdkLoader.load).mockResolvedValue({
        db_export: mockDbExport,
      } as unknown as ReturnType<typeof sdkLoader.load>);

      const result = await databaseService.exportToYaml(mockWorkspacePath);

      expect(result.success).toBe(true);
      expect(result.files_exported).toBe(15);
      expect(result.started_at).toBeDefined();
      expect(result.completed_at).toBeDefined();
    });

    it('should return error result on export failure', async () => {
      vi.mocked(sdkLoader.hasDatabaseSupport).mockReturnValue(true);
      vi.mocked(sdkLoader.load).mockResolvedValue({
        db_export: vi.fn().mockImplementation(() => {
          throw new Error('Export error');
        }),
      } as unknown as ReturnType<typeof sdkLoader.load>);

      const result = await databaseService.exportToYaml(mockWorkspacePath);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.message).toBe('Export error');
    });
  });

  describe('executeQuery', () => {
    it('should throw error when SDK is not supported', async () => {
      vi.mocked(sdkLoader.hasDatabaseSupport).mockReturnValue(false);

      await expect(
        databaseService.executeQuery(mockWorkspacePath, 'SELECT * FROM tables')
      ).rejects.toThrow('Database features require SDK 1.13.1+');
    });

    it('should execute query successfully', async () => {
      vi.mocked(sdkLoader.hasDatabaseSupport).mockReturnValue(true);
      const mockData = [
        { id: '1', name: 'users' },
        { id: '2', name: 'orders' },
      ];
      vi.mocked(sdkLoader.load).mockResolvedValue({
        db_query: vi.fn().mockReturnValue(
          JSON.stringify({
            success: true,
            data: mockData,
            row_count: 2,
            column_names: ['id', 'name'],
          })
        ),
      } as unknown as ReturnType<typeof sdkLoader.load>);

      const result = await databaseService.executeQuery(mockWorkspacePath, 'SELECT * FROM tables');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockData);
      expect(result.row_count).toBe(2);
      expect(result.column_names).toEqual(['id', 'name']);
      expect(result.execution_time_ms).toBeGreaterThanOrEqual(0);
    });

    it('should return error result on query failure', async () => {
      vi.mocked(sdkLoader.hasDatabaseSupport).mockReturnValue(true);
      vi.mocked(sdkLoader.load).mockResolvedValue({
        db_query: vi.fn().mockImplementation(() => {
          throw new Error('Query error');
        }),
      } as unknown as ReturnType<typeof sdkLoader.load>);

      const result = await databaseService.executeQuery(mockWorkspacePath, 'INVALID SQL');

      expect(result.success).toBe(false);
      expect(result.data).toEqual([]);
      expect(result.error).toBe('Query error');
    });
  });

  describe('isInitialized', () => {
    it('should return false for non-initialized workspace', () => {
      expect(databaseService.isInitialized('/unknown/path')).toBe(false);
    });

    it('should return true after initialization', async () => {
      vi.mocked(sdkLoader.hasDatabaseSupport).mockReturnValue(true);
      vi.mocked(databaseConfigService.loadConfig).mockResolvedValue(mockDuckDBConfig);
      vi.mocked(sdkLoader.load).mockResolvedValue({
        db_init: vi.fn().mockReturnValue(JSON.stringify({ success: true })),
      } as unknown as ReturnType<typeof sdkLoader.load>);

      await databaseService.initializeDatabase(mockWorkspacePath);

      expect(databaseService.isInitialized(mockWorkspacePath)).toBe(true);
    });
  });

  describe('autoInitialize', () => {
    it('should return false when database is not enabled', async () => {
      vi.mocked(databaseConfigService.loadConfig).mockResolvedValue(DEFAULT_DATABASE_CONFIG);

      const result = await databaseService.autoInitialize(mockWorkspacePath);

      expect(result).toBe(false);
    });

    it('should return false when auto_sync is disabled', async () => {
      const configWithNoAutoSync: DatabaseConfig = {
        ...mockDuckDBConfig,
        sync: { ...mockDuckDBConfig.sync, auto_sync: false },
      };
      vi.mocked(databaseConfigService.loadConfig).mockResolvedValue(configWithNoAutoSync);

      const result = await databaseService.autoInitialize(mockWorkspacePath);

      expect(result).toBe(false);
    });

    it('should return false when SDK is not supported', async () => {
      vi.mocked(databaseConfigService.loadConfig).mockResolvedValue(mockDuckDBConfig);
      vi.mocked(sdkLoader.hasDatabaseSupport).mockReturnValue(false);

      const result = await databaseService.autoInitialize(mockWorkspacePath);

      expect(result).toBe(false);
    });

    it('should initialize and sync successfully', async () => {
      vi.mocked(databaseConfigService.loadConfig).mockResolvedValue(mockDuckDBConfig);
      vi.mocked(sdkLoader.hasDatabaseSupport).mockReturnValue(true);
      vi.mocked(sdkLoader.load).mockResolvedValue({
        db_init: vi.fn().mockReturnValue(JSON.stringify({ success: true })),
        db_sync: vi.fn().mockReturnValue(JSON.stringify({ success: true })),
      } as unknown as ReturnType<typeof sdkLoader.load>);

      const result = await databaseService.autoInitialize(mockWorkspacePath);

      expect(result).toBe(true);
      expect(databaseService.isInitialized(mockWorkspacePath)).toBe(true);
    });

    it('should return false on initialization error', async () => {
      vi.mocked(databaseConfigService.loadConfig).mockResolvedValue(mockDuckDBConfig);
      vi.mocked(sdkLoader.hasDatabaseSupport).mockReturnValue(true);
      vi.mocked(sdkLoader.load).mockResolvedValue({
        db_init: vi.fn().mockImplementation(() => {
          throw new Error('Init failed');
        }),
      } as unknown as ReturnType<typeof sdkLoader.load>);

      const result = await databaseService.autoInitialize(mockWorkspacePath);

      expect(result).toBe(false);
    });
  });

  describe('clearState', () => {
    it('should clear state for specific workspace', async () => {
      vi.mocked(sdkLoader.hasDatabaseSupport).mockReturnValue(true);
      vi.mocked(databaseConfigService.loadConfig).mockResolvedValue(mockDuckDBConfig);
      vi.mocked(sdkLoader.load).mockResolvedValue({
        db_init: vi.fn().mockReturnValue(JSON.stringify({ success: true })),
      } as unknown as ReturnType<typeof sdkLoader.load>);

      await databaseService.initializeDatabase(mockWorkspacePath);
      expect(databaseService.isInitialized(mockWorkspacePath)).toBe(true);

      databaseService.clearState(mockWorkspacePath);
      expect(databaseService.isInitialized(mockWorkspacePath)).toBe(false);
    });

    it('should clear all state when no path provided', async () => {
      vi.mocked(sdkLoader.hasDatabaseSupport).mockReturnValue(true);
      vi.mocked(databaseConfigService.loadConfig).mockResolvedValue(mockDuckDBConfig);
      vi.mocked(sdkLoader.load).mockResolvedValue({
        db_init: vi.fn().mockReturnValue(JSON.stringify({ success: true })),
      } as unknown as ReturnType<typeof sdkLoader.load>);

      await databaseService.initializeDatabase('/workspace1');
      await databaseService.initializeDatabase('/workspace2');

      databaseService.clearState();

      expect(databaseService.isInitialized('/workspace1')).toBe(false);
      expect(databaseService.isInitialized('/workspace2')).toBe(false);
    });
  });

  describe('sync status mapping', () => {
    const testCases = [
      { input: 'in-sync', expected: SyncStatus.InSync },
      { input: 'insync', expected: SyncStatus.InSync },
      { input: 'synced', expected: SyncStatus.InSync },
      { input: 'out-of-sync', expected: SyncStatus.OutOfSync },
      { input: 'outofsync', expected: SyncStatus.OutOfSync },
      { input: 'dirty', expected: SyncStatus.OutOfSync },
      { input: 'syncing', expected: SyncStatus.Syncing },
      { input: 'error', expected: SyncStatus.Error },
      { input: 'unknown', expected: SyncStatus.Unknown },
      { input: undefined, expected: SyncStatus.Unknown },
    ];

    testCases.forEach(({ input, expected }) => {
      it(`should map "${input}" to ${expected}`, async () => {
        vi.mocked(databaseConfigService.loadConfig).mockResolvedValue(mockDuckDBConfig);
        vi.mocked(sdkLoader.hasDatabaseSupport).mockReturnValue(true);
        vi.mocked(sdkLoader.load).mockResolvedValue({
          db_status: vi.fn().mockReturnValue(
            JSON.stringify({
              connected: true,
              sync_status: input,
            })
          ),
        } as unknown as ReturnType<typeof sdkLoader.load>);

        const result = await databaseService.getDatabaseStatus(mockWorkspacePath);

        expect(result.sync_status).toBe(expected);
      });
    });
  });
});
