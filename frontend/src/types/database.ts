/**
 * Type definitions for Database configuration and operations
 * SDK 1.13.1+ DuckDB/PostgreSQL backend support
 */

/**
 * Supported database backends
 */
export enum DatabaseBackend {
  None = 'none', // No database backend (YAML-only mode)
  DuckDB = 'duckdb', // Embedded analytical database
  PostgreSQL = 'postgres', // Server-based relational database
}

/**
 * PostgreSQL connection configuration
 */
export interface PostgresConfig {
  connection_string: string; // PostgreSQL connection URL
  pool_size?: number; // Connection pool size (default: 5)
  ssl_mode?: 'disable' | 'prefer' | 'require' | 'verify-ca' | 'verify-full';
  connect_timeout?: number; // Connection timeout in seconds
}

/**
 * Sync configuration options
 */
export interface SyncConfig {
  auto_sync: boolean; // Automatically sync YAML to database on load
  watch: boolean; // Watch for file changes and auto-sync
  sync_on_save: boolean; // Sync when saving changes
  conflict_strategy: 'database-wins' | 'yaml-wins' | 'prompt'; // How to handle conflicts
}

/**
 * Git hooks configuration
 */
export interface GitHooksConfig {
  hooks_enabled: boolean; // Enable Git hooks for automatic sync
  pre_commit: boolean; // Export database to YAML before commit
  post_checkout: boolean; // Sync YAML to database after checkout
  post_merge: boolean; // Sync YAML to database after merge
}

/**
 * Complete database configuration (corresponds to .data-model.toml)
 */
export interface DatabaseConfig {
  database: {
    backend: DatabaseBackend;
    path?: string; // Path to DuckDB file (relative to workspace)
  };
  postgres?: PostgresConfig;
  sync: SyncConfig;
  git: GitHooksConfig;
}

/**
 * Default database configuration
 */
