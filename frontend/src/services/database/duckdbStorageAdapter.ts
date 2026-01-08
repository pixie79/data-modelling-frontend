/**
 * DuckDB Storage Adapter
 *
 * Provides a storage interface using DuckDB-WASM for high-performance
 * SQL-based entity storage. Implements the same interface as existing
 * storage solutions but with O(1) ID lookups and SQL query capabilities.
 *
 * @module services/database/duckdbStorageAdapter
 */

import type { Table, Column } from '@/types/table';
import type { Relationship } from '@/types/relationship';
import type { Domain } from '@/types/domain';
import type { System } from '@/types/system';
import type { DuckDBQueryResult } from '@/types/duckdb';
import { getDuckDBService, type DuckDBService } from './duckdbService';
import { createSchemaManager, type SchemaManager } from './schemaManager';

/**
 * Storage adapter configuration
 */
export interface StorageAdapterConfig {
  /** Auto-initialize schema on first use */
  autoInitSchema?: boolean;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Entity counts for dashboard/statistics
 */
export interface EntityCounts {
  tables: number;
  columns: number;
  relationships: number;
  domains: number;
  systems: number;
  decisions: number;
  knowledgeArticles: number;
}

/**
 * DuckDB Storage Adapter class
 */
class DuckDBStorageAdapter {
  private static instance: DuckDBStorageAdapter | null = null;
  private duckdb: DuckDBService;
  private schemaManager: SchemaManager;
  private initialized = false;
  private config: Required<StorageAdapterConfig>;

  private constructor(config?: StorageAdapterConfig) {
    this.duckdb = getDuckDBService();
    this.schemaManager = createSchemaManager(this.duckdb);
    this.config = {
      autoInitSchema: true,
      debug: false,
      ...config,
    };
  }

  /**
   * Get the singleton instance
   */
  static getInstance(config?: StorageAdapterConfig): DuckDBStorageAdapter {
    if (!DuckDBStorageAdapter.instance) {
      DuckDBStorageAdapter.instance = new DuckDBStorageAdapter(config);
    }
    return DuckDBStorageAdapter.instance;
  }

  /**
   * Reset singleton instance (for testing)
   */
  static resetInstance(): void {
    DuckDBStorageAdapter.instance = null;
  }

  /**
   * Initialize the storage adapter
   */
  async initialize(): Promise<{ success: boolean; error?: string }> {
    if (this.initialized) {
      return { success: true };
    }

    // Initialize DuckDB
    const dbResult = await this.duckdb.initialize();
    if (!dbResult.success) {
      return { success: false, error: dbResult.error };
    }

    // Initialize schema if enabled
    if (this.config.autoInitSchema) {
      const schemaExists = await this.schemaManager.schemaExists();
      if (!schemaExists) {
        const schemaResult = await this.schemaManager.initializeSchema();
        if (!schemaResult.success) {
          return { success: false, error: schemaResult.error };
        }
      }

      // Run pending migrations
      const migrationResult = await this.schemaManager.runMigrations();
      if (!migrationResult.success) {
        return { success: false, error: migrationResult.error };
      }
    }

    this.initialized = true;
    return { success: true };
  }

  /**
   * Check if adapter is initialized
   */
  isInitialized(): boolean {
    return this.initialized && this.duckdb.isInitialized();
  }

  // =========================================================================
  // Table Operations
  // =========================================================================

  /**
   * Get a table by ID (O(1) lookup)
   */
  async getTableById(id: string): Promise<Table | null> {
    const result = await this.duckdb.query<TableRow>('SELECT * FROM tables WHERE id = ?', [id]);

    if (!result.success || result.rows.length === 0) {
      return null;
    }

    const tableRow = result.rows[0];
    if (!tableRow) return null;

    // Get columns for this table
    const columns = await this.getColumnsForTable(id);

    return this.rowToTable(tableRow, columns);
  }

