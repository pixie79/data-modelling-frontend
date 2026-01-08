/**
 * DuckDB-WASM Service
 *
 * Provides in-browser SQL database functionality using DuckDB-WASM.
 * Uses OPFS (Origin Private File System) for persistent storage when available,
 * with fallback to in-memory storage for unsupported browsers.
 *
 * @module services/database/duckdbService
 */

import * as duckdb from '@duckdb/duckdb-wasm';
import {
  type DuckDBConfig,
  type DuckDBInitResult,
  type DuckDBQueryResult,
  type DuckDBParams,
  type DuckDBStats,
  type OPFSStatus,
  type ExportOptions,
  type ImportOptions,
  type IDuckDBService,
  type TableStats,
  DEFAULT_DUCKDB_CONFIG,
  StorageMode,
  ExportFormat,
  checkBrowserCapabilities,
} from '@/types/duckdb';

/**
 * DuckDB-WASM Service singleton
 */
class DuckDBService implements IDuckDBService {
  private static instance: DuckDBService | null = null;

  private db: duckdb.AsyncDuckDB | null = null;
  private conn: duckdb.AsyncDuckDBConnection | null = null;
  private config: Required<DuckDBConfig> = DEFAULT_DUCKDB_CONFIG;
  private storageMode: StorageMode = StorageMode.Memory;
  private initialized = false;
  private initPromise: Promise<DuckDBInitResult> | null = null;
  private version = '';

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): DuckDBService {
    if (!DuckDBService.instance) {
      DuckDBService.instance = new DuckDBService();
    }
    return DuckDBService.instance;
  }

  /**
   * Reset singleton instance (for testing)
   */
  static resetInstance(): void {
    if (DuckDBService.instance) {
      DuckDBService.instance.terminate().catch(console.error);
      DuckDBService.instance = null;
    }
  }

  /**
   * Log a message if debug is enabled
   */
  private log(message: string): void {
    if (this.config.debug) {
      this.config.logger(`[DuckDB] ${message}`);
    }
  }

  /**
   * Initialize DuckDB with OPFS or memory storage
   */
  async initialize(config?: Partial<DuckDBConfig>): Promise<DuckDBInitResult> {
    // Return existing promise if already initializing
    if (this.initPromise) {
      return this.initPromise;
    }

    // Return cached result if already initialized
    if (this.initialized && this.db && this.conn) {
      return {
        success: true,
        db: this.db,
        conn: this.conn,
        storageMode: this.storageMode,
        version: this.version,
      };
    }

    this.initPromise = this.doInitialize(config);
    return this.initPromise;
  }

  /**
   * Internal initialization logic
   */
  private async doInitialize(config?: Partial<DuckDBConfig>): Promise<DuckDBInitResult> {
    try {
      // Merge config with defaults
      this.config = { ...DEFAULT_DUCKDB_CONFIG, ...config };
      this.log('Starting initialization...');

      // Check browser capabilities
      const capabilities = checkBrowserCapabilities();
      if (!capabilities.webAssembly) {
        throw new Error('WebAssembly is not supported in this browser');
      }

      if (capabilities.warnings.length > 0) {
        capabilities.warnings.forEach((w) => this.log(`Warning: ${w}`));
      }

      // Determine storage mode
      this.storageMode = capabilities.opfs ? StorageMode.OPFS : StorageMode.Memory;
      this.log(`Storage mode: ${this.storageMode}`);

      // Configure bundle paths
      const bundles: duckdb.DuckDBBundles = {
        mvp: {
          mainModule: `${this.config.wasmPath}duckdb-mvp.wasm`,
          mainWorker: `${this.config.wasmPath}duckdb-browser-mvp.worker.js`,
        },
        eh: {
          mainModule: `${this.config.wasmPath}duckdb-eh.wasm`,
          mainWorker: `${this.config.wasmPath}duckdb-browser-eh.worker.js`,
        },
      };

      // Select the best bundle for this browser
      const selectedBundle = await duckdb.selectBundle(bundles);
      this.log(`Selected bundle: ${selectedBundle.mainModule}`);

      // Create worker
      const logger = new duckdb.ConsoleLogger(
        this.config.debug ? duckdb.LogLevel.DEBUG : duckdb.LogLevel.WARNING
      );

      // Create worker from the selected bundle
      const worker = new Worker(selectedBundle.mainWorker!);

      // Create AsyncDuckDB instance
      this.db = new duckdb.AsyncDuckDB(logger, worker);

      // Instantiate the WASM module
      await this.db.instantiate(selectedBundle.mainModule);
      this.log('DuckDB instantiated');

      // Open database with OPFS if available
      if (this.storageMode === StorageMode.OPFS) {
        try {
          await this.db.open({
            path: this.config.databaseName,
          });
          this.log(`Opened OPFS database: ${this.config.databaseName}`);
        } catch (opfsError) {
          this.log(`OPFS failed, falling back to memory: ${opfsError}`);
          this.storageMode = StorageMode.Memory;
          await this.db.open({
            path: ':memory:',
          });
        }
      } else {
        await this.db.open({
          path: ':memory:',
        });
        this.log('Opened in-memory database');
      }

      // Create connection
      this.conn = await this.db.connect();
      this.log('Database connection established');

      // Get version
      const versionResult = await this.conn.query('SELECT version() as version');
      const versionData = versionResult.toArray();
      this.version = String(versionData[0]?.version ?? 'unknown');
      this.log(`DuckDB version: ${this.version}`);

      this.initialized = true;

      return {
        success: true,
        db: this.db,
        conn: this.conn,
        storageMode: this.storageMode,
        version: this.version,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log(`Initialization failed: ${errorMessage}`);
      this.initPromise = null;

      return {
        success: false,
        db: null,
        conn: null,
        storageMode: StorageMode.Memory,
        error: errorMessage,
      };
    }
  }

  /**
   * Terminate DuckDB and release resources
   */
  async terminate(): Promise<void> {
    this.log('Terminating DuckDB...');

    if (this.conn) {
      await this.conn.close();
      this.conn = null;
    }

    if (this.db) {
      await this.db.terminate();
      this.db = null;
    }

    this.initialized = false;
    this.initPromise = null;
    this.log('DuckDB terminated');
  }

  /**
   * Check if DuckDB is initialized
   */
  isInitialized(): boolean {
    return this.initialized && this.db !== null && this.conn !== null;
  }

  /**
   * Get current storage mode
   */
  getStorageMode(): StorageMode {
    return this.storageMode;
  }

  /**
   * Get the raw connection (for advanced use)
   */
  getConnection(): duckdb.AsyncDuckDBConnection | null {
    return this.conn;
  }

  /**
   * Get the raw database (for advanced use)
   */
  getDatabase(): duckdb.AsyncDuckDB | null {
    return this.db;
  }

  /**
   * Execute a SQL query and return typed results
   */
  async query<T = Record<string, unknown>>(
    sql: string,
    params?: DuckDBParams
  ): Promise<DuckDBQueryResult<T>> {
    if (!this.conn) {
      return {
        success: false,
        rows: [],
        rowCount: 0,
        columnNames: [],
        columnTypes: [],
        executionTimeMs: 0,
        error: 'DuckDB is not initialized',
      };
    }

    const startTime = performance.now();

    try {
      let result;
      if (params && params.length > 0) {
        const stmt = await this.conn.prepare(sql);
        result = await stmt.query(...params);
        await stmt.close();
      } else {
        result = await this.conn.query(sql);
      }

      const rows = result.toArray().map((row) => {
        const obj: Record<string, unknown> = {};
        const schema = result.schema;
        for (let i = 0; i < schema.fields.length; i++) {
          const field = schema.fields[i];
          if (field) {
            obj[field.name] = row[field.name];
          }
        }
        return obj as T;
      });

      const executionTimeMs = performance.now() - startTime;

      return {
        success: true,
        rows,
        rowCount: rows.length,
        columnNames: result.schema.fields.map((f) => f.name),
        columnTypes: result.schema.fields.map((f) => f.type.toString()),
        executionTimeMs,
      };
    } catch (error) {
      const executionTimeMs = performance.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      return {
        success: false,
        rows: [],
        rowCount: 0,
        columnNames: [],
        columnTypes: [],
        executionTimeMs,
        error: errorMessage,
      };
    }
  }

  /**
   * Execute SQL without returning results (INSERT, UPDATE, DELETE)
   */
  async execute(sql: string, params?: DuckDBParams): Promise<{ success: boolean; error?: string }> {
    if (!this.conn) {
      return { success: false, error: 'DuckDB is not initialized' };
    }

    try {
      if (params && params.length > 0) {
        const stmt = await this.conn.prepare(sql);
        await stmt.query(...params);
        await stmt.close();
      } else {
        await this.conn.query(sql);
      }
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Execute multiple SQL statements in a transaction
   */
  async transaction<T>(
    fn: (conn: duckdb.AsyncDuckDBConnection) => Promise<T>
  ): Promise<{ success: boolean; result?: T; error?: string }> {
    if (!this.conn) {
      return { success: false, error: 'DuckDB is not initialized' };
    }

    try {
      await this.conn.query('BEGIN TRANSACTION');
      const result = await fn(this.conn);
      await this.conn.query('COMMIT');
      return { success: true, result };
    } catch (error) {
      await this.conn.query('ROLLBACK').catch(() => {
        // Ignore rollback errors
      });
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<DuckDBStats> {
    const defaultStats: DuckDBStats = {
      storageMode: this.storageMode,
      databaseSizeBytes: 0,
      tableCount: 0,
      tables: [],
      isInitialized: this.initialized,
      version: this.version,
    };

    if (!this.conn) {
      return defaultStats;
    }

    try {
      // Get table list
      const tablesResult = await this.query<{ table_name: string }>(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'main'"
      );

      const tables: TableStats[] = [];

      for (const row of tablesResult.rows) {
        const tableName = row.table_name;

        // Get row count
        const countResult = await this.query<{ count: number }>(
          `SELECT COUNT(*) as count FROM "${tableName}"`
        );
        const rowCount = countResult.rows[0]?.count || 0;

        tables.push({
          tableName,
          rowCount,
          sizeBytes: 0, // DuckDB-WASM doesn't expose table sizes directly
        });
      }

      return {
        storageMode: this.storageMode,
        databaseSizeBytes: 0, // Would need OPFS API to get actual size
        tableCount: tables.length,
        tables,
        isInitialized: this.initialized,
        version: this.version,
      };
    } catch (error) {
      return {
        ...defaultStats,
        lastError: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get OPFS status
   */
  async getOPFSStatus(): Promise<OPFSStatus> {
    const capabilities = checkBrowserCapabilities();

    const status: OPFSStatus = {
      supported: capabilities.opfs,
      enabled: this.storageMode === StorageMode.OPFS,
    };

    // Try to get storage quota
    if (navigator.storage && navigator.storage.estimate) {
      try {
        const estimate = await navigator.storage.estimate();
        status.quota = {
          usage: estimate.usage || 0,
          quota: estimate.quota || 0,
          usagePercent:
            estimate.quota && estimate.quota > 0
              ? ((estimate.usage || 0) / estimate.quota) * 100
              : 0,
        };
      } catch {
        // Quota estimation not available
      }
    }

    if (!capabilities.opfs) {
      status.error = 'OPFS is not supported in this browser';
    }

    return status;
  }

  /**
   * Export database to specified format
   */
  async export(options: ExportOptions): Promise<Blob> {
    if (!this.conn || !this.db) {
      throw new Error('DuckDB is not initialized');
    }

    switch (options.format) {
      case ExportFormat.JSON: {
        const tables = options.tables || (await this.getTableNames());
        const data: Record<string, unknown[]> = {};

        for (const table of tables) {
          const result = await this.query(`SELECT * FROM "${table}"`);
          data[table] = result.rows;
        }

        return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      }

      case ExportFormat.CSV: {
        const tables = options.tables || (await this.getTableNames());
        let csvContent = '';

        for (const table of tables) {
          const result = await this.query(`SELECT * FROM "${table}"`);
          if (result.rows.length > 0) {
            csvContent += `# Table: ${table}\n`;
            csvContent += result.columnNames.join(',') + '\n';
            for (const row of result.rows) {
              csvContent +=
                result.columnNames
                  .map((col) => {
                    const val = (row as Record<string, unknown>)[col];
                    return typeof val === 'string' ? `"${val}"` : String(val ?? '');
                  })
                  .join(',') + '\n';
            }
            csvContent += '\n';
          }
        }

        return new Blob([csvContent], { type: 'text/csv' });
      }

      case ExportFormat.Parquet:
      case ExportFormat.DuckDB:
        // These formats require more complex handling
        throw new Error(`Export format ${options.format} is not yet implemented`);

      default:
        throw new Error(`Unknown export format: ${options.format}`);
    }
  }

  /**
   * Import data from file
   */
  async import(data: Blob, options: ImportOptions): Promise<{ success: boolean; error?: string }> {
    if (!this.conn) {
      return { success: false, error: 'DuckDB is not initialized' };
    }

    try {
      const text = await data.text();
      const jsonData = JSON.parse(text) as Record<string, unknown[]>;

      for (const [tableName, rows] of Object.entries(jsonData)) {
        if (!Array.isArray(rows) || rows.length === 0) continue;

        for (const row of rows) {
          if (typeof row !== 'object' || row === null) continue;
          const record = row as Record<string, unknown>;
          const columns = Object.keys(record);
          const values = columns.map((col) => {
            const val = record[col];
            if (val === null) return 'NULL';
            if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
            if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
            return String(val);
          });

          const sql =
            options.mergeStrategy === 'replace'
              ? `INSERT OR REPLACE INTO "${tableName}" (${columns.join(', ')}) VALUES (${values.join(', ')})`
              : `INSERT INTO "${tableName}" (${columns.join(', ')}) VALUES (${values.join(', ')})`;

          if (!options.dryRun) {
            await this.execute(sql);
          }
        }
      }

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Reset database (drop all tables and recreate schema)
   */
  async reset(): Promise<{ success: boolean; error?: string }> {
    if (!this.conn) {
      return { success: false, error: 'DuckDB is not initialized' };
    }

    try {
      const tables = await this.getTableNames();

      for (const table of tables) {
        await this.execute(`DROP TABLE IF EXISTS "${table}" CASCADE`);
      }

      this.log('Database reset complete');
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Get list of table names
   */
  private async getTableNames(): Promise<string[]> {
    const result = await this.query<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'main'"
    );
    return result.rows.map((r) => r.table_name);
  }
}

/**
 * Get the DuckDB service singleton
 */
export function getDuckDBService(): DuckDBService {
  return DuckDBService.getInstance();
}

/**
 * Export the service class for testing
 */
export { DuckDBService };

/**
 * Export types
 */
export * from '@/types/duckdb';