export const DEFAULT_DATABASE_CONFIG: DatabaseConfig = {
  database: {
    backend: DatabaseBackend.None,
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

/**
 * Database connection status
 */
export enum ConnectionStatus {
  Disconnected = 'disconnected',
  Connecting = 'connecting',
  Connected = 'connected',
  Error = 'error',
}

/**
 * Database health status
 */
export interface DatabaseStatus {
  backend: DatabaseBackend;
  connection_status: ConnectionStatus;
  database_path?: string; // For DuckDB
  database_size?: number; // Size in bytes
  last_sync?: string; // ISO timestamp
  sync_status: SyncStatus;
  error?: string; // Error message if status is error
  metrics?: DatabaseMetrics;
}

/**
 * Sync status between YAML files and database
 */
export enum SyncStatus {
  InSync = 'in-sync',
  OutOfSync = 'out-of-sync',
  Syncing = 'syncing',
  Error = 'error',
  Unknown = 'unknown',
}

/**
 * Database metrics for monitoring
 */
export interface DatabaseMetrics {
  table_count: number;
  column_count: number;
  relationship_count: number;
  domain_count: number;
  decision_count: number;
  knowledge_count: number;
  last_query_time?: number; // Last query execution time in ms
}

/**
 * Sync operation result
 */
export interface SyncResult {
  success: boolean;
  started_at: string; // ISO timestamp
  completed_at: string; // ISO timestamp
  duration_ms: number;
  files_processed: number;
  files_added: number;
  files_updated: number;
  files_deleted: number;
  errors: SyncError[];
  warnings: string[];
}

/**
 * Sync error details
 */
export interface SyncError {
  file_path: string;
  error_type: 'parse' | 'validation' | 'io' | 'conflict';
  message: string;
  line?: number;
  column?: number;
}

/**
 * Export operation result
 */
export interface ExportResult {
  success: boolean;
  started_at: string; // ISO timestamp
  completed_at: string; // ISO timestamp
  duration_ms: number;
  files_exported: number;
  errors: ExportError[];
}

/**
 * Export error details
 */
export interface ExportError {
  entity_type: 'table' | 'domain' | 'relationship' | 'decision' | 'knowledge';
  entity_id: string;
  message: string;
}

/**
 * Query result from database
 */
export interface QueryResult<T = Record<string, unknown>> {
  success: boolean;
  data: T[];
  row_count: number;
  column_names: string[];
  execution_time_ms: number;
  error?: string;
}

/**
 * File sync metadata for change tracking
 */
export interface FileSyncMetadata {
  file_path: string;
  file_hash: string; // SHA-256 hash of file contents
  last_sync: string; // ISO timestamp
  sync_status: 'synced' | 'modified' | 'new' | 'deleted';
  entity_type: 'table' | 'domain' | 'relationship' | 'decision' | 'knowledge' | 'workspace';
  entity_id?: string; // UUID of the entity
}

/**
 * Database initialization options
 */
export interface DatabaseInitOptions {
  force_recreate?: boolean; // Drop and recreate database
  migrate_data?: boolean; // Migrate existing YAML data
  validate_schema?: boolean; // Validate database schema after init
}

/**
 * Conflict information during sync
 */
export interface SyncConflict {
  file_path: string;
  entity_type: string;
  entity_id: string;
  yaml_modified_at: string;
  database_modified_at: string;
  yaml_hash: string;
  database_hash: string;
  resolution?: 'yaml-wins' | 'database-wins' | 'manual';
}

/**
 * Validate database configuration
 */
export function validateDatabaseConfig(config: DatabaseConfig): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Validate backend
  if (!Object.values(DatabaseBackend).includes(config.database.backend)) {
    errors.push(`Invalid database backend: ${config.database.backend}`);
  }

  // Validate DuckDB path
  if (config.database.backend === DatabaseBackend.DuckDB) {
    if (!config.database.path) {
      errors.push('DuckDB path is required when using DuckDB backend');
    } else if (!config.database.path.endsWith('.duckdb')) {
      errors.push('DuckDB path should end with .duckdb extension');
    }
  }

  // Validate PostgreSQL config
  if (config.database.backend === DatabaseBackend.PostgreSQL) {
    if (!config.postgres?.connection_string) {
      errors.push('PostgreSQL connection string is required when using PostgreSQL backend');
    } else if (!config.postgres.connection_string.startsWith('postgresql://')) {
      errors.push('PostgreSQL connection string should start with postgresql://');
    }
    if (config.postgres?.pool_size !== undefined && config.postgres.pool_size < 1) {
      errors.push('PostgreSQL pool size must be at least 1');
    }
  }

  // Validate sync config
  if (!['database-wins', 'yaml-wins', 'prompt'].includes(config.sync.conflict_strategy)) {
    errors.push(`Invalid conflict strategy: ${config.sync.conflict_strategy}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Check if database backend is enabled
 */
export function isDatabaseEnabled(config: DatabaseConfig): boolean {
  return config.database.backend !== DatabaseBackend.None;
}

/**
 * Get database backend display name
 */
export function getDatabaseBackendLabel(backend: DatabaseBackend): string {
  const labels: Record<DatabaseBackend, string> = {
    [DatabaseBackend.None]: 'None (YAML only)',
    [DatabaseBackend.DuckDB]: 'DuckDB (Embedded)',
    [DatabaseBackend.PostgreSQL]: 'PostgreSQL (Server)',
  };
  return labels[backend];
}

/**
 * Get sync status display label
 */
export function getSyncStatusLabel(status: SyncStatus): string {
  const labels: Record<SyncStatus, string> = {
    [SyncStatus.InSync]: 'In Sync',
    [SyncStatus.OutOfSync]: 'Out of Sync',
    [SyncStatus.Syncing]: 'Syncing...',
    [SyncStatus.Error]: 'Sync Error',
    [SyncStatus.Unknown]: 'Unknown',
  };
  return labels[status];
}

/**
 * Get sync status color for UI
 */
export function getSyncStatusColor(status: SyncStatus): string {
  const colors: Record<SyncStatus, string> = {
    [SyncStatus.InSync]: 'green',
    [SyncStatus.OutOfSync]: 'yellow',
    [SyncStatus.Syncing]: 'blue',
    [SyncStatus.Error]: 'red',
    [SyncStatus.Unknown]: 'gray',
  };
  return colors[status];
}

/**
 * Get connection status color for UI
 */
export function getConnectionStatusColor(status: ConnectionStatus): string {
  const colors: Record<ConnectionStatus, string> = {
    [ConnectionStatus.Connected]: 'green',
    [ConnectionStatus.Connecting]: 'blue',
    [ConnectionStatus.Disconnected]: 'gray',
    [ConnectionStatus.Error]: 'red',
  };
  return colors[status];
}