  /**
   * Get all tables in a workspace
   */
  async getTablesByWorkspace(workspaceId: string): Promise<Table[]> {
    const result = await this.duckdb.query<TableRow>(
      'SELECT * FROM tables WHERE workspace_id = ? ORDER BY name',
      [workspaceId]
    );

    if (!result.success) {
      return [];
    }

    const tables: Table[] = [];
    for (const row of result.rows) {
      const columns = await this.getColumnsForTable(row.id);
      tables.push(this.rowToTable(row, columns));
    }

    return tables;
  }

  /**
   * Get tables by domain
   */
  async getTablesByDomain(domainId: string): Promise<Table[]> {
    const result = await this.duckdb.query<TableRow>(
      'SELECT * FROM tables WHERE domain_id = ? ORDER BY name',
      [domainId]
    );

    if (!result.success) {
      return [];
    }

    const tables: Table[] = [];
    for (const row of result.rows) {
      const columns = await this.getColumnsForTable(row.id);
      tables.push(this.rowToTable(row, columns));
    }

    return tables;
  }

  /**
   * Get tables by tag
   */
  async getTablesByTag(tag: string): Promise<Table[]> {
    const result = await this.duckdb.query<TableRow>(
      `SELECT DISTINCT t.* FROM tables t
       JOIN tags tg ON t.id = tg.resource_id AND tg.resource_type = 'table'
       WHERE tg.tag_value = ?
       ORDER BY t.name`,
      [tag]
    );

    if (!result.success) {
      return [];
    }

    const tables: Table[] = [];
    for (const row of result.rows) {
      const columns = await this.getColumnsForTable(row.id);
      tables.push(this.rowToTable(row, columns));
    }

    return tables;
  }

