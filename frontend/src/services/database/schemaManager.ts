/**
 * Schema Manager for DuckDB-WASM
 *
 * Manages database schema creation, migrations, and versioning.
 * Defines all table structures for the data modelling application.
 *
 * @module services/database/schemaManager
 */

import type { DuckDBService } from './duckdbService';
import type { SchemaMigration, MigrationStatus } from '@/types/duckdb';

/**
 * Current schema version
 */
export const SCHEMA_VERSION = 1;

/**
 * Schema definitions for all tables
 */
export const SCHEMA_SQL = {
  /**
   * Workspaces table
   */
  workspaces: `
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      folder_path TEXT,
      format_version TEXT,
      sdk_version TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `,

  /**
   * Domains table
   */
  domains: `
    CREATE TABLE IF NOT EXISTS domains (
      id TEXT PRIMARY KEY,
      workspace_id TEXT,
      name TEXT NOT NULL,
      description TEXT,
      folder_path TEXT,
      position_x REAL DEFAULT 0,
      position_y REAL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `,

  /**
   * Tables (ODCS resources) table
   */
  tables: `
    CREATE TABLE IF NOT EXISTS tables (
      id TEXT PRIMARY KEY,
      workspace_id TEXT,
      domain_id TEXT,
      system_id TEXT,
      name TEXT NOT NULL,
      alias TEXT,
      description TEXT,
      model_type TEXT,
      data_level TEXT,
      position_x REAL DEFAULT 0,
      position_y REAL DEFAULT 0,
      width REAL DEFAULT 200,
      height REAL DEFAULT 150,
      owner TEXT,
      sla TEXT,
      metadata TEXT,
      quality_rules TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `,

  /**
   * Columns table
   */
  columns: `
    CREATE TABLE IF NOT EXISTS columns (
      id TEXT PRIMARY KEY,
      table_id TEXT NOT NULL,
      name TEXT NOT NULL,
      data_type TEXT NOT NULL,
      nullable BOOLEAN DEFAULT true,
      is_primary_key BOOLEAN DEFAULT false,
      is_foreign_key BOOLEAN DEFAULT false,
      description TEXT,
      column_order INTEGER DEFAULT 0,
      logical_type TEXT,
      physical_type TEXT,
      constraints TEXT,
      quality_rules TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `,

  /**
   * Relationships table
   */
  relationships: `
    CREATE TABLE IF NOT EXISTS relationships (
      id TEXT PRIMARY KEY,
      workspace_id TEXT,
      domain_id TEXT,
      source_id TEXT NOT NULL,
      target_id TEXT NOT NULL,
      source_type TEXT NOT NULL DEFAULT 'table',
      target_type TEXT NOT NULL DEFAULT 'table',
      relationship_type TEXT DEFAULT 'references',
      source_cardinality TEXT DEFAULT 'one',
      target_cardinality TEXT DEFAULT 'many',
      label TEXT,
      color TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `,

  /**
   * Systems table
   */
  systems: `
    CREATE TABLE IF NOT EXISTS systems (
      id TEXT PRIMARY KEY,
      workspace_id TEXT,
      domain_id TEXT,
      name TEXT NOT NULL,
      description TEXT,
      system_type TEXT,
      connection_info TEXT,
      position_x REAL DEFAULT 0,
      position_y REAL DEFAULT 0,
      metadata TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `,

  /**
   * Tags table for normalized tag storage
   */
  tags: `
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY,
      resource_type TEXT NOT NULL,
      resource_id TEXT NOT NULL,
      tag_key TEXT,
      tag_value TEXT NOT NULL
    )
  `,

  /**
   * Sync metadata for change detection
   */
  sync_metadata: `
    CREATE TABLE IF NOT EXISTS sync_metadata (
      file_path TEXT PRIMARY KEY,
      file_hash TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT,
      last_synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      sync_status TEXT DEFAULT 'synced'
    )
  `,

  /**
   * Decision logs (ADRs)
   */
  decisions: `
    CREATE TABLE IF NOT EXISTS decisions (
      id TEXT PRIMARY KEY,
      workspace_id TEXT,
      domain_id TEXT,
      number INTEGER,
      title TEXT NOT NULL,
      status TEXT DEFAULT 'proposed',
      category TEXT,
      context TEXT,
      decision TEXT,
      consequences TEXT,
      options TEXT,
      superseded_by TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `,

  /**
   * Knowledge articles
   */
  knowledge_articles: `
    CREATE TABLE IF NOT EXISTS knowledge_articles (
      id TEXT PRIMARY KEY,
      workspace_id TEXT,
      domain_id TEXT,
      number INTEGER,
      title TEXT NOT NULL,
      article_type TEXT,
      status TEXT DEFAULT 'draft',
      summary TEXT,
      content TEXT,
      authors TEXT,
      reviewers TEXT,
      published_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `,

  /**
   * Schema migrations tracking
   */
  schema_migrations: `
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `,
};

