# DuckDB-WASM Integration Guide

This guide explains how DuckDB-WASM is integrated into the Open Data Modelling application for high-performance in-browser SQL database operations.

## Overview

The application uses [DuckDB-WASM](https://duckdb.org/docs/api/wasm/overview.html) version 1.29.0 (DuckDB 1.4.3) to provide:

- **In-browser SQL database** - Full SQL support without a backend server
- **OPFS persistence** - Data persists across browser sessions using Origin Private File System
- **O(1) lookups** - Instant access to entities by ID via SQL indexes
- **Complex queries** - JOINs, aggregations, and graph traversals
- **Offline support** - Works entirely offline once loaded

## Browser Compatibility

### OPFS Support (Persistent Storage)

| Browser | Minimum Version | Notes           |
| ------- | --------------- | --------------- |
| Chrome  | 86+             | Full support    |
| Edge    | 86+             | Full support    |
| Firefox | 111+            | Full support    |
| Safari  | 15.2+           | Partial support |
| Opera   | 72+             | Full support    |

### Fallback Behavior

When OPFS is not available, the application automatically falls back to **in-memory storage**:

- Data is stored in RAM only
- Data is lost when the browser tab is closed
- A warning banner is shown to the user
- All features work normally, just without persistence

## Architecture

### Core Services

```
DuckDBService          - Core database operations
    ├── OPFSManager    - File system persistence
    ├── SchemaManager  - Database schema/migrations
    └── SyncEngine     - YAML ↔ DuckDB sync

DuckDBStorageAdapter   - Entity CRUD operations
QueryBuilder           - Type-safe SQL query building
ElectronDuckDBService  - Native file operations (Electron only)
```

### Data Flow

```
YAML Files (source of truth)
       ↓ (sync)
DuckDB Database (runtime queries)
       ↓ (export)
Native Files (.duckdb, .json, .csv)
```

## Usage

### Accessing the Database

```typescript
import { getDuckDBService } from '@/services/database';

// Get the singleton service
const duckdb = getDuckDBService();

// Initialize (auto-detects OPFS support)
const result = await duckdb.initialize();

if (result.success) {
  console.log(`DuckDB ${result.version} initialized`);
  console.log(`Storage mode: ${result.storageMode}`);
}
```

### Executing Queries

```typescript
// Simple query
const result = await duckdb.query<{ id: string; name: string }>(
  'SELECT id, name FROM tables WHERE domain_id = ?',
  [domainId]
);

if (result.success) {
  console.log(`Found ${result.rowCount} tables`);
  result.rows.forEach((row) => console.log(row.name));
}
```

### Using the Query Builder

```typescript
import { query } from '@/services/database';

// SELECT query
const { sql, params } = query
  .select('tables')
  .select('id', 'name', 'description')
  .where('domain_id', '=', domainId)
  .orderBy('name', 'ASC')
  .limit(100)
  .build();

// INSERT query
const insertResult = query
  .insert('tables')
  .addObject({ id: 'table-1', name: 'users', domain_id: 'domain-1' })
  .build();

// UPDATE query
const updateResult = query
  .update('tables')
  .set('name', 'updated_users')
  .where('id', '=', 'table-1')
  .build();

// DELETE query
const deleteResult = query.delete('tables').where('id', '=', 'table-1').build();
```

### Using React Hooks

```typescript
import { useDuckDB, useQuery, useSyncStatus } from '@/hooks';

function MyComponent() {
  // Access DuckDB service
  const { isInitialized, capabilities, error } = useDuckDB();

  // Execute a query
  const { data, loading, error, refetch } = useQuery<Table[]>(
    'SELECT * FROM tables WHERE domain_id = ?',
    [domainId]
  );

  // Monitor sync status
  const { status, lastSync, pendingChanges } = useSyncStatus();
}
```

## Storage Adapter

For entity operations, use the storage adapter:

```typescript
import { getDuckDBStorageAdapter } from '@/services/database';

const storage = getDuckDBStorageAdapter();
await storage.initialize();

// Get table by ID (O(1) lookup)
const table = await storage.getTableById('table-1');

// Get tables by domain
const tables = await storage.getTablesByDomain('domain-1');

// Get related tables (graph traversal)
const related = await storage.getRelatedTables('table-1', depth: 2);

// Save table (upsert)
await storage.saveTable(table);

// Delete table
await storage.deleteTable('table-1');
```

## Sync Engine

The sync engine keeps YAML files and DuckDB in sync:

```typescript
import { getSyncEngine } from '@/services/database';

const sync = getSyncEngine();

// Sync workspace from YAML to database
const result = await sync.syncFromMemory(workspaceData);
console.log(`Synced ${result.stats.tablesProcessed} tables`);

// Load workspace from database
const workspace = await sync.loadFromDatabase(workspaceId);

// Check for changes
const hasChanges = await sync.hasFileChanged(filePath, content);

// Get sync statistics
const stats = await sync.getSyncStats();
```

## Export & Import

### Browser Environment

```typescript
const duckdb = getDuckDBService();

// Export to JSON
const jsonBlob = await duckdb.export({ format: 'json', tables: ['tables', 'columns'] });

// Export to CSV
const csvBlob = await duckdb.export({ format: 'csv' });

// Import JSON
await duckdb.import(jsonBlob, { mergeStrategy: 'replace' });
```

### Electron Environment

```typescript
import { getElectronDuckDBService } from '@/services/database';

const electron = getElectronDuckDBService();

// Export to native file (shows save dialog)
const result = await electron.exportToFile({
  format: 'json',
  defaultFileName: 'my-data-model',
  tables: ['tables', 'columns', 'relationships'],
});

// Import from native file (shows open dialog)
const importResult = await electron.importFromFile({
  formats: ['json', 'csv'],
  mergeStrategy: 'merge',
});
```

## Database Schema

The database schema includes tables for:

- `workspaces` - Workspace metadata
- `domains` - Domain definitions
- `systems` - System definitions
- `tables` - Table definitions
- `columns` - Column definitions
- `relationships` - Relationship definitions
- `decisions` - Decision logs
- `knowledge_articles` - Knowledge base articles
- `tags` - Entity tags
- `sync_metadata` - File sync tracking

See `frontend/src/services/database/schemaManager.ts` for the full schema.

## Performance Tips

1. **Use indexed columns** - `id`, `workspace_id`, `domain_id` are indexed
2. **Limit result sets** - Use `.limit()` for large queries
3. **Batch operations** - Use transactions for multiple writes
4. **Avoid SELECT \*** - Select only needed columns

## Troubleshooting

### "OPFS is not supported"

- Check browser version (see compatibility table)
- Ensure you're using HTTPS or localhost
- Check if site is in incognito/private mode (OPFS may be disabled)

### "Database not initialized"

- Call `duckdb.initialize()` before any operations
- Wait for initialization to complete before querying

### "Query failed"

- Check SQL syntax (DuckDB uses standard SQL)
- Verify table/column names exist
- Check parameter count matches placeholders

### Storage quota exceeded

- Export and download a backup
- Clear old backups via OPFS manager
- Check browser storage settings

## Related Documentation

- [DuckDB WASM Bindings](./DUCKDB_BINDINGS.md)
- [SDK Bindings](./SDK_BINDINGS.md)
- [Offline Mode](./OFFLINE_MODE.md)
