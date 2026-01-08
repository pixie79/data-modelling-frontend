/**
 * Sync Engine for DuckDB-WASM
 *
 * Handles synchronization between YAML files and the DuckDB database.
 * Supports bidirectional sync with hash-based change detection.
 *
 * @module services/database/syncEngine
 */

import type { Table } from '@/types/table';
import type { Relationship } from '@/types/relationship';
import type { Domain } from '@/types/domain';
import type { System } from '@/types/system';
import type { Workspace } from '@/types/workspace';
import { getDuckDBService, type DuckDBService } from './duckdbService';
import { getDuckDBStorageAdapter, type DuckDBStorageAdapter } from './duckdbStorageAdapter';

/**
 * Sync status for tracking progress
 */
export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

/**
 * Sync direction
 */
export type SyncDirection = 'yaml-to-db' | 'db-to-yaml' | 'bidirectional';

/**
 * Sync result details
 */
export interface SyncResult {
  success: boolean;
  direction: SyncDirection;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  stats: {
    tablesProcessed: number;
    tablesAdded: number;
    tablesUpdated: number;
    tablesDeleted: number;
    relationshipsProcessed: number;
    domainsProcessed: number;
    systemsProcessed: number;
  };
  errors: SyncError[];
  warnings: string[];
}

/**
 * Sync error details
 */
export interface SyncError {
  entityType: 'table' | 'relationship' | 'domain' | 'system' | 'workspace';
  entityId?: string;
  message: string;
  filePath?: string;
}

/**
 * File sync metadata stored in DuckDB
 */
export interface FileSyncMetadata {
  filePath: string;
  fileHash: string;
  resourceType: string;
  resourceId: string;
  lastSyncedAt: string;
  syncStatus: 'synced' | 'modified' | 'new' | 'deleted';
}

/**
 * Sync engine configuration
 */
export interface SyncEngineConfig {
  /** Enable debug logging */
  debug?: boolean;
  /** Conflict resolution strategy */
  conflictStrategy?: 'yaml-wins' | 'db-wins' | 'prompt';
  /** Auto-sync on changes */
  autoSync?: boolean;
}

/**
 * Workspace data for sync operations
 */
export interface WorkspaceData {
  workspace: Workspace;
  domains: Domain[];
  tables: Table[];
  relationships: Relationship[];
  systems: System[];
}

/**
 * Sync Engine class
 */
class SyncEngine {
  private static instance: SyncEngine | null = null;
  private duckdb: DuckDBService;
  private storage: DuckDBStorageAdapter;
  private config: Required<SyncEngineConfig>;
  private status: SyncStatus = 'idle';

  private constructor(config?: SyncEngineConfig) {
    this.duckdb = getDuckDBService();
    this.storage = getDuckDBStorageAdapter();
    this.config = {
      debug: false,
      conflictStrategy: 'yaml-wins',
      autoSync: false,
      ...config,
    };
  }

  /**
   * Get the singleton instance
   */
  static getInstance(config?: SyncEngineConfig): SyncEngine {
    if (!SyncEngine.instance) {
      SyncEngine.instance = new SyncEngine(config);
    }
    return SyncEngine.instance;
  }

  /**
   * Reset singleton instance (for testing)
   */
  static resetInstance(): void {
    SyncEngine.instance = null;
  }

  /**
   * Log a message if debug is enabled
   */
  private log(message: string): void {
    if (this.config.debug) {
      console.log(`[SyncEngine] ${message}`);
    }
  }

  /**
   * Get current sync status
   */
  getStatus(): SyncStatus {
    return this.status;
  }

