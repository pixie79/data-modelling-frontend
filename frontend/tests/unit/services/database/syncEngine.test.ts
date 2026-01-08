/**
 * Unit tests for Sync Engine
 * Tests synchronization between YAML files and DuckDB database
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SyncEngine, getSyncEngine } from '@/services/database/syncEngine';
import type { WorkspaceData } from '@/services/database/syncEngine';
import type { Workspace } from '@/types/workspace';
import type { Domain } from '@/types/domain';
import type { Table } from '@/types/table';

// Mock DuckDB service
vi.mock('@/services/database/duckdbService', () => ({
  getDuckDBService: vi.fn(() => ({
    isInitialized: vi.fn().mockReturnValue(true),
    query: vi.fn().mockResolvedValue({
      success: true,
      rows: [],
      columnNames: [],
      columnTypes: [],
    }),
    execute: vi.fn().mockResolvedValue({ success: true }),
  })),
  DuckDBService: {
    getInstance: vi.fn(),
    resetInstance: vi.fn(),
  },
}));

// Mock storage adapter
vi.mock('@/services/database/duckdbStorageAdapter', () => ({
  getDuckDBStorageAdapter: vi.fn(() => ({
    initialize: vi.fn().mockResolvedValue({ success: true }),
    getTableById: vi.fn().mockResolvedValue(null),
    getTablesByWorkspace: vi.fn().mockResolvedValue([]),
    getRelationshipsByWorkspace: vi.fn().mockResolvedValue([]),
    getDomainsByWorkspace: vi.fn().mockResolvedValue([]),
    getSystemsByDomain: vi.fn().mockResolvedValue([]),
    saveTable: vi.fn().mockResolvedValue({ success: true }),
    saveDomain: vi.fn().mockResolvedValue({ success: true }),
    saveSystem: vi.fn().mockResolvedValue({ success: true }),
    saveRelationship: vi.fn().mockResolvedValue({ success: true }),
  })),
  DuckDBStorageAdapter: {
    getInstance: vi.fn(),
    resetInstance: vi.fn(),
  },
}));

// Mock crypto.subtle for hash computation
const mockDigest = vi.fn().mockImplementation(async () => {
  const hash = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    hash[i] = Math.floor(Math.random() * 256);
  }
  return hash.buffer;
});

Object.defineProperty(global, 'crypto', {
  value: {
    subtle: {
      digest: mockDigest,
    },
  },
});

describe('SyncEngine', () => {
  const mockWorkspace: Workspace = {
    id: 'ws-1',
    name: 'Test Workspace',
    owner_id: 'user-1',
    created_at: '2024-01-01T00:00:00Z',
    last_modified_at: '2024-01-01T00:00:00Z',
    domains: [],
  };

  const mockDomain: Domain = {
    id: 'domain-1',
    workspace_id: 'ws-1',
    name: 'Test Domain',
    created_at: '2024-01-01T00:00:00Z',
    last_modified_at: '2024-01-01T00:00:00Z',
  };

  const mockTable: Table = {
    id: 'table-1',
    workspace_id: 'ws-1',
    primary_domain_id: 'domain-1',
    name: 'users',
    model_type: 'physical',
    columns: [],
    position_x: 0,
    position_y: 0,
    width: 200,
    height: 150,
    visible_domains: [],
    is_owned_by_domain: true,
    created_at: '2024-01-01T00:00:00Z',
    last_modified_at: '2024-01-01T00:00:00Z',
  };

  const mockWorkspaceData: WorkspaceData = {
    workspace: mockWorkspace,
    domains: [mockDomain],
    tables: [mockTable],
    relationships: [],
    systems: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    SyncEngine.resetInstance();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance on multiple calls', () => {
      const instance1 = getSyncEngine();
      const instance2 = getSyncEngine();
      expect(instance1).toBe(instance2);
    });

    it('should return a new instance after reset', () => {
      const instance1 = getSyncEngine();
      SyncEngine.resetInstance();
      const instance2 = getSyncEngine();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('Sync Status', () => {
    it('should start with idle status', () => {
      const engine = getSyncEngine();
      expect(engine.getStatus()).toBe('idle');
    });
  });

  describe('syncFromMemory', () => {
    it('should sync workspace data to database', async () => {
      const engine = getSyncEngine();
      const result = await engine.syncFromMemory(mockWorkspaceData);

      expect(result.success).toBe(true);
      expect(result.direction).toBe('yaml-to-db');
      expect(result.stats.tablesProcessed).toBe(1);
      expect(result.stats.domainsProcessed).toBe(1);
    });

    it('should report sync statistics', async () => {
      const engine = getSyncEngine();
      const result = await engine.syncFromMemory(mockWorkspaceData);

      expect(result.stats).toHaveProperty('tablesProcessed');
      expect(result.stats).toHaveProperty('tablesAdded');
      expect(result.stats).toHaveProperty('tablesUpdated');
      expect(result.stats).toHaveProperty('relationshipsProcessed');
      expect(result.stats).toHaveProperty('domainsProcessed');
      expect(result.stats).toHaveProperty('systemsProcessed');
    });

    it('should track timing information', async () => {
      const engine = getSyncEngine();
      const result = await engine.syncFromMemory(mockWorkspaceData);

      expect(result.startedAt).toBeDefined();
      expect(result.completedAt).toBeDefined();
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty workspace data', async () => {
      const engine = getSyncEngine();
      const emptyData: WorkspaceData = {
        workspace: mockWorkspace,
        domains: [],
        tables: [],
        relationships: [],
        systems: [],
      };

      const result = await engine.syncFromMemory(emptyData);

      expect(result.success).toBe(true);
      expect(result.stats.tablesProcessed).toBe(0);
    });

    it('should collect errors without failing entire sync', async () => {
      const { getDuckDBStorageAdapter } = await import('@/services/database/duckdbStorageAdapter');
      vi.mocked(getDuckDBStorageAdapter).mockReturnValue({
        initialize: vi.fn().mockResolvedValue({ success: true }),
        getTableById: vi.fn().mockResolvedValue(null),
        saveTable: vi.fn().mockRejectedValue(new Error('Table save failed')),
        saveDomain: vi.fn().mockResolvedValue({ success: true }),
        saveSystem: vi.fn().mockResolvedValue({ success: true }),
        saveRelationship: vi.fn().mockResolvedValue({ success: true }),
      } as never);

      SyncEngine.resetInstance();
      const engine = getSyncEngine();
      const result = await engine.syncFromMemory(mockWorkspaceData);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]?.entityType).toBe('table');
    });
  });

  describe('loadFromDatabase', () => {
    it('should return null for non-existent workspace', async () => {
      // Default mock returns empty rows
      const engine = getSyncEngine();
      const result = await engine.loadFromDatabase('nonexistent');

      expect(result).toBeNull();
    });

    it('should have loadFromDatabase method', () => {
      const engine = getSyncEngine();
      expect(typeof engine.loadFromDatabase).toBe('function');
    });
  });

  describe('File Sync Metadata', () => {
    it('should record file sync metadata', async () => {
      const { getDuckDBService } = await import('@/services/database/duckdbService');
      const mockExecute = vi.fn().mockResolvedValue({ success: true });
      vi.mocked(getDuckDBService).mockReturnValue({
        isInitialized: vi.fn().mockReturnValue(true),
        query: vi.fn().mockResolvedValue({ success: true, rows: [] }),
        execute: mockExecute,
      } as never);

      SyncEngine.resetInstance();
      const engine = getSyncEngine();
      await engine.recordFileSync('/path/to/file.yaml', 'table', 'table-1', 'content');

      expect(mockExecute).toHaveBeenCalled();
    });

    it('should detect file changes using hash', async () => {
      const { getDuckDBService } = await import('@/services/database/duckdbService');
      vi.mocked(getDuckDBService).mockReturnValue({
        isInitialized: vi.fn().mockReturnValue(true),
        query: vi.fn().mockResolvedValue({
          success: true,
          rows: [{ file_hash: 'different-hash' }],
        }),
        execute: vi.fn().mockResolvedValue({ success: true }),
      } as never);

      SyncEngine.resetInstance();
      const engine = getSyncEngine();
      const hasChanged = await engine.hasFileChanged('/path/to/file.yaml', 'new content');

      expect(hasChanged).toBe(true);
    });

    it('should return true for new files', async () => {
      const { getDuckDBService } = await import('@/services/database/duckdbService');
      vi.mocked(getDuckDBService).mockReturnValue({
        isInitialized: vi.fn().mockReturnValue(true),
        query: vi.fn().mockResolvedValue({
          success: true,
          rows: [],
        }),
        execute: vi.fn().mockResolvedValue({ success: true }),
      } as never);

      SyncEngine.resetInstance();
      const engine = getSyncEngine();
      const hasChanged = await engine.hasFileChanged('/path/to/new-file.yaml', 'content');

      expect(hasChanged).toBe(true);
    });

    it('should get all sync metadata', async () => {
      const { getDuckDBService } = await import('@/services/database/duckdbService');
      vi.mocked(getDuckDBService).mockReturnValue({
        isInitialized: vi.fn().mockReturnValue(true),
        query: vi.fn().mockResolvedValue({
          success: true,
          rows: [
            {
              file_path: '/path/to/file1.yaml',
              file_hash: 'hash1',
              resource_type: 'table',
              resource_id: 'table-1',
              last_synced_at: '2024-01-01T00:00:00Z',
              sync_status: 'synced',
            },
          ],
        }),
        execute: vi.fn().mockResolvedValue({ success: true }),
      } as never);

      SyncEngine.resetInstance();
      const engine = getSyncEngine();
      const metadata = await engine.getSyncMetadata();

      expect(Array.isArray(metadata)).toBe(true);
      expect(metadata.length).toBe(1);
      expect(metadata[0]?.filePath).toBe('/path/to/file1.yaml');
    });

    it('should clear sync metadata', async () => {
      const { getDuckDBService } = await import('@/services/database/duckdbService');
      const mockExecute = vi.fn().mockResolvedValue({ success: true });
      vi.mocked(getDuckDBService).mockReturnValue({
        isInitialized: vi.fn().mockReturnValue(true),
        query: vi.fn().mockResolvedValue({ success: true, rows: [] }),
        execute: mockExecute,
      } as never);

      SyncEngine.resetInstance();
      const engine = getSyncEngine();
      await engine.clearSyncMetadata();

      expect(mockExecute).toHaveBeenCalledWith('DELETE FROM sync_metadata');
    });
  });

  describe('Changed Files', () => {
    it('should get list of changed files', async () => {
      const { getDuckDBService } = await import('@/services/database/duckdbService');
      vi.mocked(getDuckDBService).mockReturnValue({
        isInitialized: vi.fn().mockReturnValue(true),
        query: vi.fn().mockResolvedValue({
          success: true,
          rows: [
            {
              file_path: '/path/to/modified.yaml',
              file_hash: 'hash',
              resource_type: 'table',
              resource_id: 'table-1',
              last_synced_at: '2024-01-01T00:00:00Z',
              sync_status: 'modified',
            },
          ],
        }),
        execute: vi.fn().mockResolvedValue({ success: true }),
      } as never);

      SyncEngine.resetInstance();
      const engine = getSyncEngine();
      const changedFiles = await engine.getChangedFiles();

      expect(changedFiles.length).toBe(1);
      expect(changedFiles[0]?.syncStatus).toBe('modified');
    });

    it('should mark file as modified', async () => {
      const { getDuckDBService } = await import('@/services/database/duckdbService');
      const mockExecute = vi.fn().mockResolvedValue({ success: true });
      vi.mocked(getDuckDBService).mockReturnValue({
        isInitialized: vi.fn().mockReturnValue(true),
        query: vi.fn().mockResolvedValue({ success: true, rows: [] }),
        execute: mockExecute,
      } as never);

      SyncEngine.resetInstance();
      const engine = getSyncEngine();
      await engine.markFileModified('/path/to/file.yaml');

      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE sync_metadata'),
        expect.arrayContaining(['/path/to/file.yaml'])
      );
    });
  });

  describe('Sync Statistics', () => {
    it('should get sync statistics', async () => {
      const { getDuckDBService } = await import('@/services/database/duckdbService');
      vi.mocked(getDuckDBService).mockReturnValue({
        isInitialized: vi.fn().mockReturnValue(true),
        query: vi
          .fn()
          .mockResolvedValueOnce({ success: true, rows: [{ count: 10 }] })
          .mockResolvedValueOnce({ success: true, rows: [{ count: 8 }] })
          .mockResolvedValueOnce({ success: true, rows: [{ count: 2 }] })
          .mockResolvedValueOnce({ success: true, rows: [{ last_sync: '2024-01-01T00:00:00Z' }] }),
        execute: vi.fn().mockResolvedValue({ success: true }),
      } as never);

      SyncEngine.resetInstance();
      const engine = getSyncEngine();
      const stats = await engine.getSyncStats();

      expect(stats.totalFiles).toBe(10);
      expect(stats.syncedFiles).toBe(8);
      expect(stats.modifiedFiles).toBe(2);
      expect(stats.lastSyncAt).toBe('2024-01-01T00:00:00Z');
    });
  });

  describe('Configuration', () => {
    it('should accept custom configuration', () => {
      SyncEngine.resetInstance();
      const engine = getSyncEngine({
        debug: true,
        conflictStrategy: 'db-wins',
        autoSync: true,
      });

      expect(engine).toBeDefined();
    });
  });
});
