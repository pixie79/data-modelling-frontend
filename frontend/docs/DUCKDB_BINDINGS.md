# DuckDB-WASM Bindings Reference

**Package**: `@duckdb/duckdb-wasm`  
**Version**: 1.29.0 (DuckDB 1.4.3)  
**Audit Date**: 2025-01-08

This document lists all exported bindings from the DuckDB-WASM package for use in the Open Data Modelling application.

---

## Installation

```bash
npm install @duckdb/duckdb-wasm@1.29.0
```

## WASM Bundle Files

| File                           | Size   | Purpose                              |
| ------------------------------ | ------ | ------------------------------------ |
| `duckdb-mvp.wasm`              | ~40MB  | Minimal viable product (recommended) |
| `duckdb-eh.wasm`               | ~36MB  | With exception handling              |
| `duckdb-browser-mvp.worker.js` | ~821KB | Web Worker for MVP bundle            |
| `duckdb-browser-eh.worker.js`  | ~761KB | Web Worker for EH bundle             |

---

## Core Classes

### AsyncDuckDB

Main class for interacting with DuckDB in the browser.

```typescript
import * as duckdb from '@duckdb/duckdb-wasm';

const db = new duckdb.AsyncDuckDB(logger, worker);
```

#### Initialization Methods

| Method        | Signature                                                                                     | Description                      |
| ------------- | --------------------------------------------------------------------------------------------- | -------------------------------- |
| `instantiate` | `(mainModuleURL: string, pthreadWorkerURL?: string, progress?: (p) => void) => Promise<null>` | Load WASM module                 |
| `open`        | `(config: DuckDBConfig) => Promise<void>`                                                     | Open database with configuration |
| `connect`     | `() => Promise<AsyncDuckDBConnection>`                                                        | Create new connection            |
| `terminate`   | `() => Promise<void>`                                                                         | Terminate worker and cleanup     |
| `reset`       | `() => Promise<null>`                                                                         | Reset the database               |

#### Query Methods

| Method               | Signature                                                     | Description                     |
| -------------------- | ------------------------------------------------------------- | ------------------------------- |
| `runQuery`           | `(conn: number, text: string) => Promise<Uint8Array>`         | Execute query, return Arrow IPC |
| `startPendingQuery`  | `(conn: number, text: string) => Promise<Uint8Array \| null>` | Start async query               |
| `pollPendingQuery`   | `(conn: number) => Promise<Uint8Array \| null>`               | Poll async query                |
| `cancelPendingQuery` | `(conn: number) => Promise<boolean>`                          | Cancel async query              |
| `fetchQueryResults`  | `(conn: number) => Promise<Uint8Array>`                       | Fetch remaining results         |

#### Prepared Statement Methods

| Method           | Signature                                                                 | Description                |
| ---------------- | ------------------------------------------------------------------------- | -------------------------- |
| `createPrepared` | `(conn: number, text: string) => Promise<number>`                         | Create prepared statement  |
| `closePrepared`  | `(conn: number, statement: number) => Promise<void>`                      | Close prepared statement   |
| `runPrepared`    | `(conn: number, statement: number, params: any[]) => Promise<Uint8Array>` | Execute prepared statement |
| `sendPrepared`   | `(conn: number, statement: number, params: any[]) => Promise<Uint8Array>` | Stream prepared statement  |

#### File System Methods

| Method                    | Signature                                                                                              | Description                 |
| ------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------- |
| `registerFileURL`         | `(name: string, url: string, proto: DuckDBDataProtocol, directIO: boolean) => Promise<void>`           | Register file from URL      |
| `registerFileBuffer`      | `(name: string, buffer: Uint8Array) => Promise<void>`                                                  | Register file from buffer   |
| `registerFileHandle`      | `(name: string, handle: HandleType, protocol: DuckDBDataProtocol, directIO: boolean) => Promise<void>` | Register file handle (OPFS) |
| `registerFileText`        | `(name: string, text: string) => Promise<void>`                                                        | Register text as file       |
| `registerEmptyFileBuffer` | `(name: string) => Promise<void>`                                                                      | Register empty file         |
| `copyFileToBuffer`        | `(name: string) => Promise<Uint8Array>`                                                                | Copy file to buffer         |
| `copyFileToPath`          | `(name: string, path: string) => Promise<void>`                                                        | Copy file to path           |
| `dropFile`                | `(name: string) => Promise<null>`                                                                      | Remove registered file      |
| `dropFiles`               | `() => Promise<null>`                                                                                  | Remove all registered files |
| `flushFiles`              | `() => Promise<null>`                                                                                  | Flush all file buffers      |
| `globFiles`               | `(path: string) => Promise<WebFile[]>`                                                                 | List files matching pattern |

#### Data Import Methods