  /**
   * Compute SHA-256 hash of a string
   */
  private async computeHash(content: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Sync workspace data from memory to DuckDB
   */
  async syncFromMemory(data: WorkspaceData): Promise<SyncResult> {
    const startedAt = new Date().toISOString();
    const startTime = performance.now();
    this.status = 'syncing';

    const result: SyncResult = {
      success: true,
      direction: 'yaml-to-db',
      startedAt,
      completedAt: '',
      durationMs: 0,
      stats: {
        tablesProcessed: 0,
        tablesAdded: 0,
        tablesUpdated: 0,
        tablesDeleted: 0,
        relationshipsProcessed: 0,
        domainsProcessed: 0,
        systemsProcessed: 0,
      },
      errors: [],
      warnings: [],
    };

    try {
      // Initialize storage if needed
      const initResult = await this.storage.initialize();
      if (!initResult.success) {
        throw new Error(`Storage initialization failed: ${initResult.error}`);
      }

      // Sync workspace
      await this.syncWorkspace(data.workspace);

      // Sync domains
      for (const domain of data.domains) {
        try {
          await this.storage.saveDomain(domain);
          result.stats.domainsProcessed++;
        } catch (error) {
          result.errors.push({
            entityType: 'domain',
            entityId: domain.id,
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }

      // Sync systems
      for (const system of data.systems) {
        try {
          await this.storage.saveSystem(system);
          result.stats.systemsProcessed++;
        } catch (error) {
          result.errors.push({
            entityType: 'system',
            entityId: system.id,
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }

      // Sync tables
      for (const table of data.tables) {
        try {
          const existing = await this.storage.getTableById(table.id);
          await this.storage.saveTable(table);
          result.stats.tablesProcessed++;
          if (existing) {
            result.stats.tablesUpdated++;
          } else {
            result.stats.tablesAdded++;
          }
        } catch (error) {
          result.errors.push({
            entityType: 'table',
            entityId: table.id,
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }

      // Sync relationships
      for (const relationship of data.relationships) {
        try {
          await this.storage.saveRelationship(relationship);
          result.stats.relationshipsProcessed++;
        } catch (error) {
          result.errors.push({
            entityType: 'relationship',
            entityId: relationship.id,
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }

      result.success = result.errors.length === 0;
      this.status = result.success ? 'success' : 'error';
    } catch (error) {
      result.success = false;
      result.errors.push({
        entityType: 'workspace',
        message: error instanceof Error ? error.message : String(error),
      });
      this.status = 'error';
    }

    result.completedAt = new Date().toISOString();
    result.durationMs = performance.now() - startTime;

    this.log(
      `Sync completed in ${result.durationMs.toFixed(0)}ms: ` +
        `${result.stats.tablesProcessed} tables, ` +
        `${result.stats.relationshipsProcessed} relationships, ` +
        `${result.errors.length} errors`
    );

    return result;
  }

  /**
   * Load workspace data from DuckDB to memory
   */
  async loadFromDatabase(workspaceId: string): Promise<WorkspaceData | null> {
    this.status = 'syncing';

    try {
      // Initialize storage if needed
      const initResult = await this.storage.initialize();
      if (!initResult.success) {
        throw new Error(`Storage initialization failed: ${initResult.error}`);
      }

      // Load workspace
      const workspaceResult = await this.duckdb.query<WorkspaceRow>(
        'SELECT * FROM workspaces WHERE id = ?',
        [workspaceId]
      );

      if (!workspaceResult.success || workspaceResult.rows.length === 0) {
        this.status = 'idle';
        return null;
      }

      const workspaceRow = workspaceResult.rows[0];
      if (!workspaceRow) {
        this.status = 'idle';
        return null;
      }

      // Load domains
      const domains = await this.storage.getDomainsByWorkspace(workspaceId);

      // Load tables
      const tables = await this.storage.getTablesByWorkspace(workspaceId);

      // Load relationships
      const relationships = await this.storage.getRelationshipsByWorkspace(workspaceId);

      // Load systems (aggregate from all domains)
      const systems: System[] = [];
      for (const domain of domains) {
        const domainSystems = await this.storage.getSystemsByDomain(domain.id);
        systems.push(...domainSystems);
      }

      this.status = 'success';

      return {
        workspace: this.rowToWorkspace(workspaceRow),
        domains,
        tables,
        relationships,
        systems,
      };
    } catch (error) {
      this.log(`Load from database failed: ${error}`);
      this.status = 'error';
      return null;
    }
  }

  /**
   * Sync a workspace to DuckDB
   */
  private async syncWorkspace(workspace: Workspace): Promise<void> {
    await this.duckdb.execute(
      `INSERT OR REPLACE INTO workspaces (
        id, name, description, folder_path, format_version, sdk_version,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        workspace.id,
        workspace.name,
        null, // description - not in Workspace type
        null, // folder_path - not in Workspace type
        null, // format_version - not in Workspace type
        null, // sdk_version - not in Workspace type
        workspace.created_at,
      ]
    );
  }

  /**
   * Record file sync metadata
   */
  async recordFileSync(
    filePath: string,
    resourceType: string,
    resourceId: string,
    content: string
  ): Promise<void> {
    const fileHash = await this.computeHash(content);

    await this.duckdb.execute(
      `INSERT OR REPLACE INTO sync_metadata (
        file_path, file_hash, resource_type, resource_id, last_synced_at, sync_status
      ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, 'synced')`,
      [filePath, fileHash, resourceType, resourceId]
    );
  }

  /**
   * Check if a file has changed since last sync
   */
  async hasFileChanged(filePath: string, currentContent: string): Promise<boolean> {
    const currentHash = await this.computeHash(currentContent);

    const result = await this.duckdb.query<{ file_hash: string }>(
      'SELECT file_hash FROM sync_metadata WHERE file_path = ?',
      [filePath]
    );

    if (!result.success || result.rows.length === 0) {
      return true; // New file
    }

    const storedHash = result.rows[0]?.file_hash;
    return storedHash !== currentHash;
  }

  /**
   * Get all sync metadata
   */
  async getSyncMetadata(): Promise<FileSyncMetadata[]> {
    const result = await this.duckdb.query<FileSyncMetadataRow>(
      'SELECT * FROM sync_metadata ORDER BY last_synced_at DESC'
    );

    if (!result.success) {
      return [];
    }

    return result.rows.map((row) => ({
      filePath: row.file_path,
      fileHash: row.file_hash,
      resourceType: row.resource_type,
      resourceId: row.resource_id ?? '',
      lastSyncedAt: row.last_synced_at ?? '',
      syncStatus: (row.sync_status as FileSyncMetadata['syncStatus']) ?? 'synced',
    }));
  }

  /**
   * Clear all sync metadata
   */
  async clearSyncMetadata(): Promise<void> {
    await this.duckdb.execute('DELETE FROM sync_metadata');
  }

  /**
   * Get files that have changed since last sync
   */
  async getChangedFiles(): Promise<FileSyncMetadata[]> {
    const result = await this.duckdb.query<FileSyncMetadataRow>(
      "SELECT * FROM sync_metadata WHERE sync_status != 'synced'"
    );

    if (!result.success) {
      return [];
    }

    return result.rows.map((row) => ({
      filePath: row.file_path,
      fileHash: row.file_hash,
      resourceType: row.resource_type,
      resourceId: row.resource_id ?? '',
      lastSyncedAt: row.last_synced_at ?? '',
      syncStatus: (row.sync_status as FileSyncMetadata['syncStatus']) ?? 'modified',
    }));
  }

  /**
   * Mark a file as modified
   */
  async markFileModified(filePath: string): Promise<void> {
    await this.duckdb.execute(
      "UPDATE sync_metadata SET sync_status = 'modified' WHERE file_path = ?",
      [filePath]
    );
  }

  /**
   * Get sync statistics
   */
  async getSyncStats(): Promise<{
    totalFiles: number;
    syncedFiles: number;
    modifiedFiles: number;
    lastSyncAt: string | null;
  }> {
    const totalResult = await this.duckdb.query<{ count: number }>(
      'SELECT COUNT(*) as count FROM sync_metadata'
    );

    const syncedResult = await this.duckdb.query<{ count: number }>(
      "SELECT COUNT(*) as count FROM sync_metadata WHERE sync_status = 'synced'"
    );

    const modifiedResult = await this.duckdb.query<{ count: number }>(
      "SELECT COUNT(*) as count FROM sync_metadata WHERE sync_status = 'modified'"
    );

    const lastSyncResult = await this.duckdb.query<{ last_sync: string }>(
      'SELECT MAX(last_synced_at) as last_sync FROM sync_metadata'
    );

    return {
      totalFiles: totalResult.rows[0]?.count ?? 0,
      syncedFiles: syncedResult.rows[0]?.count ?? 0,
      modifiedFiles: modifiedResult.rows[0]?.count ?? 0,
      lastSyncAt: lastSyncResult.rows[0]?.last_sync ?? null,
    };
  }

  /**
   * Convert workspace row to Workspace type
   */
  private rowToWorkspace(row: WorkspaceRow): Workspace {
    return {
      id: row.id,
      name: row.name,
      owner_id: '', // Not stored in DB, derived from context
      created_at: row.created_at ?? new Date().toISOString(),
      last_modified_at: row.updated_at ?? new Date().toISOString(),
      domains: [],
    };
  }
}

// =========================================================================
// Row Type Definitions
// =========================================================================

interface WorkspaceRow {
  id: string;
  name: string;
  description: string | null;
  folder_path: string | null;
  format_version: string | null;
  sdk_version: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface FileSyncMetadataRow {
  file_path: string;
  file_hash: string;
  resource_type: string;
  resource_id: string | null;
  last_synced_at: string | null;
  sync_status: string | null;
}

/**
 * Get the sync engine singleton
 */
export function getSyncEngine(config?: SyncEngineConfig): SyncEngine {
  return SyncEngine.getInstance(config);
}

/**
 * Export the class for testing
 */
export { SyncEngine };
