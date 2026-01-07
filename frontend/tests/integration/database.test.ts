/**
 * Integration tests for Database Service
 * Tests the integration between YAML files and database
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { databaseService } from '@/services/sdk/databaseService';
import { databaseConfigService } from '@/services/storage/databaseConfigService';
import { sdkLoader } from '@/services/sdk/sdkLoader';
import { DatabaseBackend, ConnectionStatus, SyncStatus } from '@/types/database';
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

describe('Database Integration', () => {
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
    databaseService.clearState();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('YAML to Database Sync', () => {
    it('should sync YAML files to database on initialization', async () => {
      vi.mocked(sdkLoader.hasDatabaseSupport).mockReturnValue(true);
      vi.mocked(databaseConfigService.loadConfig).mockResolvedValue(mockDuckDBConfig);

      const mockDbInit = vi.fn().mockReturnValue(JSON.stringify({ success: true }));
      const mockDbSync = vi.fn().mockReturnValue(
        JSON.stringify({
          success: true,
          files_processed: 25,
          files_added: 10,
          files_updated: 15,
          files_deleted: 0,
          errors: [],
          warnings: [],
        })
      );

      vi.mocked(sdkLoader.load).mockResolvedValue({
        db_init: mockDbInit,
        db_sync: mockDbSync,
      } as unknown as ReturnType<typeof sdkLoader.load>);

      // Initialize and sync
      await databaseService.initializeDatabase(mockWorkspacePath);
      const syncResult = await databaseService.syncToDatabase(mockWorkspacePath);

      expect(mockDbInit).toHaveBeenCalledWith(mockWorkspacePath, expect.any(String));
      expect(syncResult.success).toBe(true);
      expect(syncResult.files_processed).toBe(25);
      expect(syncResult.files_added).toBe(10);
      expect(syncResult.files_updated).toBe(15);
    });

    it('should handle sync errors gracefully', async () => {
      vi.mocked(sdkLoader.hasDatabaseSupport).mockReturnValue(true);
      vi.mocked(databaseConfigService.loadConfig).mockResolvedValue(mockDuckDBConfig);

      const mockDbSync = vi.fn().mockReturnValue(
        JSON.stringify({
          success: false,
          files_processed: 10,
          errors: [
            {
              file_path: '/test/tables/invalid.yaml',
              error_type: 'parse',
              message: 'Invalid YAML syntax',
              line: 5,
            },
          ],
          warnings: ['Some fields may be deprecated'],
        })
      );

      vi.mocked(sdkLoader.load).mockResolvedValue({
        db_sync: mockDbSync,
      } as unknown as ReturnType<typeof sdkLoader.load>);

      const syncResult = await databaseService.syncToDatabase(mockWorkspacePath);

      expect(syncResult.success).toBe(false);
      expect(syncResult.errors).toHaveLength(1);
      expect(syncResult.errors[0]?.error_type).toBe('parse');
      expect(syncResult.warnings).toContain('Some fields may be deprecated');
    });

    it('should track sync status correctly', async () => {
      vi.mocked(sdkLoader.hasDatabaseSupport).mockReturnValue(true);
      vi.mocked(databaseConfigService.loadConfig).mockResolvedValue(mockDuckDBConfig);

      // Initially out of sync
      vi.mocked(sdkLoader.load).mockResolvedValue({
        db_status: vi.fn().mockReturnValue(
          JSON.stringify({
            connected: true,
            sync_status: 'out-of-sync',
          })
        ),
      } as unknown as ReturnType<typeof sdkLoader.load>);

      let status = await databaseService.getDatabaseStatus(mockWorkspacePath);
      expect(status.sync_status).toBe(SyncStatus.OutOfSync);

      // After sync, should be in sync
      vi.mocked(sdkLoader.load).mockResolvedValue({
        db_status: vi.fn().mockReturnValue(
          JSON.stringify({
            connected: true,
            sync_status: 'in-sync',
          })
        ),
      } as unknown as ReturnType<typeof sdkLoader.load>);

      status = await databaseService.getDatabaseStatus(mockWorkspacePath);
      expect(status.sync_status).toBe(SyncStatus.InSync);
    });
  });

  describe('Database to YAML Export', () => {
    it('should export database to YAML files', async () => {
      vi.mocked(sdkLoader.hasDatabaseSupport).mockReturnValue(true);
      vi.mocked(databaseConfigService.loadConfig).mockResolvedValue(mockDuckDBConfig);

      const mockDbExport = vi.fn().mockReturnValue(
        JSON.stringify({
          success: true,
          files_exported: 30,
          duration_ms: 250,
          errors: [],
        })
      );

      vi.mocked(sdkLoader.load).mockResolvedValue({
        db_export: mockDbExport,
      } as unknown as ReturnType<typeof sdkLoader.load>);

      const exportResult = await databaseService.exportToYaml(mockWorkspacePath);

      expect(exportResult.success).toBe(true);
      expect(exportResult.files_exported).toBe(30);
      expect(exportResult.duration_ms).toBe(250);
      expect(exportResult.errors).toHaveLength(0);
    });

    it('should handle export errors', async () => {
      vi.mocked(sdkLoader.hasDatabaseSupport).mockReturnValue(true);
      vi.mocked(databaseConfigService.loadConfig).mockResolvedValue(mockDuckDBConfig);

      const mockDbExport = vi.fn().mockReturnValue(
        JSON.stringify({
          success: false,
          files_exported: 5,
          errors: [
            {
              entity_type: 'table',
              entity_id: 'table-1',
              message: 'Failed to serialize table',
            },
          ],
        })
      );

      vi.mocked(sdkLoader.load).mockResolvedValue({
        db_export: mockDbExport,
      } as unknown as ReturnType<typeof sdkLoader.load>);

      const exportResult = await databaseService.exportToYaml(mockWorkspacePath);

      expect(exportResult.success).toBe(false);
      expect(exportResult.errors).toHaveLength(1);
      expect(exportResult.errors[0]?.entity_type).toBe('table');
    });
  });

  describe('Query Execution', () => {
    it('should execute SQL queries and return results', async () => {
      vi.mocked(sdkLoader.hasDatabaseSupport).mockReturnValue(true);

      const mockData = [
        { id: '1', name: 'users', column_count: 5 },
        { id: '2', name: 'orders', column_count: 8 },
        { id: '3', name: 'products', column_count: 12 },
      ];

      vi.mocked(sdkLoader.load).mockResolvedValue({
        db_query: vi.fn().mockReturnValue(
          JSON.stringify({
            success: true,
            data: mockData,
            row_count: 3,
            column_names: ['id', 'name', 'column_count'],
          })
        ),
      } as unknown as ReturnType<typeof sdkLoader.load>);

      const result = await databaseService.executeQuery(
        mockWorkspacePath,
        'SELECT * FROM tables WHERE domain_id = ?'
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockData);
      expect(result.row_count).toBe(3);
      expect(result.column_names).toEqual(['id', 'name', 'column_count']);
    });

    it('should handle query errors', async () => {
      vi.mocked(sdkLoader.hasDatabaseSupport).mockReturnValue(true);

      vi.mocked(sdkLoader.load).mockResolvedValue({
        db_query: vi.fn().mockReturnValue(
          JSON.stringify({
            success: false,
            data: [],
            error: 'Syntax error in SQL query',
          })
        ),
      } as unknown as ReturnType<typeof sdkLoader.load>);

      const result = await databaseService.executeQuery(mockWorkspacePath, 'INVALID SQL');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Syntax error in SQL query');
    });

    it('should track query execution time', async () => {
      vi.mocked(sdkLoader.hasDatabaseSupport).mockReturnValue(true);

      vi.mocked(sdkLoader.load).mockResolvedValue({
        db_query: vi.fn().mockImplementation(() => {
          // Simulate query execution delay
          const start = Date.now();
          while (Date.now() - start < 10) {
            // Busy wait for a short time
          }
          return JSON.stringify({
            success: true,
            data: [],
            row_count: 0,
          });
        }),
      } as unknown as ReturnType<typeof sdkLoader.load>);

      const result = await databaseService.executeQuery(mockWorkspacePath, 'SELECT 1');

      expect(result.execution_time_ms).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Auto-initialization', () => {
    it('should auto-initialize when configured', async () => {
      vi.mocked(sdkLoader.hasDatabaseSupport).mockReturnValue(true);
      vi.mocked(databaseConfigService.loadConfig).mockResolvedValue(mockDuckDBConfig);

      const mockDbInit = vi.fn().mockReturnValue(JSON.stringify({ success: true }));
      const mockDbSync = vi.fn().mockReturnValue(
        JSON.stringify({
          success: true,
          files_processed: 10,
        })
      );

      vi.mocked(sdkLoader.load).mockResolvedValue({
        db_init: mockDbInit,
        db_sync: mockDbSync,
      } as unknown as ReturnType<typeof sdkLoader.load>);

      const result = await databaseService.autoInitialize(mockWorkspacePath);

      expect(result).toBe(true);
      expect(databaseService.isInitialized(mockWorkspacePath)).toBe(true);
      expect(mockDbInit).toHaveBeenCalled();
      expect(mockDbSync).toHaveBeenCalled();
    });

    it('should not auto-initialize when auto_sync is disabled', async () => {
      vi.mocked(sdkLoader.hasDatabaseSupport).mockReturnValue(true);
      vi.mocked(databaseConfigService.loadConfig).mockResolvedValue({
        ...mockDuckDBConfig,
        sync: { ...mockDuckDBConfig.sync, auto_sync: false },
      });

      const result = await databaseService.autoInitialize(mockWorkspacePath);

      expect(result).toBe(false);
      expect(databaseService.isInitialized(mockWorkspacePath)).toBe(false);
    });

    it('should skip auto-init if already initialized', async () => {
      vi.mocked(sdkLoader.hasDatabaseSupport).mockReturnValue(true);
      vi.mocked(databaseConfigService.loadConfig).mockResolvedValue(mockDuckDBConfig);

      const mockDbInit = vi.fn().mockReturnValue(JSON.stringify({ success: true }));
      const mockDbSync = vi
        .fn()
        .mockReturnValue(JSON.stringify({ success: true, files_processed: 0 }));

      vi.mocked(sdkLoader.load).mockResolvedValue({
        db_init: mockDbInit,
        db_sync: mockDbSync,
      } as unknown as ReturnType<typeof sdkLoader.load>);

      // First initialization
      await databaseService.autoInitialize(mockWorkspacePath);
      expect(mockDbInit).toHaveBeenCalledTimes(1);

      // Second initialization should skip init but still sync
      await databaseService.autoInitialize(mockWorkspacePath);
      expect(mockDbInit).toHaveBeenCalledTimes(1); // Not called again
    });
  });

  describe('Status Monitoring', () => {
    it('should report connected status when database is available', async () => {
      vi.mocked(sdkLoader.hasDatabaseSupport).mockReturnValue(true);
      vi.mocked(databaseConfigService.loadConfig).mockResolvedValue(mockDuckDBConfig);

      vi.mocked(sdkLoader.load).mockResolvedValue({
        db_status: vi.fn().mockReturnValue(
          JSON.stringify({
            connected: true,
            database_path: '/test/.data-model.duckdb',
            database_size: 1024000,
            last_sync: '2024-01-01T12:00:00Z',
            sync_status: 'in-sync',
            metrics: {
              table_count: 10,
              column_count: 50,
              relationship_count: 15,
              domain_count: 3,
              decision_count: 5,
              knowledge_count: 8,
            },
          })
        ),
      } as unknown as ReturnType<typeof sdkLoader.load>);

      const status = await databaseService.getDatabaseStatus(mockWorkspacePath);

      expect(status.connection_status).toBe(ConnectionStatus.Connected);
      expect(status.backend).toBe(DatabaseBackend.DuckDB);
      expect(status.database_path).toBe('/test/.data-model.duckdb');
      expect(status.database_size).toBe(1024000);
      expect(status.sync_status).toBe(SyncStatus.InSync);
      expect(status.metrics?.table_count).toBe(10);
      expect(status.metrics?.decision_count).toBe(5);
    });

    it('should report disconnected status when database is unavailable', async () => {
      vi.mocked(sdkLoader.hasDatabaseSupport).mockReturnValue(true);
      vi.mocked(databaseConfigService.loadConfig).mockResolvedValue(mockDuckDBConfig);

      vi.mocked(sdkLoader.load).mockResolvedValue({
        db_status: vi.fn().mockReturnValue(
          JSON.stringify({
            connected: false,
            error: 'Database file not found',
          })
        ),
      } as unknown as ReturnType<typeof sdkLoader.load>);

      const status = await databaseService.getDatabaseStatus(mockWorkspacePath);

      expect(status.connection_status).toBe(ConnectionStatus.Disconnected);
    });
  });

  describe('Error Recovery', () => {
    it('should recover from temporary connection failures', async () => {
      vi.mocked(sdkLoader.hasDatabaseSupport).mockReturnValue(true);
      vi.mocked(databaseConfigService.loadConfig).mockResolvedValue(mockDuckDBConfig);

      // First call fails
      const mockDbSync = vi
        .fn()
        .mockImplementationOnce(() => {
          throw new Error('Connection timeout');
        })
        .mockImplementationOnce(() =>
          JSON.stringify({
            success: true,
            files_processed: 10,
          })
        );

      vi.mocked(sdkLoader.load).mockResolvedValue({
        db_sync: mockDbSync,
      } as unknown as ReturnType<typeof sdkLoader.load>);

      // First attempt fails
      const result1 = await databaseService.syncToDatabase(mockWorkspacePath);
      expect(result1.success).toBe(false);
      expect(result1.errors[0]?.message).toBe('Connection timeout');

      // Retry succeeds
      const result2 = await databaseService.syncToDatabase(mockWorkspacePath);
      expect(result2.success).toBe(true);
    });

    it('should clear state on workspace close', async () => {
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
  });
});
