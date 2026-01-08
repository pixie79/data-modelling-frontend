/**
 * Database Service
 * Handles DuckDB/PostgreSQL database operations via SDK CLI
 *
 * IMPORTANT: Database methods (db_init, db_sync, db_status, db_export, db_query)
 * require native file system and database drivers (DuckDB/PostgreSQL).
 * These are only available via CLI or Rust API, NOT in WASM.
 *
 * For browser-based database functionality, use DuckDB-WASM directly
 * via the DuckDBContext and duckdbService.
 */

import { databaseConfigService } from '@/services/storage/databaseConfigService';
import type { DatabaseStatus, SyncResult, ExportResult, QueryResult } from '@/types/database';
import { DatabaseBackend, ConnectionStatus, SyncStatus, isDatabaseEnabled } from '@/types/database';

/**
 * Database Service for SDK CLI database operations
 *
 * NOTE: This service is a stub for WASM environments.
 * Database operations require the native CLI/Rust SDK.
 * In the browser, use DuckDB-WASM via DuckDBContext instead.
 */
class DatabaseService {
  private initialized: Map<string, boolean> = new Map();

  /**
   * Check if database features are supported by the current SDK
   *
   * NOTE: Database methods are CLI-only (not available in WASM SDK)
   * This always returns false in browser environments.
   */
  isSupported(): boolean {
    // Database methods (db_init, db_sync, etc.) are only available in CLI/Rust SDK
    // They are NOT available in the WASM SDK
    return false;
  }

  /**
   * Initialize database for a workspace
   *
   * NOTE: This is a CLI-only feature. In browser, use DuckDB-WASM instead.
   */
  async initializeDatabase(_workspacePath: string): Promise<void> {
    throw new Error(
      'Database initialization requires the CLI SDK. ' +
        'In browser environments, use DuckDB-WASM via DuckDBContext.'
    );
  }

  /**
   * Sync YAML files to database
   *
   * NOTE: This is a CLI-only feature. In browser, use DuckDB-WASM instead.
   */
  async syncToDatabase(_workspacePath: string): Promise<SyncResult> {
    const now = new Date().toISOString();
    return {
      success: false,
      started_at: now,
      completed_at: now,
      duration_ms: 0,
      files_processed: 0,
      files_added: 0,
      files_updated: 0,
      files_deleted: 0,
      errors: [
        {
          file_path: '',
          error_type: 'io',
          message: 'Database sync requires the CLI SDK. In browser environments, use DuckDB-WASM.',
        },
      ],
      warnings: [],
    };
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

    // SDK database features are CLI-only
    return {
      backend: config.database.backend,
      connection_status: ConnectionStatus.Disconnected,
      sync_status: SyncStatus.Unknown,
      error: 'Database operations require CLI SDK. Use DuckDB-WASM in browser.',
    };
  }

  /**
   * Export database to YAML files
   *
   * NOTE: This is a CLI-only feature.
   */
  async exportToYaml(_workspacePath: string): Promise<ExportResult> {
    const now = new Date().toISOString();
    return {
      success: false,
      started_at: now,
      completed_at: now,
      duration_ms: 0,
      files_exported: 0,
      errors: [
        {
          entity_type: 'table',
          entity_id: '',
          message: 'Database export requires the CLI SDK.',
        },
      ],
    };
  }

  /**
   * Execute a SQL query against the database
   *
   * NOTE: This is a CLI-only feature. In browser, use DuckDB-WASM directly.
   */
  async executeQuery<T = Record<string, unknown>>(
    _workspacePath: string,
    _sql: string
  ): Promise<QueryResult<T>> {
    return {
      success: false,
      data: [],
      row_count: 0,
      column_names: [],
      execution_time_ms: 0,
      error: 'Database queries require the CLI SDK. In browser, use DuckDB-WASM directly.',
    };
  }

  /**
   * Check if database is initialized for a workspace
   */
  isInitialized(workspacePath: string): boolean {
    return this.initialized.get(workspacePath) ?? false;
  }

  /**
   * Auto-initialize database if configured
   *
   * NOTE: This is a CLI-only feature. Returns false in browser.
   */
  async autoInitialize(_workspacePath: string): Promise<boolean> {
    // SDK database features are CLI-only, not available in WASM
    console.warn('[DatabaseService] Database features require CLI SDK, not available in WASM');
    return false;
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
