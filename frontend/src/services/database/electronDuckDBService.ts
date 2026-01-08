/**
 * Electron DuckDB Service
 *
 * Provides native file system integration for DuckDB operations in Electron.
 * Enables exporting and importing DuckDB databases to/from the local filesystem.
 *
 * @module services/database/electronDuckDBService
 */

import { getDuckDBService } from './duckdbService';
import { isElectronPlatform } from '../platform/electron';
import type {
  DuckDBExportOptions,
  DuckDBExportResult,
  DuckDBImportOptions,
  DuckDBImportResult,
  DuckDBFileInfo,
  DuckDBBackupResult,
} from '../platform/electron';

/**
 * Export format options for native export
 */
export type NativeExportFormat = 'json' | 'csv' | 'duckdb';

/**
 * Options for native database export
 */
export interface NativeExportOptions {
  /** Export format */
  format: NativeExportFormat;
  /** Default filename (without extension) */
  defaultFileName?: string;
  /** Specific tables to export (all if not specified) */
  tables?: string[];
  /** Include schema in export (for JSON format) */
  includeSchema?: boolean;
}

/**
 * Result of native database export
 */
export interface NativeExportResult {
  success: boolean;
  filePath?: string;
  canceled?: boolean;
  error?: string;
  bytesWritten?: number;
}

/**
 * Options for native database import
 */
export interface NativeImportOptions {
  /** Allowed import formats */
  formats?: NativeExportFormat[];
  /** How to handle existing data */
  mergeStrategy?: 'replace' | 'merge' | 'skip';
  /** Perform a dry run without actually importing */
  dryRun?: boolean;
}

/**
 * Result of native database import
 */
export interface NativeImportResult {
  success: boolean;
  filePath?: string;
  format?: NativeExportFormat | 'unknown';
  canceled?: boolean;
  error?: string;
  tablesImported?: string[];
  rowsImported?: number;
}

/**
 * Electron DuckDB Service
 *
 * Provides native file system operations for DuckDB in Electron environment.
 */
