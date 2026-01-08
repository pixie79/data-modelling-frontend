# DuckDB Service API Reference

The DuckDB Service provides the core database functionality for the Open Data Modelling application.

## Module Location

```typescript
import { getDuckDBService, DuckDBService } from '@/services/database/duckdbService';
```

## Getting the Service

```typescript
// Get the singleton instance
const duckdb = getDuckDBService();
```

## Methods

### initialize(config?)

Initializes the DuckDB-WASM database.

```typescript
async initialize(config?: Partial<DuckDBConfig>): Promise<DuckDBInitResult>
```

**Parameters:**

- `config` (optional): Configuration options
  - `wasmPath`: Path to WASM files (default: `/duckdb/`)
  - `databaseName`: Database name for OPFS (default: `data-model.duckdb`)
  - `debug`: Enable debug logging (default: `false`)
  - `logger`: Custom logger function

**Returns:** `DuckDBInitResult`

```typescript
interface DuckDBInitResult {
  success: boolean;
  db: AsyncDuckDB | null;
  conn: AsyncDuckDBConnection | null;
  storageMode: StorageMode;
  version?: string;
  error?: string;
}
```

**Example:**

```typescript
const result = await duckdb.initialize({ debug: true });
if (result.success) {
  console.log(`DuckDB ${result.version} ready`);
}
```

---

### query<T>(sql, params?)

Executes a SQL query and returns typed results.

```typescript
async query<T = Record<string, unknown>>(
  sql: string,
  params?: DuckDBParams
): Promise<DuckDBQueryResult<T>>
```

**Parameters:**

- `sql`: SQL query string with `?` placeholders
- `params`: Array of parameter values

**Returns:** `DuckDBQueryResult<T>`

```typescript
interface DuckDBQueryResult<T> {
  success: boolean;
  rows: T[];
  rowCount: number;
  columnNames: string[];
  columnTypes: string[];
  executionTimeMs: number;
  error?: string;
}
```

**Example:**

```typescript
const result = await duckdb.query<{ id: string; name: string }>(
  'SELECT id, name FROM tables WHERE domain_id = ?',
  ['domain-1']
);

if (result.success) {
  result.rows.forEach((row) => console.log(row.name));
}
```

---

### execute(sql, params?)

Executes a SQL statement without returning results (INSERT, UPDATE, DELETE).

```typescript
async execute(
  sql: string,
  params?: DuckDBParams
): Promise<{ success: boolean; error?: string }>
```

**Example:**

```typescript
const result = await duckdb.execute('INSERT INTO tables (id, name) VALUES (?, ?)', [
  'table-1',
  'users',
]);
```

---

### transaction<T>(fn)

Executes multiple statements in a transaction.

```typescript
async transaction<T>(
  fn: (conn: AsyncDuckDBConnection) => Promise<T>
): Promise<{ success: boolean; result?: T; error?: string }>
```

**Example:**

```typescript
const result = await duckdb.transaction(async (conn) => {
  await conn.query('INSERT INTO tables VALUES (...)');
  await conn.query('INSERT INTO columns VALUES (...)');
  return 'success';
});
```

---

### getStats()

Returns database statistics.

```typescript
async getStats(): Promise<DuckDBStats>
```

**Returns:** `DuckDBStats`

```typescript
interface DuckDBStats {
  storageMode: StorageMode;
  databaseSizeBytes: number;
  tableCount: number;
  tables: TableStats[];
  isInitialized: boolean;
  version: string;
  lastError?: string;
}
```

---

### getOPFSStatus()

Returns OPFS storage status.

```typescript
async getOPFSStatus(): Promise<OPFSStatus>
```

**Returns:** `OPFSStatus`

```typescript
interface OPFSStatus {
  supported: boolean;
  enabled: boolean;
  quota?: {
    usage: number;
    quota: number;
    usagePercent: number;
  };
  error?: string;
}
```

---

### export(options)

Exports database to a Blob.

```typescript
async export(options: ExportOptions): Promise<Blob>
```

**Parameters:**

- `options.format`: `'json'` | `'csv'` | `'parquet'` | `'duckdb'`
- `options.tables`: Array of table names (optional, exports all if omitted)

**Example:**

```typescript
const blob = await duckdb.export({ format: 'json' });
// Download or process blob
```

---

### import(data, options)

Imports data into the database.

```typescript
async import(
  data: Blob,
  options: ImportOptions
): Promise<{ success: boolean; error?: string }>
```

**Parameters:**

- `data`: Blob containing data to import
- `options.mergeStrategy`: `'replace'` | `'merge'` | `'skip'`
- `options.dryRun`: If true, validates without importing

---

### reset()

Drops all tables and recreates schema.

```typescript
async reset(): Promise<{ success: boolean; error?: string }>
```

---

### terminate()

Terminates the database connection and releases resources.

```typescript
async terminate(): Promise<void>
```

---

### isInitialized()

Returns whether the database is initialized.

```typescript
isInitialized(): boolean
```

---

### getStorageMode()

Returns the current storage mode.

```typescript
getStorageMode(): StorageMode  // 'memory' | 'opfs'
```

---

### getConnection()

Returns the raw DuckDB connection (for advanced use).

```typescript
getConnection(): AsyncDuckDBConnection | null
```

---

### getDatabase()

Returns the raw DuckDB database instance (for advanced use).

```typescript
getDatabase(): AsyncDuckDB | null
```

## Types

### StorageMode

```typescript
enum StorageMode {
  Memory = 'memory',
  OPFS = 'opfs',
}
```

### ExportFormat

```typescript
enum ExportFormat {
  JSON = 'json',
  CSV = 'csv',
  Parquet = 'parquet',
  DuckDB = 'duckdb',
}
```

### DuckDBParams

```typescript
type DuckDBParams = (string | number | boolean | null | Date | Uint8Array)[];
```

## Error Handling

All methods return error information in the result object rather than throwing:

```typescript
const result = await duckdb.query('INVALID SQL');
if (!result.success) {
  console.error('Query failed:', result.error);
}
```

For methods that throw (like `export`), use try/catch:

```typescript
try {
  const blob = await duckdb.export({ format: 'parquet' });
} catch (error) {
  console.error('Export failed:', error.message);
}
```

## Thread Safety

The DuckDB service uses a singleton pattern. All operations are serialized through a single connection. For parallel operations, use the Web Worker (see `duckdb.worker.ts`).

## Related

- [Sync Engine API](./SYNC_ENGINE.md)
- [Query Builder API](./QUERY_BUILDER.md)
- [Storage Adapter API](./STORAGE_ADAPTER.md)
