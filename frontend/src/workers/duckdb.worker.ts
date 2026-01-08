/**
 * DuckDB Web Worker
 *
 * Offloads heavy DuckDB operations to a separate thread to prevent
 * blocking the main UI thread. Handles initialization, queries, and
 * batch operations.
 *
 * @module workers/duckdb.worker
 */

import * as duckdb from '@duckdb/duckdb-wasm';

/**
 * Message types from main thread to worker
 */
export type WorkerMessageType =
  | 'initialize'
  | 'query'
  | 'execute'
  | 'batch'
  | 'export'
  | 'terminate';

/**
 * Message from main thread to worker
 */
export interface WorkerMessage {
  id: string;
  type: WorkerMessageType;
  payload?: unknown;
}

/**
 * Initialize message payload
 */
export interface InitializePayload {
  wasmPath: string;
  bundle: 'eh' | 'mvp';
  databaseName: string;
  debug?: boolean;
}

/**
 * Query message payload
 */
export interface QueryPayload {
  sql: string;
  params?: (string | number | boolean | null)[];
}

/**
 * Batch message payload
 */
export interface BatchPayload {
  statements: QueryPayload[];
  useTransaction?: boolean;
}

/**
 * Export message payload
 */
export interface ExportPayload {
  format: 'json' | 'csv' | 'parquet';
  tables?: string[];
}

/**
 * Worker response
 */
export interface WorkerResponse {
  id: string;
  success: boolean;
  result?: unknown;
  error?: string;
  executionTimeMs?: number;
}

/**
 * Query result structure
 */
export interface QueryResult {
  rows: Record<string, unknown>[];
  rowCount: number;
  columnNames: string[];
  columnTypes: string[];
}

// Worker state
let db: duckdb.AsyncDuckDB | null = null;
let conn: duckdb.AsyncDuckDBConnection | null = null;
let isInitialized = false;

/**
 * Send response back to main thread
 */
function sendResponse(response: WorkerResponse): void {
  self.postMessage(response);
}

/**
 * Handle initialize message
 */
async function handleInitialize(id: string, payload: InitializePayload): Promise<void> {
  const startTime = performance.now();

  try {
    if (isInitialized && db && conn) {
      sendResponse({
        id,
        success: true,
        result: { alreadyInitialized: true },
        executionTimeMs: performance.now() - startTime,
      });
      return;
    }

    // Configure bundle paths
    const bundles: duckdb.DuckDBBundles = {
      mvp: {
        mainModule: `${payload.wasmPath}duckdb-mvp.wasm`,
        mainWorker: `${payload.wasmPath}duckdb-browser-mvp.worker.js`,
      },
      eh: {
        mainModule: `${payload.wasmPath}duckdb-eh.wasm`,
        mainWorker: `${payload.wasmPath}duckdb-browser-eh.worker.js`,
      },
    };

    // Select the best bundle
    const selectedBundle = await duckdb.selectBundle(bundles);

    // Create logger
    const logger = new duckdb.ConsoleLogger(
      payload.debug ? duckdb.LogLevel.DEBUG : duckdb.LogLevel.WARNING
    );

    // Create worker from selected bundle
    const worker = new Worker(selectedBundle.mainWorker!);

    // Create AsyncDuckDB instance
    db = new duckdb.AsyncDuckDB(logger, worker);
    await db.instantiate(selectedBundle.mainModule);

    // Try OPFS, fallback to memory
    let storageMode = 'memory';
    try {
      await db.open({
        path: payload.databaseName,
      });
      storageMode = 'opfs';
    } catch {
      await db.open({ path: ':memory:' });
    }

    // Create connection
    conn = await db.connect();

    // Get version
    const versionResult = await conn.query('SELECT version() as version');
    const versionData = versionResult.toArray();
    const version = String(versionData[0]?.version ?? 'unknown');

    isInitialized = true;

    sendResponse({
      id,
      success: true,
      result: { storageMode, version },
      executionTimeMs: performance.now() - startTime,
    });
  } catch (error) {
    sendResponse({
      id,
      success: false,
      error: error instanceof Error ? error.message : String(error),
      executionTimeMs: performance.now() - startTime,
    });
  }
}

/**
 * Handle query message
 */
async function handleQuery(id: string, payload: QueryPayload): Promise<void> {
  const startTime = performance.now();

  if (!conn) {
    sendResponse({
      id,
      success: false,
      error: 'DuckDB is not initialized',
      executionTimeMs: performance.now() - startTime,
    });
    return;
  }

  try {
    let result;
    if (payload.params && payload.params.length > 0) {
      const stmt = await conn.prepare(payload.sql);
      result = await stmt.query(...payload.params);
      await stmt.close();
    } else {
      result = await conn.query(payload.sql);
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
      return obj;
    });

    const queryResult: QueryResult = {
      rows,
      rowCount: rows.length,
      columnNames: result.schema.fields.map((f) => f.name),
      columnTypes: result.schema.fields.map((f) => f.type.toString()),
    };

    sendResponse({
      id,
      success: true,
      result: queryResult,
      executionTimeMs: performance.now() - startTime,
    });
  } catch (error) {
    sendResponse({
      id,
      success: false,
      error: error instanceof Error ? error.message : String(error),
      executionTimeMs: performance.now() - startTime,
    });
  }
}

/**
 * Handle execute message (no result returned)
 */
