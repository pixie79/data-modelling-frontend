/**
 * Database Service
 * Handles DuckDB/PostgreSQL database operations via SDK 1.13.1+
 */

import { sdkLoader } from './sdkLoader';
import { databaseConfigService } from '@/services/storage/databaseConfigService';
import type {
  DatabaseStatus,
  SyncResult,
  ExportResult,
  QueryResult,
  DatabaseMetrics,
} from '@/types/database';
import { DatabaseBackend, ConnectionStatus, SyncStatus, isDatabaseEnabled } from '@/types/database';

/**
 * Database Service for SDK 1.13.1+ database operations
 */
class DatabaseService {
  private initialized: Map<string, boolean> = new Map();

  /**
   * Check if database features are supported by the current SDK
   */
  isSupported(): boolean {
    return sdkLoader.hasDatabaseSupport();
  }

  /**
   * Initialize database for a workspace
   */
  async initializeDatabase(workspacePath: string): Promise<void> {
    if (!this.isSupported()) {
      throw new Error('Database features require SDK 1.13.1+');
    }

    const config = await databaseConfigService.loadConfig(workspacePath);
    if (!isDatabaseEnabled(config)) {
      throw new Error('Database backend is not enabled in configuration');
    }

    const sdk = await sdkLoader.load();
    if (!sdk.db_init) {
      throw new Error('db_init method not available in SDK');
    }

    try {
      const configJson = JSON.stringify(config);
      const resultJson = sdk.db_init(workspacePath, configJson);
      const result = JSON.parse(resultJson);

      if (!result.success) {
        throw new Error(result.error || 'Database initialization failed');
      }

      this.initialized.set(workspacePath, true);
      console.log('[DatabaseService] Database initialized for:', workspacePath);
    } catch (error) {
      console.error('[DatabaseService] Initialization error:', error);
      throw error;
    }
  }