  /**
   * Save a table (insert or update)
   */
  async saveTable(table: Table): Promise<{ success: boolean; error?: string }> {
    const txResult = await this.duckdb.transaction(async () => {
      // Upsert the table
      await this.duckdb.execute(
        `INSERT OR REPLACE INTO tables (
          id, workspace_id, domain_id, system_id, name, alias, description,
          model_type, data_level, position_x, position_y, width, height,
          owner, sla, metadata, quality_rules, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [
          table.id,
          table.workspace_id,
          table.primary_domain_id,
          null, // system_id - not in Table interface directly
          table.name,
          table.alias ?? null,
          table.description ?? null,
          table.model_type,
          table.data_level ?? null,
          table.position_x,
          table.position_y,
          table.width,
          table.height,
          table.owner ? JSON.stringify(table.owner) : null,
          table.sla ? JSON.stringify(table.sla) : null,
          table.metadata ? JSON.stringify(table.metadata) : null,
          table.quality_rules ? JSON.stringify(table.quality_rules) : null,
          table.created_at,
        ]
      );

      // Delete existing columns and re-insert
      await this.duckdb.execute('DELETE FROM columns WHERE table_id = ?', [table.id]);

      for (const column of table.columns) {
        await this.saveColumn(column);
      }

      // Update tags
      await this.duckdb.execute(
        "DELETE FROM tags WHERE resource_id = ? AND resource_type = 'table'",
        [table.id]
      );

      if (table.tags && table.tags.length > 0) {
        for (const tag of table.tags) {
          await this.duckdb.execute(
            'INSERT INTO tags (resource_type, resource_id, tag_value) VALUES (?, ?, ?)',
            ['table', table.id, tag]
          );
        }
      }
    });

    return txResult.success ? { success: true } : { success: false, error: txResult.error };
  }

  /**
   * Delete a table
   */
  async deleteTable(id: string): Promise<{ success: boolean; error?: string }> {
    const txResult = await this.duckdb.transaction(async () => {
      // Delete columns first (due to foreign key relationship)
      await this.duckdb.execute('DELETE FROM columns WHERE table_id = ?', [id]);

      // Delete tags
      await this.duckdb.execute(
        "DELETE FROM tags WHERE resource_id = ? AND resource_type = 'table'",
        [id]
      );

      // Delete the table
      await this.duckdb.execute('DELETE FROM tables WHERE id = ?', [id]);
    });

    return txResult.success ? { success: true } : { success: false, error: txResult.error };
  }

  /**
   * Get columns for a table
   */
  private async getColumnsForTable(tableId: string): Promise<Column[]> {
    const result = await this.duckdb.query<ColumnRow>(
      'SELECT * FROM columns WHERE table_id = ? ORDER BY column_order',
      [tableId]
    );

    if (!result.success) {
      return [];
    }

    return result.rows.map((row) => this.rowToColumn(row));
  }

  /**
   * Save a column
   */
  private async saveColumn(column: Column): Promise<void> {
    await this.duckdb.execute(
      `INSERT OR REPLACE INTO columns (
        id, table_id, name, data_type, nullable, is_primary_key, is_foreign_key,
        description, column_order, logical_type, physical_type, constraints,
        quality_rules, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        column.id,
        column.table_id,
        column.name,
        column.data_type,
        column.nullable,
        column.is_primary_key,
        column.is_foreign_key,
        column.description ?? null,
        column.order,
        column.logicalTypeOptions ? JSON.stringify(column.logicalTypeOptions) : null,
        column.physicalName ?? null,
        column.constraints ? JSON.stringify(column.constraints) : null,
        column.quality_rules ? JSON.stringify(column.quality_rules) : null,
        column.created_at,
      ]
    );
  }

  // =========================================================================
  // Relationship Operations
  // =========================================================================

  /**
   * Get a relationship by ID
   */
  async getRelationshipById(id: string): Promise<Relationship | null> {
    const result = await this.duckdb.query<RelationshipRow>(
      'SELECT * FROM relationships WHERE id = ?',
      [id]
    );

    if (!result.success || result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return row ? this.rowToRelationship(row) : null;
  }

  /**
   * Get all relationships in a workspace
   */
  async getRelationshipsByWorkspace(workspaceId: string): Promise<Relationship[]> {
    const result = await this.duckdb.query<RelationshipRow>(
      'SELECT * FROM relationships WHERE workspace_id = ?',
      [workspaceId]
    );

    if (!result.success) {
      return [];
    }

    return result.rows.map((row) => this.rowToRelationship(row));
  }

  /**
   * Get relationships for a table (as source or target)
   */
  async getRelationshipsForTable(tableId: string): Promise<Relationship[]> {
    const result = await this.duckdb.query<RelationshipRow>(
      'SELECT * FROM relationships WHERE source_id = ? OR target_id = ?',
      [tableId, tableId]
    );

    if (!result.success) {
      return [];
    }

    return result.rows.map((row) => this.rowToRelationship(row));
  }

  /**
   * Get related tables using graph traversal (recursive CTE)
   */
  async getRelatedTables(tableId: string, depth: number = 2): Promise<Table[]> {
    // Use recursive CTE to find related tables up to specified depth
    const result = await this.duckdb.query<{ table_id: string }>(
      `WITH RECURSIVE related AS (
        -- Base case: direct relationships
        SELECT DISTINCT
          CASE WHEN source_id = ? THEN target_id ELSE source_id END as table_id,
          1 as depth
        FROM relationships
        WHERE (source_id = ? OR target_id = ?)
          AND source_type = 'table' AND target_type = 'table'

        UNION

        -- Recursive case: relationships from already found tables
        SELECT DISTINCT
          CASE WHEN r.source_id = rel.table_id THEN r.target_id ELSE r.source_id END,
          rel.depth + 1
        FROM related rel
        JOIN relationships r ON (r.source_id = rel.table_id OR r.target_id = rel.table_id)
        WHERE rel.depth < ?
          AND r.source_type = 'table' AND r.target_type = 'table'
      )
      SELECT DISTINCT table_id FROM related WHERE table_id != ?`,
      [tableId, tableId, tableId, depth, tableId]
    );

    if (!result.success) {
      return [];
    }

    const tables: Table[] = [];
    for (const row of result.rows) {
      const table = await this.getTableById(row.table_id);
      if (table) {
        tables.push(table);
      }
    }

    return tables;
  }

  /**
   * Save a relationship
   */
  async saveRelationship(
    relationship: Relationship
  ): Promise<{ success: boolean; error?: string }> {
    const result = await this.duckdb.execute(
      `INSERT OR REPLACE INTO relationships (
        id, workspace_id, domain_id, source_id, target_id, source_type, target_type,
        relationship_type, source_cardinality, target_cardinality, label, color,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        relationship.id,
        relationship.workspace_id,
        relationship.domain_id,
        relationship.source_id,
        relationship.target_id,
        relationship.source_type,
        relationship.target_type,
        relationship.type,
        relationship.source_cardinality,
        relationship.target_cardinality,
        relationship.label ?? null,
        relationship.color ?? null,
        relationship.created_at,
      ]
    );

    return result;
  }

  /**
   * Delete a relationship
   */
  async deleteRelationship(id: string): Promise<{ success: boolean; error?: string }> {
    return await this.duckdb.execute('DELETE FROM relationships WHERE id = ?', [id]);
  }

  // =========================================================================
  // Domain Operations
  // =========================================================================

  /**
   * Get a domain by ID
   */
  async getDomainById(id: string): Promise<Domain | null> {
    const result = await this.duckdb.query<DomainRow>('SELECT * FROM domains WHERE id = ?', [id]);

    if (!result.success || result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return row ? this.rowToDomain(row) : null;
  }

  /**
   * Get all domains in a workspace
   */
  async getDomainsByWorkspace(workspaceId: string): Promise<Domain[]> {
    const result = await this.duckdb.query<DomainRow>(
      'SELECT * FROM domains WHERE workspace_id = ? ORDER BY name',
      [workspaceId]
    );

    if (!result.success) {
      return [];
    }

    return result.rows.map((row) => this.rowToDomain(row));
  }

  /**
   * Get domain with entity counts
   */
  async getDomainWithCounts(id: string): Promise<{ domain: Domain; counts: EntityCounts } | null> {
    const domain = await this.getDomainById(id);
    if (!domain) {
      return null;
    }

    const counts = await this.getEntityCountsForDomain(id);
    return { domain, counts };
  }

  /**
   * Save a domain
   */
  async saveDomain(domain: Domain): Promise<{ success: boolean; error?: string }> {
    const result = await this.duckdb.execute(
      `INSERT OR REPLACE INTO domains (
        id, workspace_id, name, description, folder_path,
        position_x, position_y, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        domain.id,
        domain.workspace_id,
        domain.name,
        domain.description ?? null,
        domain.folder_path ?? null,
        0, // position_x
        0, // position_y
        domain.created_at,
      ]
    );

    return result;
  }

  /**
   * Delete a domain
   */
  async deleteDomain(id: string): Promise<{ success: boolean; error?: string }> {
    return await this.duckdb.execute('DELETE FROM domains WHERE id = ?', [id]);
  }

  // =========================================================================
  // System Operations
  // =========================================================================

  /**
   * Get a system by ID
   */
  async getSystemById(id: string): Promise<System | null> {
    const result = await this.duckdb.query<SystemRow>('SELECT * FROM systems WHERE id = ?', [id]);

    if (!result.success || result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return row ? this.rowToSystem(row) : null;
  }

  /**
   * Get systems by domain
   */
  async getSystemsByDomain(domainId: string): Promise<System[]> {
    const result = await this.duckdb.query<SystemRow>(
      'SELECT * FROM systems WHERE domain_id = ? ORDER BY name',
      [domainId]
    );

    if (!result.success) {
      return [];
    }

    return result.rows.map((row) => this.rowToSystem(row));
  }

  /**
   * Save a system
   */
  async saveSystem(system: System): Promise<{ success: boolean; error?: string }> {
    const result = await this.duckdb.execute(
      `INSERT OR REPLACE INTO systems (
        id, workspace_id, domain_id, name, description, system_type,
        connection_info, position_x, position_y, metadata, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        system.id,
        null, // workspace_id - derived from domain
        system.domain_id,
        system.name,
        system.description ?? null,
        system.system_type ?? null,
        system.connection_string ?? null,
        system.position_x ?? 0,
        system.position_y ?? 0,
        null, // metadata
        system.created_at,
      ]
    );

    return result;
  }

  /**
   * Delete a system
   */
  async deleteSystem(id: string): Promise<{ success: boolean; error?: string }> {
    return await this.duckdb.execute('DELETE FROM systems WHERE id = ?', [id]);
  }

  // =========================================================================
  // Query Helpers
  // =========================================================================

  /**
   * Get entity counts for a domain
   */
  private async getEntityCountsForDomain(domainId: string): Promise<EntityCounts> {
    const counts: EntityCounts = {
      tables: 0,
      columns: 0,
      relationships: 0,
      domains: 0,
      systems: 0,
      decisions: 0,
      knowledgeArticles: 0,
    };

    // Tables
    const tableResult = await this.duckdb.query<{ count: number }>(
      'SELECT COUNT(*) as count FROM tables WHERE domain_id = ?',
      [domainId]
    );
    counts.tables = tableResult.rows[0]?.count ?? 0;

    // Columns (via tables)
    const columnResult = await this.duckdb.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM columns c
       JOIN tables t ON c.table_id = t.id
       WHERE t.domain_id = ?`,
      [domainId]
    );
    counts.columns = columnResult.rows[0]?.count ?? 0;

    // Relationships
    const relResult = await this.duckdb.query<{ count: number }>(
      'SELECT COUNT(*) as count FROM relationships WHERE domain_id = ?',
      [domainId]
    );
    counts.relationships = relResult.rows[0]?.count ?? 0;

    // Systems
    const sysResult = await this.duckdb.query<{ count: number }>(
      'SELECT COUNT(*) as count FROM systems WHERE domain_id = ?',
      [domainId]
    );
    counts.systems = sysResult.rows[0]?.count ?? 0;

    // Decisions
    const decResult = await this.duckdb.query<{ count: number }>(
      'SELECT COUNT(*) as count FROM decisions WHERE domain_id = ?',
      [domainId]
    );
    counts.decisions = decResult.rows[0]?.count ?? 0;

    // Knowledge articles
    const kaResult = await this.duckdb.query<{ count: number }>(
      'SELECT COUNT(*) as count FROM knowledge_articles WHERE domain_id = ?',
      [domainId]
    );
    counts.knowledgeArticles = kaResult.rows[0]?.count ?? 0;

    return counts;
  }

  /**
   * Execute a raw SQL query
   */
  async query<T = Record<string, unknown>>(
    sql: string,
    params?: (string | number | boolean | null | Date | Uint8Array)[]
  ): Promise<DuckDBQueryResult<T>> {
    return await this.duckdb.query<T>(sql, params);
  }

  // =========================================================================
  // Row to Entity Converters
  // =========================================================================

  private rowToTable(row: TableRow, columns: Column[]): Table {
    return {
      id: row.id,
      workspace_id: row.workspace_id ?? '',
      primary_domain_id: row.domain_id ?? '',
      name: row.name,
      alias: row.alias ?? undefined,
      description: row.description ?? undefined,
      model_type: (row.model_type as Table['model_type']) ?? 'physical',
      columns,
      position_x: row.position_x ?? 0,
      position_y: row.position_y ?? 0,
      width: row.width ?? 200,
      height: row.height ?? 150,
      visible_domains: [],
      data_level: row.data_level as Table['data_level'],
      is_owned_by_domain: true,
      created_at: row.created_at ?? new Date().toISOString(),
      last_modified_at: row.updated_at ?? new Date().toISOString(),
      owner: row.owner ? JSON.parse(row.owner) : undefined,
      sla: row.sla ? JSON.parse(row.sla) : undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      quality_rules: row.quality_rules ? JSON.parse(row.quality_rules) : undefined,
    };
  }

  private rowToColumn(row: ColumnRow): Column {
    return {
      id: row.id,
      table_id: row.table_id,
      name: row.name,
      data_type: row.data_type,
      nullable: row.nullable ?? true,
      is_primary_key: row.is_primary_key ?? false,
      is_foreign_key: row.is_foreign_key ?? false,
      description: row.description ?? undefined,
      order: row.column_order ?? 0,
      created_at: row.created_at ?? new Date().toISOString(),
      constraints: row.constraints ? JSON.parse(row.constraints) : undefined,
      quality_rules: row.quality_rules ? JSON.parse(row.quality_rules) : undefined,
      logicalTypeOptions: row.logical_type ? JSON.parse(row.logical_type) : undefined,
      physicalName: row.physical_type ?? undefined,
    };
  }

  private rowToRelationship(row: RelationshipRow): Relationship {
    return {
      id: row.id,
      workspace_id: row.workspace_id ?? '',
      domain_id: row.domain_id ?? '',
      source_id: row.source_id,
      target_id: row.target_id,
      source_type: (row.source_type as Relationship['source_type']) ?? 'table',
      target_type: (row.target_type as Relationship['target_type']) ?? 'table',
      type: (row.relationship_type as Relationship['type']) ?? 'one-to-many',
      source_cardinality: (row.source_cardinality as Relationship['source_cardinality']) ?? '1',
      target_cardinality: (row.target_cardinality as Relationship['target_cardinality']) ?? 'N',
      label: row.label ?? undefined,
      color: row.color ?? undefined,
      model_type: 'physical',
      is_circular: false,
      created_at: row.created_at ?? new Date().toISOString(),
      last_modified_at: row.updated_at ?? new Date().toISOString(),
    };
  }

  private rowToDomain(row: DomainRow): Domain {
    return {
      id: row.id,
      workspace_id: row.workspace_id ?? '',
      name: row.name,
      description: row.description ?? undefined,
      folder_path: row.folder_path ?? undefined,
      created_at: row.created_at ?? new Date().toISOString(),
      last_modified_at: row.updated_at ?? new Date().toISOString(),
    };
  }

  private rowToSystem(row: SystemRow): System {
    return {
      id: row.id,
      domain_id: row.domain_id ?? '',
      name: row.name,
      description: row.description ?? undefined,
      system_type: (row.system_type as System['system_type']) ?? 'system',
      connection_string: row.connection_info ?? undefined,
      position_x: row.position_x ?? 0,
      position_y: row.position_y ?? 0,
      created_at: row.created_at ?? new Date().toISOString(),
      last_modified_at: row.updated_at ?? new Date().toISOString(),
    };
  }
}

// =========================================================================
// Row Type Definitions
// =========================================================================

interface TableRow {
  id: string;
  workspace_id: string | null;
  domain_id: string | null;
  system_id: string | null;
  name: string;
  alias: string | null;
  description: string | null;
  model_type: string | null;
  data_level: string | null;
  position_x: number | null;
  position_y: number | null;
  width: number | null;
  height: number | null;
  owner: string | null;
  sla: string | null;
  metadata: string | null;
  quality_rules: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface ColumnRow {
  id: string;
  table_id: string;
  name: string;
  data_type: string;
  nullable: boolean | null;
  is_primary_key: boolean | null;
  is_foreign_key: boolean | null;
  description: string | null;
  column_order: number | null;
  logical_type: string | null;
  physical_type: string | null;
  constraints: string | null;
  quality_rules: string | null;
  created_at: string | null;
}

interface RelationshipRow {
  id: string;
  workspace_id: string | null;
  domain_id: string | null;
  source_id: string;
  target_id: string;
  source_type: string | null;
  target_type: string | null;
  relationship_type: string | null;
  source_cardinality: string | null;
  target_cardinality: string | null;
  label: string | null;
  color: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface DomainRow {
  id: string;
  workspace_id: string | null;
  name: string;
  description: string | null;
  folder_path: string | null;
  position_x: number | null;
  position_y: number | null;
  created_at: string | null;
  updated_at: string | null;
}

interface SystemRow {
  id: string;
  workspace_id: string | null;
  domain_id: string | null;
  name: string;
  description: string | null;
  system_type: string | null;
  connection_info: string | null;
  position_x: number | null;
  position_y: number | null;
  metadata: string | null;
  created_at: string | null;
  updated_at: string | null;
}

/**
 * Get the DuckDB storage adapter singleton
 */
export function getDuckDBStorageAdapter(config?: StorageAdapterConfig): DuckDBStorageAdapter {
  return DuckDBStorageAdapter.getInstance(config);
}

/**
 * Export the class for testing
 */
export { DuckDBStorageAdapter };