/**
 * Index definitions for query optimization
 */
export const INDEX_SQL = {
  // Table indexes
  idx_tables_workspace: `CREATE INDEX IF NOT EXISTS idx_tables_workspace ON tables(workspace_id)`,
  idx_tables_domain: `CREATE INDEX IF NOT EXISTS idx_tables_domain ON tables(domain_id)`,
  idx_tables_system: `CREATE INDEX IF NOT EXISTS idx_tables_system ON tables(system_id)`,
  idx_tables_name: `CREATE INDEX IF NOT EXISTS idx_tables_name ON tables(name)`,

  // Column indexes
  idx_columns_table: `CREATE INDEX IF NOT EXISTS idx_columns_table ON columns(table_id)`,
  idx_columns_name: `CREATE INDEX IF NOT EXISTS idx_columns_name ON columns(name)`,

  // Relationship indexes
  idx_relationships_workspace: `CREATE INDEX IF NOT EXISTS idx_relationships_workspace ON relationships(workspace_id)`,
  idx_relationships_source: `CREATE INDEX IF NOT EXISTS idx_relationships_source ON relationships(source_id)`,
  idx_relationships_target: `CREATE INDEX IF NOT EXISTS idx_relationships_target ON relationships(target_id)`,

  // Domain indexes
  idx_domains_workspace: `CREATE INDEX IF NOT EXISTS idx_domains_workspace ON domains(workspace_id)`,

  // System indexes
  idx_systems_workspace: `CREATE INDEX IF NOT EXISTS idx_systems_workspace ON systems(workspace_id)`,
  idx_systems_domain: `CREATE INDEX IF NOT EXISTS idx_systems_domain ON systems(domain_id)`,

  // Tag indexes
  idx_tags_resource: `CREATE INDEX IF NOT EXISTS idx_tags_resource ON tags(resource_id, resource_type)`,
  idx_tags_value: `CREATE INDEX IF NOT EXISTS idx_tags_value ON tags(tag_value)`,
  idx_tags_key_value: `CREATE INDEX IF NOT EXISTS idx_tags_key_value ON tags(tag_key, tag_value)`,

  // Sync metadata indexes
  idx_sync_resource: `CREATE INDEX IF NOT EXISTS idx_sync_resource ON sync_metadata(resource_type, resource_id)`,

  // Decision indexes
  idx_decisions_workspace: `CREATE INDEX IF NOT EXISTS idx_decisions_workspace ON decisions(workspace_id)`,
  idx_decisions_domain: `CREATE INDEX IF NOT EXISTS idx_decisions_domain ON decisions(domain_id)`,
  idx_decisions_status: `CREATE INDEX IF NOT EXISTS idx_decisions_status ON decisions(status)`,

  // Knowledge indexes
  idx_knowledge_workspace: `CREATE INDEX IF NOT EXISTS idx_knowledge_workspace ON knowledge_articles(workspace_id)`,
  idx_knowledge_domain: `CREATE INDEX IF NOT EXISTS idx_knowledge_domain ON knowledge_articles(domain_id)`,
  idx_knowledge_type: `CREATE INDEX IF NOT EXISTS idx_knowledge_type ON knowledge_articles(article_type)`,
};