| Method                     | Signature                                                                           | Description           |
| -------------------------- | ----------------------------------------------------------------------------------- | --------------------- |
| `insertArrowFromIPCStream` | `(conn: number, buffer: Uint8Array, options?: ArrowInsertOptions) => Promise<void>` | Insert Arrow IPC data |
| `insertCSVFromPath`        | `(conn: number, path: string, options: CSVInsertOptions) => Promise<void>`          | Insert CSV file       |
| `insertJSONFromPath`       | `(conn: number, path: string, options: JSONInsertOptions) => Promise<void>`         | Insert JSON file      |

#### Utility Methods

| Method            | Signature                                           | Description                    |
| ----------------- | --------------------------------------------------- | ------------------------------ |
| `getVersion`      | `() => Promise<string>`                             | Get DuckDB version             |
| `getFeatureFlags` | `() => Promise<number>`                             | Get feature flags              |
| `tokenize`        | `(text: string) => Promise<ScriptTokens>`           | Tokenize SQL script            |
| `getTableNames`   | `(conn: number, text: string) => Promise<string[]>` | Extract table names from query |
| `ping`            | `() => Promise<any>`                                | Ping worker thread             |

---

### AsyncDuckDBConnection

Connection wrapper for executing queries.

```typescript
const conn = await db.connect();
const result = await conn.query('SELECT * FROM tables');
await conn.close();
```

#### Methods

| Method                     | Signature                                                             | Description                       |
| -------------------------- | --------------------------------------------------------------------- | --------------------------------- |
| `query`                    | `<T>(text: string) => Promise<arrow.Table<T>>`                        | Execute query, return Arrow Table |
| `send`                     | `<T>(text: string) => Promise<arrow.AsyncRecordBatchStreamReader<T>>` | Stream query results              |
| `cancelSent`               | `() => Promise<boolean>`                                              | Cancel streamed query             |
| `prepare`                  | `<T>(text: string) => Promise<AsyncPreparedStatement>`                | Create prepared statement         |
| `close`                    | `() => Promise<void>`                                                 | Close connection                  |
| `getTableNames`            | `(query: string) => Promise<string[]>`                                | Get table names from query        |
| `insertArrowTable`         | `(table: arrow.Table, options: ArrowInsertOptions) => Promise<void>`  | Insert Arrow table                |
| `insertArrowFromIPCStream` | `(buffer: Uint8Array, options: ArrowInsertOptions) => Promise<void>`  | Insert Arrow IPC                  |
| `insertCSVFromPath`        | `(text: string, options: CSVInsertOptions) => Promise<void>`          | Insert CSV                        |
| `insertJSONFromPath`       | `(text: string, options: JSONInsertOptions) => Promise<void>`         | Insert JSON                       |

---

### AsyncPreparedStatement

Prepared statement for parameterized queries.

```typescript
const stmt = await conn.prepare('SELECT * FROM tables WHERE id = ?');
const result = await stmt.query('uuid-123');
await stmt.close();
```

#### Methods

| Method  | Signature                                                              | Description         |
| ------- | ---------------------------------------------------------------------- | ------------------- |
| `query` | `(...params: any[]) => Promise<arrow.Table<T>>`                        | Execute with params |
| `send`  | `(...params: any[]) => Promise<arrow.AsyncRecordBatchStreamReader<T>>` | Stream with params  |
| `close` | `() => Promise<void>`                                                  | Close statement     |

---

## Configuration Types

### DuckDBConfig

```typescript
interface DuckDBConfig {
  path?: string; // Database path (for OPFS: 'opfs://name.duckdb')
  accessMode?: DuckDBAccessMode; // READ_ONLY, READ_WRITE, AUTOMATIC
  maximumThreads?: number; // Thread count (requires COI)
  query?: DuckDBQueryConfig; // Query settings
  filesystem?: DuckDBFilesystemConfig; // FS settings
  allowUnsignedExtensions?: boolean;
  customUserAgent?: string;
}
```

### DuckDBAccessMode

```typescript
enum DuckDBAccessMode {
  UNDEFINED = 0,
  AUTOMATIC = 1,
  READ_ONLY = 2,
  READ_WRITE = 3,
}
```

### DuckDBQueryConfig

```typescript
interface DuckDBQueryConfig {
  queryPollingInterval?: number;
  castBigIntToDouble?: boolean;
  castTimestampToDate?: boolean;
  castDurationToTime64?: boolean;
  castDecimalToDouble?: boolean;
}
```

### DuckDBDataProtocol

```typescript
enum DuckDBDataProtocol {
  BUFFER = 0,
  NODE_FS = 1,
  BROWSER_FILEREADER = 2,
  BROWSER_FSACCESS = 3, // OPFS
  HTTP = 4,
  S3 = 5,
}
```

---