class ElectronDuckDBService {
  private static instance: ElectronDuckDBService | null = null;

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): ElectronDuckDBService {
    if (!ElectronDuckDBService.instance) {
      ElectronDuckDBService.instance = new ElectronDuckDBService();
    }
    return ElectronDuckDBService.instance;
  }

  /**
   * Check if running in Electron environment
   */
  isAvailable(): boolean {
    return isElectronPlatform() && !!window.electronAPI?.duckdbExport;
  }

  /**
   * Export database to native file system
   *
   * Opens a save dialog and exports the database to the selected location.
   */
  async exportToFile(options: NativeExportOptions): Promise<NativeExportResult> {
    if (!this.isAvailable()) {
      return {
        success: false,
        error: 'Electron DuckDB API not available',
      };
    }

    try {
      const duckdb = getDuckDBService();

      if (!duckdb.isInitialized()) {
        return {
          success: false,
          error: 'DuckDB is not initialized',
        };
      }

      // Generate export data based on format
      let data: string | ArrayBuffer;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const defaultFileName = options.defaultFileName || `data-model-export-${timestamp}`;

      switch (options.format) {
        case 'json': {
          const exportData = await this.generateJsonExport(options.tables, options.includeSchema);
          data = exportData;
          break;
        }
        case 'csv': {
          const exportData = await this.generateCsvExport(options.tables);
          data = exportData;
          break;
        }
        case 'duckdb': {
          // For DuckDB format, we need to export the raw database
          // This requires special handling through OPFS or memory export
          const exportData = await this.generateDuckDBExport();
          data = exportData;
          break;
        }
        default:
          return {
            success: false,
            error: `Unsupported export format: ${options.format}`,
          };
      }

      // Call Electron IPC to save file
      const exportOptions: DuckDBExportOptions = {
        data,
        defaultPath: defaultFileName,
        format: options.format,
      };

      const result: DuckDBExportResult = await window.electronAPI!.duckdbExport(exportOptions);

      if (result.canceled) {
        return { success: false, canceled: true };
      }

      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Export failed',
        };
      }

      return {
        success: true,
        filePath: result.filePath,
        bytesWritten: typeof data === 'string' ? data.length : (data as ArrayBuffer).byteLength,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Import database from native file system
   *
   * Opens a file dialog and imports the selected database file.
   */
  async importFromFile(options: NativeImportOptions = {}): Promise<NativeImportResult> {
    if (!this.isAvailable()) {
      return {
        success: false,
        error: 'Electron DuckDB API not available',
      };
    }

    try {
      const duckdb = getDuckDBService();

      if (!duckdb.isInitialized()) {
        return {
          success: false,
          error: 'DuckDB is not initialized',
        };
      }

      // Call Electron IPC to open file dialog
      const importOptions: DuckDBImportOptions = {
        formats: options.formats || ['json', 'csv'],
      };

      const result: DuckDBImportResult = await window.electronAPI!.duckdbImport(importOptions);

      if (result.canceled) {
        return { success: false, canceled: true };
      }

      if (!result.success || !result.content) {
        return {
          success: false,
          error: result.error || 'Import failed - no content',
        };
      }

      // Process the imported data based on format
      let tablesImported: string[] = [];
      let rowsImported = 0;

      switch (result.format) {
        case 'json': {
          const importResult = await this.processJsonImport(
            result.content,
            options.mergeStrategy || 'merge',
            options.dryRun || false
          );
          tablesImported = importResult.tables;
          rowsImported = importResult.rows;
          break;
        }
        case 'csv': {
          const importResult = await this.processCsvImport(
            result.content,
            options.mergeStrategy || 'merge',
            options.dryRun || false
          );
          tablesImported = importResult.tables;
          rowsImported = importResult.rows;
          break;
        }
        case 'duckdb': {
          // DuckDB format requires special handling
          return {
            success: false,
            error: 'Native DuckDB format import is not yet supported in browser environment',
          };
        }
        default:
          return {
            success: false,
            error: `Unknown import format: ${result.format}`,
          };
      }

      return {
        success: true,
        filePath: result.filePath,
        format: result.format,
        tablesImported,
        rowsImported,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Get information about a database file
   */
  async getFileInfo(filePath: string): Promise<DuckDBFileInfo> {
    if (!this.isAvailable()) {
      return {
        success: false,
        error: 'Electron DuckDB API not available',
      };
    }

    return window.electronAPI!.duckdbFileInfo(filePath);
  }

  /**
   * Check if a database file exists
   */
  async fileExists(filePath: string): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    return window.electronAPI!.duckdbFileExists(filePath);
  }

  /**
   * Delete a database file
   */
  async deleteFile(filePath: string): Promise<{ success: boolean; error?: string }> {
    if (!this.isAvailable()) {
      return {
        success: false,
        error: 'Electron DuckDB API not available',
      };
    }

    return window.electronAPI!.duckdbDeleteFile(filePath);
  }

  /**
   * Create a backup of a database file
   */
  async createBackup(sourcePath: string, backupPath?: string): Promise<DuckDBBackupResult> {
    if (!this.isAvailable()) {
      return {
        success: false,
        error: 'Electron DuckDB API not available',
      };
    }

    return window.electronAPI!.duckdbBackup({ sourcePath, backupPath });
  }

  // =========================================================================
  // Private Helper Methods
  // =========================================================================

  /**
   * Generate JSON export data
   */
  private async generateJsonExport(tables?: string[], includeSchema?: boolean): Promise<string> {
    const duckdb = getDuckDBService();
    const targetTables = tables || (await this.getTableNames());

    const exportData: Record<string, unknown> = {};

    if (includeSchema) {
      exportData._schema = await this.getSchemaInfo(targetTables);
    }

    for (const tableName of targetTables) {
      const result = await duckdb.query(`SELECT * FROM "${tableName}"`);
      if (result.success) {
        exportData[tableName] = result.rows;
      }
    }

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Generate CSV export data
   */
  private async generateCsvExport(tables?: string[]): Promise<string> {
    const duckdb = getDuckDBService();
    const targetTables = tables || (await this.getTableNames());

    let csvContent = '';

    for (const tableName of targetTables) {
      const result = await duckdb.query(`SELECT * FROM "${tableName}"`);
      if (result.success && result.rows.length > 0) {
        csvContent += `# Table: ${tableName}\n`;
        csvContent += result.columnNames.join(',') + '\n';

        for (const row of result.rows) {
          csvContent +=
            result.columnNames
              .map((col) => {
                const val = (row as Record<string, unknown>)[col];
                if (val === null || val === undefined) return '';
                if (typeof val === 'string') {
                  // Escape quotes and wrap in quotes if contains comma or newline
                  const escaped = val.replace(/"/g, '""');
                  return val.includes(',') || val.includes('\n') || val.includes('"')
                    ? `"${escaped}"`
                    : val;
                }
                return String(val);
              })
              .join(',') + '\n';
        }
        csvContent += '\n';
      }
    }

    return csvContent;
  }

  /**
   * Generate DuckDB binary export
   *
   * Note: This is a simplified implementation. Full DuckDB binary export
   * requires direct access to the OPFS file or using DuckDB's EXPORT DATABASE.
   */
  private async generateDuckDBExport(): Promise<string> {
    // For now, we'll export as JSON with a marker indicating DuckDB format intent
    // A full implementation would require:
    // 1. Using DuckDB's EXPORT DATABASE command
    // 2. Reading the exported files from OPFS
    // 3. Packaging them into a single archive

    const duckdb = getDuckDBService();
    const tables = await this.getTableNames();

    const exportData: Record<string, unknown> = {
      _format: 'duckdb-export',
      _version: '1.0',
      _exportedAt: new Date().toISOString(),
      _schema: await this.getSchemaInfo(tables),
      data: {},
    };

    for (const tableName of tables) {
      const result = await duckdb.query(`SELECT * FROM "${tableName}"`);
      if (result.success) {
        (exportData.data as Record<string, unknown[]>)[tableName] = result.rows;
      }
    }

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Process JSON import
   */
  private async processJsonImport(
    content: string,
    mergeStrategy: 'replace' | 'merge' | 'skip',
    dryRun: boolean
  ): Promise<{ tables: string[]; rows: number }> {
    const duckdb = getDuckDBService();
    const data = JSON.parse(content) as Record<string, unknown>;

    // Handle both regular JSON and DuckDB export format
    const tableData =
      data._format === 'duckdb-export' ? (data.data as Record<string, unknown[]>) : data;

    const tables: string[] = [];
    let totalRows = 0;

    for (const [tableName, rows] of Object.entries(tableData)) {
      // Skip metadata keys
      if (tableName.startsWith('_')) continue;

      if (!Array.isArray(rows) || rows.length === 0) continue;

      tables.push(tableName);
      totalRows += rows.length;

      if (!dryRun) {
        for (const row of rows) {
          if (typeof row !== 'object' || row === null) continue;

          const record = row as Record<string, unknown>;
          const columns = Object.keys(record);
          const values = columns.map((col) => {
            const val = record[col];
            if (val === null) return 'NULL';
            if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
            if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
            if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
            return String(val);
          });

          const sql =
            mergeStrategy === 'replace'
              ? `INSERT OR REPLACE INTO "${tableName}" (${columns.map((c) => `"${c}"`).join(', ')}) VALUES (${values.join(', ')})`
              : `INSERT INTO "${tableName}" (${columns.map((c) => `"${c}"`).join(', ')}) VALUES (${values.join(', ')})`;

          await duckdb.execute(sql);
        }
      }
    }

    return { tables, rows: totalRows };
  }

  /**
   * Process CSV import
   */
  private async processCsvImport(
    content: string,
    mergeStrategy: 'replace' | 'merge' | 'skip',
    dryRun: boolean
  ): Promise<{ tables: string[]; rows: number }> {
    const duckdb = getDuckDBService();
    const lines = content.split('\n');

    const tables: string[] = [];
    let totalRows = 0;
    let currentTable = '';
    let headers: string[] = [];

    for (const line of lines) {
      const trimmedLine = line.trim();

      if (!trimmedLine) continue;

      // Check for table marker
      if (trimmedLine.startsWith('# Table:')) {
        currentTable = trimmedLine.replace('# Table:', '').trim();
        tables.push(currentTable);
        headers = [];
        continue;
      }

      // First non-comment line after table marker is headers
      if (currentTable && headers.length === 0) {
        headers = this.parseCsvLine(trimmedLine);
        continue;
      }

      // Data rows
      if (currentTable && headers.length > 0) {
        const values = this.parseCsvLine(trimmedLine);
        if (values.length !== headers.length) continue;

        totalRows++;

        if (!dryRun) {
          const sqlValues = values.map((val) => {
            if (val === '' || val === 'NULL') return 'NULL';
            return `'${val.replace(/'/g, "''")}'`;
          });

          const sql =
            mergeStrategy === 'replace'
              ? `INSERT OR REPLACE INTO "${currentTable}" (${headers.map((h) => `"${h}"`).join(', ')}) VALUES (${sqlValues.join(', ')})`
              : `INSERT INTO "${currentTable}" (${headers.map((h) => `"${h}"`).join(', ')}) VALUES (${sqlValues.join(', ')})`;

          await duckdb.execute(sql);
        }
      }
    }

    return { tables, rows: totalRows };
  }

  /**
   * Parse a CSV line handling quoted values
   */
  private parseCsvLine(line: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"' && !inQuotes) {
        inQuotes = true;
      } else if (char === '"' && inQuotes) {
        if (nextChar === '"') {
          current += '"';
          i++; // Skip the escaped quote
        } else {
          inQuotes = false;
        }
      } else if (char === ',' && !inQuotes) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    values.push(current);
    return values;
  }

  /**
   * Get list of table names
   */
  private async getTableNames(): Promise<string[]> {
    const duckdb = getDuckDBService();
    const result = await duckdb.query<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'main'"
    );
    return result.success ? result.rows.map((r) => r.table_name) : [];
  }

  /**
   * Get schema information for tables
   */
  private async getSchemaInfo(tables: string[]): Promise<Record<string, unknown>> {
    const duckdb = getDuckDBService();
    const schema: Record<string, unknown> = {};

    for (const tableName of tables) {
      const result = await duckdb.query<{
        column_name: string;
        data_type: string;
        is_nullable: string;
      }>(
        `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_name = ? AND table_schema = 'main'
         ORDER BY ordinal_position`,
        [tableName]
      );

      if (result.success) {
        schema[tableName] = result.rows.map((r) => ({
          name: r.column_name,
          type: r.data_type,
          nullable: r.is_nullable === 'YES',
        }));
      }
    }

    return schema;
  }
}

/**
 * Get the Electron DuckDB service singleton
 */
export function getElectronDuckDBService(): ElectronDuckDBService {
  return ElectronDuckDBService.getInstance();
}

/**
 * Export the class for testing
 */
export { ElectronDuckDBService };
