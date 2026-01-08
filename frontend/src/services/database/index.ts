/**
 * Database Services Index
 *
 * Exports all DuckDB-WASM related services for the data modelling application.
 *
 * @module services/database
 */

// DuckDB Service
export { getDuckDBService, DuckDBService } from './duckdbService';
export * from './duckdbService';

// OPFS Manager
export { getOPFSManager, OPFSManager } from './opfsManager';
export type { OPFSFileInfo, OPFSQuotaInfo } from './opfsManager';

// Schema Manager
export {
  createSchemaManager,
  SchemaManager,
  SCHEMA_VERSION,
  SCHEMA_SQL,
  INDEX_SQL,
  MIGRATIONS,
} from './schemaManager';

// Storage Adapter
export { getDuckDBStorageAdapter, DuckDBStorageAdapter } from './duckdbStorageAdapter';
export type { StorageAdapterConfig, EntityCounts } from './duckdbStorageAdapter';

// Sync Engine
export { getSyncEngine, SyncEngine } from './syncEngine';
export type {
  SyncStatus,
  SyncDirection,
  SyncResult,
  SyncError,
  FileSyncMetadata,
  SyncEngineConfig,
  WorkspaceData,
} from './syncEngine';

// Electron DuckDB Service (native file operations)
export { getElectronDuckDBService, ElectronDuckDBService } from './electronDuckDBService';
export type {
  NativeExportFormat,
  NativeExportOptions,
  NativeExportResult,
  NativeImportOptions,
  NativeImportResult,
} from './electronDuckDBService';

// Query Builder
export { query, QueryBuilder, InsertBuilder, UpdateBuilder, DeleteBuilder } from './queryBuilder';
export type {
  ComparisonOperator,
  LogicalOperator,
  SortDirection,
  JoinType,
  WhereCondition,
  JoinClause,
  OrderByClause,
} from './queryBuilder';

// Re-export types
export * from '@/types/duckdb';
