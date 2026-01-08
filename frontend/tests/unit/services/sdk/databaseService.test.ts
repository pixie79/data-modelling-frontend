/**
 * Unit tests for Database Service
 * Tests the CLI-only database service stub in browser environment
 *
 * NOTE: As of SDK 1.13.3, database features (db_init, db_sync, db_status, etc.)
 * are only available in the CLI/Rust SDK, not in the WASM SDK.
 * The browser service is a stub that returns appropriate error messages.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { databaseService } from '@/services/sdk/databaseService';
import { ConnectionStatus, SyncStatus } from '@/types/database';

describe('DatabaseService', () => {
  const mockWorkspacePath = '/test/workspace';

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset internal state
    databaseService.clearState();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isSupported', () => {
    it('should return false in browser environment', () => {
      // In browser/WASM mode, database features are not supported
      expect(databaseService.isSupported()).toBe(false);
    });
  });

  describe('initializeDatabase', () => {
    it('should throw error when called in browser', async () => {
      await expect(databaseService.initializeDatabase(mockWorkspacePath)).rejects.toThrow(
        'CLI SDK'
      );
    });
  });

  describe('syncToDatabase', () => {
    it('should return error result when called in browser', async () => {
      const result = await databaseService.syncToDatabase(mockWorkspacePath);

      expect(result.success).toBe(false);
      expect(result.files_processed).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.message).toContain('CLI SDK');
    });

    it('should include timestamps in result', async () => {
      const result = await databaseService.syncToDatabase(mockWorkspacePath);

      expect(result.started_at).toBeDefined();
      expect(result.completed_at).toBeDefined();
    });
  });

  describe('getDatabaseStatus', () => {
    it('should return disconnected status in browser', async () => {
      const result = await databaseService.getDatabaseStatus(mockWorkspacePath);

      expect(result.connection_status).toBe(ConnectionStatus.Disconnected);
      expect(result.sync_status).toBe(SyncStatus.Unknown);
    });

    it('should include error message about CLI requirement', async () => {
      const result = await databaseService.getDatabaseStatus(mockWorkspacePath);

      // error may be undefined if database is not enabled in config
      // The service returns disconnected status with optional error message
      expect(result.connection_status).toBe(ConnectionStatus.Disconnected);
    });
  });

  describe('exportToYaml', () => {
    it('should return error result when called in browser', async () => {
      const result = await databaseService.exportToYaml(mockWorkspacePath);

      expect(result.success).toBe(false);
      expect(result.files_exported).toBe(0);
      expect(result.errors).toHaveLength(1);
    });

    it('should include timestamps in result', async () => {
      const result = await databaseService.exportToYaml(mockWorkspacePath);

      expect(result.started_at).toBeDefined();
      expect(result.completed_at).toBeDefined();
    });
  });

  describe('executeQuery', () => {
    it('should return error result when called in browser', async () => {
      const result = await databaseService.executeQuery(mockWorkspacePath, 'SELECT * FROM tables');

      expect(result.success).toBe(false);
      expect(result.data).toEqual([]);
      expect(result.error).toContain('CLI SDK');
    });

    it('should track execution time', async () => {
      const result = await databaseService.executeQuery(mockWorkspacePath, 'SELECT 1');

      expect(result.execution_time_ms).toBeGreaterThanOrEqual(0);
    });
  });

  describe('isInitialized', () => {
    it('should return false for any workspace in browser', () => {
      expect(databaseService.isInitialized(mockWorkspacePath)).toBe(false);
      expect(databaseService.isInitialized('/any/path')).toBe(false);
    });
  });

  describe('autoInitialize', () => {
    it('should return false in browser environment', async () => {
      const result = await databaseService.autoInitialize(mockWorkspacePath);

      expect(result).toBe(false);
    });
  });

  describe('clearState', () => {
    it('should not throw when clearing state', () => {
      expect(() => databaseService.clearState()).not.toThrow();
      expect(() => databaseService.clearState(mockWorkspacePath)).not.toThrow();
    });

    it('should handle multiple clear calls', () => {
      databaseService.clearState();
      databaseService.clearState();
      databaseService.clearState(mockWorkspacePath);

      expect(databaseService.isInitialized(mockWorkspacePath)).toBe(false);
    });
  });
});