/**
 * Schema migrations for version upgrades
 */
export const MIGRATIONS: SchemaMigration[] = [
  {
    version: 1,
    name: 'initial_schema',
    up: '-- Initial schema created in createSchema()',
    down: `
      DROP TABLE IF EXISTS knowledge_articles;
      DROP TABLE IF EXISTS decisions;
      DROP TABLE IF EXISTS sync_metadata;
      DROP TABLE IF EXISTS tags;
      DROP TABLE IF EXISTS systems;
      DROP TABLE IF EXISTS relationships;
      DROP TABLE IF EXISTS columns;
      DROP TABLE IF EXISTS tables;
      DROP TABLE IF EXISTS domains;
      DROP TABLE IF EXISTS workspaces;
      DROP TABLE IF EXISTS schema_migrations;
    `,
  },
  // Future migrations will be added here
  // {
  //   version: 2,
  //   name: 'add_quality_score',
  //   up: 'ALTER TABLE tables ADD COLUMN quality_score REAL DEFAULT 0',
  //   down: 'ALTER TABLE tables DROP COLUMN quality_score',
  // },
];

/**
 * Schema Manager class
 */
class SchemaManager {
  private duckdbService: DuckDBService;

  constructor(duckdbService: DuckDBService) {
    this.duckdbService = duckdbService;
  }