  /**
   * Sync YAML files to database
   */
  async syncToDatabase(workspacePath: string): Promise<SyncResult> {
    if (!this.isSupported()) {
      throw new Error('Database features require SDK 1.13.1+');
    }

    const sdk = await sdkLoader.load();
    if (!sdk.db_sync) {
      throw new Error('db_sync method not available in SDK');
    }

    const startTime = new Date().toISOString();

    try {
      const resultJson = sdk.db_sync(workspacePath);
      const result = JSON.parse(resultJson);

      const syncResult: SyncResult = {
        success: result.success ?? true,
        started_at: startTime,
        completed_at: new Date().toISOString(),
        duration_ms: result.duration_ms ?? 0,
        files_processed: result.files_processed ?? 0,
        files_added: result.files_added ?? 0,
        files_updated: result.files_updated ?? 0,
        files_deleted: result.files_deleted ?? 0,
        errors: result.errors ?? [],
        warnings: result.warnings ?? [],
      };

      console.log('[DatabaseService] Sync completed:', syncResult);
      return syncResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        started_at: startTime,
        completed_at: new Date().toISOString(),
        duration_ms: 0,
        files_processed: 0,
        files_added: 0,
        files_updated: 0,
        files_deleted: 0,
        errors: [
          {
            file_path: workspacePath,
            error_type: 'io',
            message: errorMessage,
          },
        ],
        warnings: [],
      };
    }
  }

  /**
   * Get database status
   */
  async getDatabaseStatus(workspacePath: string): Promise<DatabaseStatus> {
    const config = await databaseConfigService.loadConfig(workspacePath);

    // If database is not enabled, return disconnected status
    if (!isDatabaseEnabled(config)) {
      return {
        backend: DatabaseBackend.None,
        connection_status: ConnectionStatus.Disconnected,
        sync_status: SyncStatus.Unknown,
      };
    }

    // If SDK doesn't support database, return error status
    if (!this.isSupported()) {
      return {
        backend: config.database.backend,
        connection_status: ConnectionStatus.Error,
        sync_status: SyncStatus.Unknown,
        error: 'Database features require SDK 1.13.1+',
      };
    }

    const sdk = await sdkLoader.load();
    if (!sdk.db_status) {
      return {
        backend: config.database.backend,
        connection_status: ConnectionStatus.Error,
        sync_status: SyncStatus.Unknown,
        error: 'db_status method not available in SDK',
      };
    }

    try {
      const resultJson = sdk.db_status(workspacePath);
      const result = JSON.parse(resultJson);

      return {
        backend: config.database.backend,
        connection_status: result.connected
          ? ConnectionStatus.Connected
          : ConnectionStatus.Disconnected,
        database_path: result.database_path,
        database_size: result.database_size,
        last_sync: result.last_sync,
        sync_status: this.mapSyncStatus(result.sync_status),
        error: result.error,
        metrics: result.metrics as DatabaseMetrics,
      };
    } catch (error) {
      return {
        backend: config.database.backend,
        connection_status: ConnectionStatus.Error,
        sync_status: SyncStatus.Error,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Export database to YAML files
   */
  async exportToYaml(workspacePath: string): Promise<ExportResult> {
    if (!this.isSupported()) {
      throw new Error('Database features require SDK 1.13.1+');
    }

    const sdk = await sdkLoader.load();
    if (!sdk.db_export) {
      throw new Error('db_export method not available in SDK');
    }

    const startTime = new Date().toISOString();

    try {
      const resultJson = sdk.db_export(workspacePath);
      const result = JSON.parse(resultJson);

      return {
        success: result.success ?? true,
        started_at: startTime,
        completed_at: new Date().toISOString(),
        duration_ms: result.duration_ms ?? 0,
        files_exported: result.files_exported ?? 0,
        errors: result.errors ?? [],
      };
    } catch (error) {
      return {
        success: false,
        started_at: startTime,
        completed_at: new Date().toISOString(),
        duration_ms: 0,
        files_exported: 0,
        errors: [
          {
            entity_type: 'table',
            entity_id: '',
            message: error instanceof Error ? error.message : String(error),
          },
        ],
      };
    }
  }

  /**
   * Execute a SQL query against the database
   */
  async executeQuery<T = Record<string, unknown>>(
    workspacePath: string,
    sql: string
  ): Promise<QueryResult<T>> {
    if (!this.isSupported()) {
      throw new Error('Database features require SDK 1.13.1+');
    }

    const sdk = await sdkLoader.load();
    if (!sdk.db_query) {
      throw new Error('db_query method not available in SDK');
    }

    const startTime = performance.now();

    try {
      const resultJson = sdk.db_query(workspacePath, sql);
      const result = JSON.parse(resultJson);
      const endTime = performance.now();

      return {
        success: result.success ?? true,
        data: (result.data ?? []) as T[],
        row_count: result.row_count ?? result.data?.length ?? 0,
        column_names: result.column_names ?? [],
        execution_time_ms: endTime - startTime,
        error: result.error,
      };
    } catch (error) {
      return {
        success: false,
        data: [],
        row_count: 0,
        column_names: [],
        execution_time_ms: performance.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Check if database is initialized for a workspace
   */
  isInitialized(workspacePath: string): boolean {
    return this.initialized.get(workspacePath) ?? false;
  }

  /**
   * Auto-initialize database if configured
   */
  async autoInitialize(workspacePath: string): Promise<boolean> {
    try {
      const config = await databaseConfigService.loadConfig(workspacePath);

      if (!isDatabaseEnabled(config)) {
        return false;
      }

      if (!config.sync.auto_sync) {
        return false;
      }

      if (!this.isSupported()) {
        console.warn('[DatabaseService] Auto-init skipped: SDK 1.13.1+ required');
        return false;
      }

      // Initialize if not already done
      if (!this.isInitialized(workspacePath)) {
        await this.initializeDatabase(workspacePath);
      }

      // Sync files to database
      const syncResult = await this.syncToDatabase(workspacePath);
      return syncResult.success;
    } catch (error) {
      console.error('[DatabaseService] Auto-initialize failed:', error);
      return false;
    }
  }

  /**
   * Map SDK sync status to our enum
   */
  private mapSyncStatus(status: string | undefined): SyncStatus {
    switch (status?.toLowerCase()) {
      case 'in-sync':
      case 'insync':
      case 'synced':
        return SyncStatus.InSync;
      case 'out-of-sync':
      case 'outofsync':
      case 'dirty':
        return SyncStatus.OutOfSync;
      case 'syncing':
        return SyncStatus.Syncing;
      case 'error':
        return SyncStatus.Error;
      default:
        return SyncStatus.Unknown;
    }
  }

  /**
   * Clear initialization state (for testing or workspace close)
   */
  clearState(workspacePath?: string): void {
    if (workspacePath) {
      this.initialized.delete(workspacePath);
    } else {
      this.initialized.clear();
    }
  }
}

// Export singleton instance
export const databaseService = new DatabaseService();