async function handleExecute(id: string, payload: QueryPayload): Promise<void> {
  const startTime = performance.now();

  if (!conn) {
    sendResponse({
      id,
      success: false,
      error: 'DuckDB is not initialized',
      executionTimeMs: performance.now() - startTime,
    });
    return;
  }

  try {
    if (payload.params && payload.params.length > 0) {
      const stmt = await conn.prepare(payload.sql);
      await stmt.query(...payload.params);
      await stmt.close();
    } else {
      await conn.query(payload.sql);
    }

    sendResponse({
      id,
      success: true,
      executionTimeMs: performance.now() - startTime,
    });
  } catch (error) {
    sendResponse({
      id,
      success: false,
      error: error instanceof Error ? error.message : String(error),
      executionTimeMs: performance.now() - startTime,
    });
  }
}

/**
 * Handle batch message
 */
async function handleBatch(id: string, payload: BatchPayload): Promise<void> {
  const startTime = performance.now();

  if (!conn) {
    sendResponse({
      id,
      success: false,
      error: 'DuckDB is not initialized',
      executionTimeMs: performance.now() - startTime,
    });
    return;
  }

  try {
    if (payload.useTransaction) {
      await conn.query('BEGIN TRANSACTION');
    }

    const results: Array<{ success: boolean; error?: string }> = [];

    for (const stmt of payload.statements) {
      try {
        if (stmt.params && stmt.params.length > 0) {
          const prepared = await conn.prepare(stmt.sql);
          await prepared.query(...stmt.params);
          await prepared.close();
        } else {
          await conn.query(stmt.sql);
        }
        results.push({ success: true });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        results.push({ success: false, error: errorMsg });

        if (payload.useTransaction) {
          await conn.query('ROLLBACK');
          sendResponse({
            id,
            success: false,
            error: `Batch failed at statement: ${errorMsg}`,
            result: { results, failedAt: results.length - 1 },
            executionTimeMs: performance.now() - startTime,
          });
          return;
        }
      }
    }

    if (payload.useTransaction) {
      await conn.query('COMMIT');
    }

    sendResponse({
      id,
      success: true,
      result: { results, totalStatements: payload.statements.length },
      executionTimeMs: performance.now() - startTime,
    });
  } catch (error) {
    if (payload.useTransaction && conn) {
      await conn.query('ROLLBACK').catch(() => {});
    }
    sendResponse({
      id,
      success: false,
      error: error instanceof Error ? error.message : String(error),
      executionTimeMs: performance.now() - startTime,
    });
  }
}

/**
 * Handle export message
 */
async function handleExport(id: string, payload: ExportPayload): Promise<void> {
  const startTime = performance.now();

  if (!conn) {
    sendResponse({
      id,
      success: false,
      error: 'DuckDB is not initialized',
      executionTimeMs: performance.now() - startTime,
    });
    return;
  }

  try {
    // Get table names if not specified
    let tables = payload.tables;
    if (!tables || tables.length === 0) {
      const tableResult = await conn.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'main'"
      );
      tables = tableResult.toArray().map((r) => String(r.table_name));
    }

    const exportData: Record<string, unknown[]> = {};

    for (const table of tables) {
      const result = await conn.query(`SELECT * FROM "${table}"`);
      exportData[table] = result.toArray().map((row) => {
        const obj: Record<string, unknown> = {};
        for (const field of result.schema.fields) {
          obj[field.name] = row[field.name];
        }
        return obj;
      });
    }

    let output: string;
    if (payload.format === 'json') {
      output = JSON.stringify(exportData, null, 2);
    } else if (payload.format === 'csv') {
      // Simple CSV export
      const csvParts: string[] = [];
      for (const [tableName, rows] of Object.entries(exportData)) {
        csvParts.push(`# Table: ${tableName}`);
        if (rows.length > 0) {
          const headers = Object.keys(rows[0] as object);
          csvParts.push(headers.join(','));
          for (const row of rows) {
            const r = row as Record<string, unknown>;
            csvParts.push(
              headers
                .map((h) => {
                  const val = r[h];
                  return typeof val === 'string' ? `"${val}"` : String(val ?? '');
                })
                .join(',')
            );
          }
        }
        csvParts.push('');
      }
      output = csvParts.join('\n');
    } else {
      throw new Error(`Export format ${payload.format} not supported in worker`);
    }

    sendResponse({
      id,
      success: true,
      result: { data: output, format: payload.format, tables },
      executionTimeMs: performance.now() - startTime,
    });
  } catch (error) {
    sendResponse({
      id,
      success: false,
      error: error instanceof Error ? error.message : String(error),
      executionTimeMs: performance.now() - startTime,
    });
  }
}

/**
 * Handle terminate message
 */
async function handleTerminate(id: string): Promise<void> {
  const startTime = performance.now();

  try {
    if (conn) {
      await conn.close();
      conn = null;
    }

    if (db) {
      await db.terminate();
      db = null;
    }

    isInitialized = false;

    sendResponse({
      id,
      success: true,
      executionTimeMs: performance.now() - startTime,
    });
  } catch (error) {
    sendResponse({
      id,
      success: false,
      error: error instanceof Error ? error.message : String(error),
      executionTimeMs: performance.now() - startTime,
    });
  }
}

/**
 * Message handler
 */
self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { id, type, payload } = event.data;

  switch (type) {
    case 'initialize':
      await handleInitialize(id, payload as InitializePayload);
      break;

    case 'query':
      await handleQuery(id, payload as QueryPayload);
      break;

    case 'execute':
      await handleExecute(id, payload as QueryPayload);
      break;

    case 'batch':
      await handleBatch(id, payload as BatchPayload);
      break;

    case 'export':
      await handleExport(id, payload as ExportPayload);
      break;

    case 'terminate':
      await handleTerminate(id);
      break;

    default:
      sendResponse({
        id,
        success: false,
        error: `Unknown message type: ${type}`,
      });
  }
};

// Signal that the worker is ready
self.postMessage({ type: 'ready' });
