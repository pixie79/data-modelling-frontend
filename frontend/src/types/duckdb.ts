/**
 * DuckDB-WASM specific type definitions
 * For in-browser DuckDB with OPFS storage
 */

import type { AsyncDuckDB, AsyncDuckDBConnection } from '@duckdb/duckdb-wasm';

/**
 * DuckDB-WASM version (must match package.json)
 */
export const DUCKDB_WASM_VERSION = '1.32.0';

/**
 * CDN URL for DuckDB-WASM files (used when local files exceed size limits)
 */
export const DUCKDB_CDN_URL = `https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@${DUCKDB_WASM_VERSION}/dist/`;

/**
 * DuckDB-WASM configuration options
 */
export interface DuckDBConfig {
  /** Path to WASM files (default: CDN URL for web, '/duckdb/' for Electron) */
  wasmPath?: string;
  /** Use EH (Exception Handling) or MVP bundle */
  bundle?: 'eh' | 'mvp';
  /** Database file name in OPFS (default: 'data-modelling.duckdb') */
  databaseName?: string;
  /** Enable logging for debugging */
  debug?: boolean;
  /** Custom logger function */
  logger?: (message: string) => void;
  /** Force use of CDN even if local files exist */
  useCDN?: boolean;
}

/**
 * Check if running in Electron
 */
function isElectron(): boolean {
  return typeof window !== 'undefined' && 'electronAPI' in window;
}

/**
 * Default DuckDB-WASM configuration
 * Uses CDN for web deployments (Cloudflare Pages has 25MB file limit)
 * Uses local files for Electron (no size limit)
 */
export const DEFAULT_DUCKDB_CONFIG: Required<DuckDBConfig> = {
  wasmPath: isElectron() ? '/duckdb/' : DUCKDB_CDN_URL,
  bundle: 'eh',
  databaseName: 'data-modelling.duckdb',
  debug: false,
  logger: console.log,
  useCDN: !isElectron(),
};

/**
 * OPFS (Origin Private File System) support status
 */
export interface OPFSStatus {
  /** Whether OPFS is supported by the browser */
  supported: boolean;
  /** Whether OPFS is currently enabled and active */
  enabled: boolean;
  /** Storage quota information */
  quota?: {
    usage: number;
    quota: number;
    usagePercent: number;
  };
  /** Error message if OPFS is not available */
  error?: string;
}

/**
 * Storage mode for DuckDB
 */
export enum StorageMode {
  /** OPFS - persistent storage that survives page reloads */
  OPFS = 'opfs',
  /** In-memory - volatile storage, data lost on page reload */
  Memory = 'memory',
  /** IndexedDB fallback for older browsers */
  IndexedDB = 'indexeddb',
}

/**
 * DuckDB initialization result
 */
export interface DuckDBInitResult {
  success: boolean;
  db: AsyncDuckDB | null;
  conn: AsyncDuckDBConnection | null;
  storageMode: StorageMode;
  version?: string;
  error?: string;
}

/**
 * Query execution result with typed rows
 */
export interface DuckDBQueryResult<T = Record<string, unknown>> {
  success: boolean;
  rows: T[];
  rowCount: number;
  columnNames: string[];
  columnTypes: string[];
  executionTimeMs: number;
  error?: string;
}

/**
 * Prepared statement parameters
 */
export type DuckDBParams = (string | number | boolean | null | Date | Uint8Array)[];

/**
 * Table statistics for monitoring
 */
export interface TableStats {
  tableName: string;
  rowCount: number;
  sizeBytes: number;
  lastModified?: string;
}

/**
 * Database statistics
 */
export interface DuckDBStats {
  storageMode: StorageMode;
  databaseSizeBytes: number;
  tableCount: number;
  tables: TableStats[];
  isInitialized: boolean;
  version: string;
  lastError?: string;
}

/**
 * Schema migration definition
 */
export interface SchemaMigration {
  version: number;
  name: string;
  up: string; // SQL to apply migration
  down: string; // SQL to rollback migration
}

/**
 * Migration status
 */
export interface MigrationStatus {
  currentVersion: number;
  latestVersion: number;
  pendingMigrations: SchemaMigration[];
  appliedMigrations: { version: number; appliedAt: string }[];
}

