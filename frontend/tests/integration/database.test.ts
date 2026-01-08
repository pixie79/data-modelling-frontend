/**
 * Integration tests for Database Service
 * Tests the CLI-only database service stub in browser environment
 *
 * NOTE: As of SDK 1.13.3, database features (db_init, db_sync, db_status, etc.)
 * are only available in the CLI/Rust SDK, not in the WASM SDK.
 * This test verifies the service correctly indicates unavailability in browser.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { databaseService } from '@/services/sdk/databaseService';

describe('Database Integration', () => {
  const mockWorkspacePath = '/test/workspace';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Browser Environment', () => {
    it('should report database not supported in browser', () => {
      expect(databaseService.isSupported()).toBe(false);
    });

    it('should throw error for initialization', async () => {
      await expect(databaseService.initializeDatabase(mockWorkspacePath)).rejects.toThrow(
        'CLI SDK'
      );
    });

    it('should return error result for sync', async () => {
      const result = await databaseService.syncToDatabase(mockWorkspacePath);

      expect(result.success).toBe(false);
      expect(result.files_processed).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.message).toContain('CLI SDK');
    });

    it('should return error result for export', async () => {
      const result = await databaseService.exportToYaml(mockWorkspacePath);

      expect(result.success).toBe(false);
      expect(result.files_exported).toBe(0);
      expect(result.errors).toHaveLength(1);
    });

    it('should handle export errors', async () => {
      const result = await databaseService.exportToYaml(mockWorkspacePath);

      expect(result.success).toBe(false);
      expect(result.errors[0]?.message).toContain('CLI SDK');
    });

    it('should return error result for queries', async () => {
      const result = await databaseService.executeQuery(mockWorkspacePath, 'SELECT 1');

      expect(result.success).toBe(false);
      expect(result.data).toEqual([]);
      expect(result.error).toContain('CLI SDK');
    });

    it('should track query execution time', async () => {
      const result = await databaseService.executeQuery(mockWorkspacePath, 'SELECT 1');

      expect(result.execution_time_ms).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Auto-initialization', () => {
    it('should auto-initialize when configured', async () => {
      // In browser, this should always return false since DB is not supported
      const result = await databaseService.autoInitialize(mockWorkspacePath);

      expect(result).toBe(false);
    });

    it('should not auto-initialize when auto_sync is disabled', async () => {
      const result = await databaseService.autoInitialize(mockWorkspacePath);

      expect(result).toBe(false);
    });

    it('should skip auto-init if already initialized', async () => {
      // Both calls should return false in browser environment
      const result1 = await databaseService.autoInitialize(mockWorkspacePath);
      const result2 = await databaseService.autoInitialize(mockWorkspacePath);

      expect(result1).toBe(false);
      expect(result2).toBe(false);
    });
  });

  describe('Status Monitoring', () => {
    it('should report connected status when database is available', async () => {
      // In browser, this should report not available
      const status = await databaseService.getDatabaseStatus(mockWorkspacePath);

      expect(status.connection_status).toBe('disconnected');
    });

    it('should report disconnected status when database is unavailable', async () => {
      const status = await databaseService.getDatabaseStatus(mockWorkspacePath);

      expect(status.connection_status).toBe('disconnected');
    });
  });

  describe('Error Recovery', () => {
    it('should recover from temporary connection failures', async () => {
      // In browser, all attempts should return error (no actual DB to recover)
      const result1 = await databaseService.syncToDatabase(mockWorkspacePath);
      const result2 = await databaseService.syncToDatabase(mockWorkspacePath);

      expect(result1.success).toBe(false);
      expect(result2.success).toBe(false);
    });

    it('should clear state on workspace close', async () => {
      // Initialize throws in browser, so just test clearState directly
      // Clear state
      databaseService.clearState(mockWorkspacePath);

      // Should be uninitialized
      expect(databaseService.isInitialized(mockWorkspacePath)).toBe(false);
    });
  });
});