  /**
   * Initialize the database schema
   */
  async initializeSchema(): Promise<{ success: boolean; error?: string }> {
    try {
      // Create all tables
      for (const [tableName, sql] of Object.entries(SCHEMA_SQL)) {
        const result = await this.duckdbService.execute(sql);
        if (!result.success) {
          return { success: false, error: `Failed to create ${tableName}: ${result.error}` };
        }
      }

      // Create all indexes
      for (const [indexName, sql] of Object.entries(INDEX_SQL)) {
        const result = await this.duckdbService.execute(sql);
        if (!result.success) {
          console.warn(`Warning: Failed to create ${indexName}: ${result.error}`);
          // Don't fail on index creation - they're optional optimizations
        }
      }

      // Record initial migration
      await this.recordMigration(1, 'initial_schema');

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Check if schema exists
   */
  async schemaExists(): Promise<boolean> {
    const result = await this.duckdbService.query<{ count: number }>(
      "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = 'main' AND table_name = 'workspaces'"
    );
    return result.success && (result.rows[0]?.count ?? 0) > 0;
  }

  /**
   * Get current migration status
   */
  async getMigrationStatus(): Promise<MigrationStatus> {
    const result = await this.duckdbService.query<{ version: number; applied_at: string }>(
      'SELECT version, applied_at FROM schema_migrations ORDER BY version DESC'
    );

    const appliedMigrations = result.success
      ? result.rows.map((r) => ({ version: r.version, appliedAt: r.applied_at ?? '' }))
      : [];

    const currentVersion = appliedMigrations.length > 0 ? (appliedMigrations[0]?.version ?? 0) : 0;

    const pendingMigrations = MIGRATIONS.filter((m) => m.version > currentVersion);

    const lastMigration = MIGRATIONS[MIGRATIONS.length - 1];
    return {
      currentVersion,
      latestVersion: lastMigration?.version ?? 0,
      pendingMigrations,
      appliedMigrations,
    };
  }

  /**
   * Run pending migrations
   */
  async runMigrations(): Promise<{ success: boolean; migrationsRun: number; error?: string }> {
    const status = await this.getMigrationStatus();

    if (status.pendingMigrations.length === 0) {
      return { success: true, migrationsRun: 0 };
    }

    let migrationsRun = 0;

    for (const migration of status.pendingMigrations) {
      const txResult = await this.duckdbService.transaction(async () => {
        // Run the migration SQL
        if (migration.up !== '-- Initial schema created in createSchema()') {
          await this.duckdbService.execute(migration.up);
        }

        // Record the migration
        await this.recordMigration(migration.version, migration.name);
      });

      if (!txResult.success) {
        return {
          success: false,
          migrationsRun,
          error: `Migration ${migration.version} (${migration.name}) failed: ${txResult.error}`,
        };
      }

      migrationsRun++;
    }

    return { success: true, migrationsRun };
  }

  /**
   * Rollback to a specific version
   */
  async rollbackTo(targetVersion: number): Promise<{ success: boolean; error?: string }> {
    const status = await this.getMigrationStatus();

    if (targetVersion >= status.currentVersion) {
      return { success: false, error: 'Target version must be less than current version' };
    }

    // Get migrations to rollback (in reverse order)
    const migrationsToRollback = MIGRATIONS.filter(
      (m) => m.version > targetVersion && m.version <= status.currentVersion
    ).reverse();

    for (const migration of migrationsToRollback) {
      const txResult = await this.duckdbService.transaction(async () => {
        // Run the down migration
        await this.duckdbService.execute(migration.down);

        // Remove the migration record
        await this.duckdbService.execute('DELETE FROM schema_migrations WHERE version = ?', [
          migration.version,
        ]);
      });

      if (!txResult.success) {
        return {
          success: false,
          error: `Rollback of ${migration.version} (${migration.name}) failed: ${txResult.error}`,
        };
      }
    }

    return { success: true };
  }

  /**
   * Record a migration as applied
   */
  private async recordMigration(version: number, name: string): Promise<void> {
    await this.duckdbService.execute(
      'INSERT OR REPLACE INTO schema_migrations (version, name, applied_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
      [version, name]
    );
  }

  /**
   * Validate the schema integrity
   */
  async validateSchema(): Promise<{ valid: boolean; issues: string[] }> {
    const issues: string[] = [];

    // Check all expected tables exist
    const expectedTables = Object.keys(SCHEMA_SQL);
    const result = await this.duckdbService.query<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'main'"
    );

    if (!result.success) {
      issues.push(`Failed to query tables: ${result.error}`);
      return { valid: false, issues };
    }

    const existingTables = new Set(result.rows.map((r) => r.table_name));

    for (const table of expectedTables) {
      if (!existingTables.has(table)) {
        issues.push(`Missing table: ${table}`);
      }
    }

    // Check migration version matches expected
    const status = await this.getMigrationStatus();
    if (status.currentVersion < status.latestVersion) {
      issues.push(
        `Schema version ${status.currentVersion} is behind latest ${status.latestVersion}`
      );
    }

    return { valid: issues.length === 0, issues };
  }

  /**
   * Drop all tables (for reset)
   */
  async dropAllTables(): Promise<{ success: boolean; error?: string }> {
    try {
      // Get all table names
      const result = await this.duckdbService.query<{ table_name: string }>(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'main'"
      );

      if (!result.success) {
        return { success: false, error: result.error };
      }

      // Drop each table
      for (const row of result.rows) {
        await this.duckdbService.execute(`DROP TABLE IF EXISTS "${row.table_name}" CASCADE`);
      }

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Get table statistics
   */
  async getTableStats(): Promise<{ tableName: string; rowCount: number; columnCount: number }[]> {
    const stats: { tableName: string; rowCount: number; columnCount: number }[] = [];

    const result = await this.duckdbService.query<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'main'"
    );

    if (!result.success) {
      return stats;
    }

    for (const row of result.rows) {
      const tableName = row.table_name;

      // Get row count
      const countResult = await this.duckdbService.query<{ count: number }>(
        `SELECT COUNT(*) as count FROM "${tableName}"`
      );
      const rowCount = countResult.success ? (countResult.rows[0]?.count ?? 0) : 0;

      // Get column count
      const colResult = await this.duckdbService.query<{ count: number }>(
        `SELECT COUNT(*) as count FROM information_schema.columns WHERE table_name = '${tableName}'`
      );
      const columnCount = colResult.success ? (colResult.rows[0]?.count ?? 0) : 0;

      stats.push({ tableName, rowCount, columnCount });
    }

    return stats;
  }
}

/**
 * Create a schema manager instance
 */
export function createSchemaManager(duckdbService: DuckDBService): SchemaManager {
  return new SchemaManager(duckdbService);
}

/**
 * Export the class for testing
 */
export { SchemaManager };