/**
 * Sync metadata stored in DuckDB
 */
export interface DuckDBSyncMetadata {
  fileHash: string;
  lastSyncAt: string;
  entityType: string;
  entityId: string;
  filePath: string;
}

/**
 * Export format options
 */
export enum ExportFormat {
  DuckDB = 'duckdb', // Native .duckdb file
  Parquet = 'parquet', // Apache Parquet
  CSV = 'csv', // Comma-separated values
  JSON = 'json', // JSON lines
}

/**
 * Export options
 */
export interface ExportOptions {
  format: ExportFormat;
  tables?: string[]; // Specific tables to export, or all if empty
  includeMetadata?: boolean;
  compress?: boolean;
}

/**
 * Import options
 */
export interface ImportOptions {
  mergeStrategy: 'replace' | 'merge' | 'skip-existing';
  validateSchema?: boolean;
  dryRun?: boolean;
}

/**
 * DuckDB service interface
 */
export interface IDuckDBService {
  /** Initialize DuckDB with OPFS */
  initialize(config?: DuckDBConfig): Promise<DuckDBInitResult>;

  /** Terminate DuckDB and release resources */
  terminate(): Promise<void>;

  /** Check if DuckDB is initialized */
  isInitialized(): boolean;

  /** Get current storage mode */
  getStorageMode(): StorageMode;

  /** Execute a SQL query */
  query<T = Record<string, unknown>>(
    sql: string,
    params?: DuckDBParams
  ): Promise<DuckDBQueryResult<T>>;

  /** Execute SQL without returning results (INSERT, UPDATE, DELETE) */
  execute(sql: string, params?: DuckDBParams): Promise<{ success: boolean; error?: string }>;

  /** Execute multiple SQL statements in a transaction */
  transaction<T>(
    fn: (conn: AsyncDuckDBConnection) => Promise<T>
  ): Promise<{ success: boolean; result?: T; error?: string }>;

  /** Get database statistics */
  getStats(): Promise<DuckDBStats>;

  /** Get OPFS status */
  getOPFSStatus(): Promise<OPFSStatus>;

  /** Export database to specified format */
  export(options: ExportOptions): Promise<Blob>;

  /** Import data from file */
  import(data: Blob, options: ImportOptions): Promise<{ success: boolean; error?: string }>;

  /** Reset database (drop all tables and recreate schema) */
  reset(): Promise<{ success: boolean; error?: string }>;
}

/**
 * Browser capability check result
 */
export interface BrowserCapabilities {
  webAssembly: boolean;
  sharedArrayBuffer: boolean;
  opfs: boolean;
  webWorkers: boolean;
  crossOriginIsolated: boolean;
  recommended: boolean;
  warnings: string[];
}

/**
 * Check browser capabilities for DuckDB-WASM
 */
export function checkBrowserCapabilities(): BrowserCapabilities {
  const capabilities: BrowserCapabilities = {
    webAssembly: typeof WebAssembly !== 'undefined',
    sharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
    opfs: 'storage' in navigator && 'getDirectory' in (navigator.storage || {}),
    webWorkers: typeof Worker !== 'undefined',
    crossOriginIsolated: typeof crossOriginIsolated !== 'undefined' ? crossOriginIsolated : false,
    recommended: false,
    warnings: [],
  };

  // Check if recommended configuration
  capabilities.recommended =
    capabilities.webAssembly &&
    capabilities.sharedArrayBuffer &&
    capabilities.opfs &&
    capabilities.webWorkers;

  // Add warnings
  if (!capabilities.webAssembly) {
    capabilities.warnings.push('WebAssembly is not supported. DuckDB-WASM cannot run.');
  }
  if (!capabilities.sharedArrayBuffer) {
    capabilities.warnings.push('SharedArrayBuffer is not available. Performance may be degraded.');
  }
  if (!capabilities.crossOriginIsolated && capabilities.sharedArrayBuffer) {
    capabilities.warnings.push(
      'Cross-origin isolation is not enabled. Some features may not work.'
    );
  }
  if (!capabilities.opfs) {
    capabilities.warnings.push(
      'OPFS is not supported. Database will use in-memory storage (data lost on page reload).'
    );
  }

  return capabilities;
}