## Platform Detection

### Functions

| Function              | Signature                                           | Description                 |
| --------------------- | --------------------------------------------------- | --------------------------- |
| `isNode`              | `() => boolean`                                     | Check if running in Node.js |
| `isFirefox`           | `() => boolean`                                     | Check if Firefox browser    |
| `isSafari`            | `() => boolean`                                     | Check if Safari browser     |
| `getPlatformFeatures` | `() => Promise<PlatformFeatures>`                   | Get browser capabilities    |
| `selectBundle`        | `(bundles: DuckDBBundles) => Promise<DuckDBBundle>` | Auto-select best bundle     |
| `getJsDelivrBundles`  | `() => DuckDBBundles`                               | Get CDN bundle URLs         |

### PlatformFeatures

```typescript
interface PlatformFeatures {
  bigInt64Array: boolean;
  crossOriginIsolated: boolean;
  wasmExceptions: boolean;
  wasmSIMD: boolean;
  wasmBulkMemory: boolean;
  wasmThreads: boolean;
}
```

---

## OPFS Integration

DuckDB-WASM supports OPFS (Origin Private File System) for persistent storage.

### Usage

```typescript
import * as duckdb from '@duckdb/duckdb-wasm';

// Initialize with OPFS path
await db.open({
  path: 'opfs://workspace.duckdb',
  accessMode: duckdb.DuckDBAccessMode.READ_WRITE,
});

// Or register OPFS file handle directly
const opfsRoot = await navigator.storage.getDirectory();
const fileHandle = await opfsRoot.getFileHandle('workspace.duckdb', { create: true });

await db.registerFileHandle(
  'workspace.duckdb',
  fileHandle,
  duckdb.DuckDBDataProtocol.BROWSER_FSACCESS,
  true // directIO
);
```

### Browser Support for OPFS

| Browser      | OPFS Support             |
| ------------ | ------------------------ |
| Chrome 86+   | Full                     |
| Edge 86+     | Full                     |
| Firefox 111+ | Full                     |
| Safari 15.2+ | Partial (no sync access) |

---

## Insert Options

### ArrowInsertOptions

```typescript
interface ArrowInsertOptions {
  name: string; // Target table name
  schema?: string; // Target schema
  create?: boolean; // Create table if not exists
}
```

### CSVInsertOptions

```typescript
interface CSVInsertOptions {
  name: string;
  schema?: string;
  create?: boolean;
  header?: boolean;
  delimiter?: string;
  quote?: string;
  escape?: string;
  nullstr?: string;
  columns?: { [name: string]: string };
}
```

### JSONInsertOptions

```typescript
interface JSONInsertOptions {
  name: string;
  schema?: string;
  create?: boolean;
  columns?: { [name: string]: string };
}
```

---

## Example: Complete Initialization

```typescript
import * as duckdb from '@duckdb/duckdb-wasm';
import duckdb_wasm from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url';
import duckdb_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url';

async function initDuckDB(): Promise<duckdb.AsyncDuckDBConnection> {
  // Create logger
  const logger = new duckdb.ConsoleLogger();

  // Create worker
  const worker = new Worker(duckdb_worker);

  // Create database instance
  const db = new duckdb.AsyncDuckDB(logger, worker);

  // Instantiate WASM module
  await db.instantiate(duckdb_wasm, null, (progress) => {
    console.log(`Loading: ${progress.bytesLoaded}/${progress.bytesTotal}`);
  });

  // Open database with OPFS persistence
  await db.open({
    path: 'opfs://datamodel.duckdb',
    accessMode: duckdb.DuckDBAccessMode.READ_WRITE,
  });

  // Get version
  const version = await db.getVersion();
  console.log(`DuckDB version: ${version}`);

  // Connect
  const conn = await db.connect();

  return conn;
}
```

---

## Dependencies

DuckDB-WASM uses Apache Arrow for data transfer:

```typescript
import * as arrow from 'apache-arrow';

// Query returns Arrow Table
const result: arrow.Table = await conn.query('SELECT * FROM tables');

// Access columns
const idColumn = result.getChild('id');
const nameColumn = result.getChild('name');

// Iterate rows
for (const row of result) {
  console.log(row.id, row.name);
}

// Convert to array of objects
const rows = result.toArray();
```

---

## Error Handling

```typescript
try {
  await conn.query('INVALID SQL');
} catch (error) {
  if (error instanceof Error) {
    console.error('Query failed:', error.message);
  }
}
```

---

## Performance Notes

1. **Use prepared statements** for repeated queries
2. **Batch inserts** using Arrow IPC for large datasets
3. **Use streaming** (`send()`) for large result sets
4. **Enable OPFS** for persistence instead of in-memory
5. **Single thread** by default (multi-threading requires Cross-Origin Isolation)
