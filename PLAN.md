# DuckDB-WASM with OPFS Integration Plan

## Executive Summary

This document outlines the implementation of **DuckDB-WASM with OPFS (Origin Private File System)** for the Open Data Modelling application. This enables high-performance SQL queries in the browser with persistent storage that survives browser restarts.

**Key Benefits:**
- 10-100x query performance improvement over array operations
- Persistent storage via OPFS (no data loss on refresh)
- Works offline in both browser and Electron
- Exportable `.duckdb` files for CLI/analytics tools
- No backend server required

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Browser / Electron                               │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  React Application                                               │   │
│  │                                                                   │   │
│  │  ┌─────────────┐    ┌─────────────────┐    ┌─────────────────┐  │   │
│  │  │ YAML Files  │───▶│ DuckDB-WASM     │◀──▶│ OPFS Storage    │  │   │
│  │  │ (workspace) │    │ (in-browser DB) │    │ (persistent)    │  │   │
│  │  └─────────────┘    └─────────────────┘    └─────────────────┘  │   │
│  │         │                   │                       │            │   │
│  │         │                   ▼                       │            │   │
│  │         │           ┌─────────────────┐             │            │   │
│  │         │           │ SQL Queries     │             │            │   │
│  │         │           │ O(1) Lookups    │             │            │   │
│  │         │           │ Graph Traversal │             │            │   │
│  │         │           └─────────────────┘             │            │   │
│  │         │                   │                       │            │   │
│  │         ▼                   ▼                       ▼            │   │
│  │  ┌─────────────────────────────────────────────────────────────┐│   │
│  │  │                    Export / Import                          ││   │
│  │  │  • Download .duckdb file (for CLI/analytics)                ││   │
│  │  │  • Import existing .duckdb file                             ││   │
│  │  │  • Export to Parquet (cross-platform)                       ││   │
│  │  └─────────────────────────────────────────────────────────────┘│   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

| Component | Technology | Version | Purpose |
|-----------|------------|---------|---------|
| In-Browser Database | `@duckdb/duckdb-wasm` | 1.29.0 (DuckDB 1.4.3) | SQL engine in WebAssembly |
| SDK WASM | `data-modelling-sdk` | 1.13.5 | YAML parsing, validation |
| Persistent Storage | OPFS | Browser API | Browser-native file storage |
| State Management | Zustand | 5.0.9 | React state with DuckDB integration |
| Query Interface | SQL | - | Standard SQL for all operations |
| Interchange Format | Parquet | - | Cross-platform data export |

---

## OPFS (Origin Private File System) Details

### What is OPFS?

OPFS is a modern browser API that provides:
- **Private filesystem** per origin (isolated per domain)
- **High-performance I/O** (synchronous access in workers)
- **Persistence** that survives browser restarts
- **Large file support** (GBs, not capped like localStorage)

### Browser Support

| Browser | OPFS Support | Notes |
|---------|--------------|-------|
| Chrome 86+ | Full | Recommended |
| Edge 86+ | Full | Chromium-based |
| Firefox 111+ | Full | Supported |
| Safari 15.2+ | Partial | Fallback to memory |
| Electron | Full | Uses Chromium |

### How DuckDB-WASM Uses OPFS

```javascript
// DuckDB-WASM with OPFS persistence
import * as duckdb from '@duckdb/duckdb-wasm';

// Initialize with OPFS
const db = await duckdb.AsyncDuckDB.create({
  path: 'opfs://workspace.duckdb',  // OPFS path
  accessMode: duckdb.AccessMode.ReadWrite
});

// Database persists to OPFS automatically
await db.query("CREATE TABLE tables (id TEXT, name TEXT)");
await db.query("INSERT INTO tables VALUES ('uuid', 'customers')");

// Data survives browser restart!
```

---

## Data Flow

### 1. Initial Load (First Visit)

```
YAML Files ──parse──▶ DuckDB-WASM ──persist──▶ OPFS
                           │
                           ▼
                      SQL Queries
```

1. User opens workspace
2. Parse all YAML files (tables, relationships, etc.)
3. INSERT data into DuckDB-WASM tables
4. DuckDB persists to OPFS automatically
5. Application uses SQL for all queries

### 2. Subsequent Loads

```
OPFS ──load──▶ DuckDB-WASM ──verify──▶ YAML Files
                    │                      │
                    │                      ▼
                    │                 (sync if changed)
                    ▼
               SQL Queries
```

1. User opens workspace
2. DuckDB loads from OPFS (fast!)
3. Compare file hashes with `sync_metadata` table
4. Only re-import changed YAML files
5. Application ready in milliseconds

### 3. Save/Export

```
DuckDB-WASM ──export──▶ YAML Files (for Git)
      │
      └──export──▶ .duckdb file (for CLI/sharing)
      │
      └──export──▶ Parquet files (for analytics)
```

---

## Database Schema

### Core Tables

```sql
-- Workspaces
CREATE TABLE workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    folder_path TEXT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

-- Domains
CREATE TABLE domains (
    id TEXT PRIMARY KEY,
    workspace_id TEXT REFERENCES workspaces(id),
    name TEXT NOT NULL,
    description TEXT,
    folder_path TEXT,
    position_x REAL,
    position_y REAL,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

-- Tables (ODCS resources)
CREATE TABLE tables (
    id TEXT PRIMARY KEY,
    workspace_id TEXT REFERENCES workspaces(id),
    domain_id TEXT REFERENCES domains(id),
    system_id TEXT,
    name TEXT NOT NULL,
    alias TEXT,
    description TEXT,
    model_type TEXT,
    data_level TEXT,
    position_x REAL,
    position_y REAL,
    width REAL,
    height REAL,
    owner JSON,
    sla JSON,
    metadata JSON,
    quality_rules JSON,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

-- Columns
CREATE TABLE columns (
    id TEXT PRIMARY KEY,
    table_id TEXT REFERENCES tables(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    data_type TEXT NOT NULL,
    nullable BOOLEAN DEFAULT true,
    is_primary_key BOOLEAN DEFAULT false,
    is_foreign_key BOOLEAN DEFAULT false,
    description TEXT,
    column_order INTEGER,
    constraints JSON,
    quality_rules JSON,
    created_at TIMESTAMP
);

-- Relationships
CREATE TABLE relationships (
    id TEXT PRIMARY KEY,
    workspace_id TEXT REFERENCES workspaces(id),
    domain_id TEXT,
    source_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    source_type TEXT NOT NULL,
    target_type TEXT NOT NULL,
    relationship_type TEXT,
    source_cardinality TEXT,
    target_cardinality TEXT,
    label TEXT,
    color TEXT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

-- Systems
CREATE TABLE systems (
    id TEXT PRIMARY KEY,
    workspace_id TEXT REFERENCES workspaces(id),
    domain_id TEXT REFERENCES domains(id),
    name TEXT NOT NULL,
    description TEXT,
    system_type TEXT,
    connection_info JSON,
    position_x REAL,
    position_y REAL,
    metadata JSON,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

### Supporting Tables

```sql
-- Normalized tags for fast filtering
CREATE TABLE tags (
    id INTEGER PRIMARY KEY,
    resource_type TEXT NOT NULL,
    resource_id TEXT NOT NULL,
    tag_key TEXT,
    tag_value TEXT NOT NULL
);

CREATE INDEX idx_tags_resource ON tags(resource_id, resource_type);
CREATE INDEX idx_tags_value ON tags(tag_value);

-- Sync metadata for change detection
CREATE TABLE sync_metadata (
    file_path TEXT PRIMARY KEY,
    file_hash TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    last_synced_at TIMESTAMP NOT NULL,
    sync_status TEXT
);

-- Decision logs
CREATE TABLE decisions (
    id TEXT PRIMARY KEY,
    workspace_id TEXT,
    domain_id TEXT,
    number INTEGER,
    title TEXT NOT NULL,
    status TEXT,
    category TEXT,
    context TEXT,
    decision TEXT,
    consequences TEXT,
    options JSON,
    superseded_by TEXT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

-- Knowledge articles
CREATE TABLE knowledge_articles (
    id TEXT PRIMARY KEY,
    workspace_id TEXT,
    domain_id TEXT,
    number INTEGER,
    title TEXT NOT NULL,
    article_type TEXT,
    status TEXT,
    summary TEXT,
    content TEXT,
    authors JSON,
    reviewers JSON,
    published_at TIMESTAMP,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

---

## Performance Comparison

| Operation | Current (Array) | With DuckDB | Improvement |
|-----------|-----------------|-------------|-------------|
| Find by ID | O(n) ~1ms | O(1) <0.1ms | 10x+ |
| Filter by domain | O(n) ~5ms | O(log n) <1ms | 5x+ |
| Tag search | O(n×m) ~20ms | O(log n) <2ms | 10x+ |
| Relationship graph (depth 3) | O(n³) ~100ms | O(log n) <5ms | 20x+ |
| Load 1,000 tables | N/A | <1s | New |
| Query 10,000 tables | ~10s | <100ms | 100x+ |

---

## Sync Strategy

### YAML → DuckDB Sync

1. **On workspace open:**
   - Check if OPFS database exists
   - If exists: load from OPFS, verify hashes
   - If not: full import from YAML

2. **Incremental sync:**
   - Compute SHA-256 hash of each YAML file
   - Compare with `sync_metadata` table
   - Only re-import changed files

3. **Conflict detection:**
   - Track both file hash and last sync time
   - Detect if file changed since last sync
   - Prompt user for resolution if needed

### DuckDB → YAML Sync

1. **On save:**
   - Query changed entities from DuckDB
   - Generate YAML files
   - Update `sync_metadata` with new hashes

2. **Export options:**
   - Save to workspace folder (for Git)
   - Download as `.duckdb` file
   - Export as Parquet files

---

## Electron vs Browser

| Feature | Browser | Electron |
|---------|---------|----------|
| OPFS Storage | Yes (browser-native) | Yes (Chromium) |
| File System Access | Via File API / OPFS | Direct via Node.js |
| Export .duckdb | Download to Downloads | Save anywhere |
| Git Hooks | Not applicable | Pre-commit, post-checkout |
| Native DuckDB CLI | Not available | Can spawn CLI |

### Electron Enhancements

```typescript
// In Electron main process
ipcMain.handle('duckdb:export', async (_, workspacePath) => {
  // Export OPFS database to native file
  const db = await getDuckDBFromOPFS();
  const buffer = await db.export();
  await writeFile(`${workspacePath}/.data-model.duckdb`, buffer);
});

ipcMain.handle('duckdb:import', async (_, filePath) => {
  // Import native .duckdb file to OPFS
  const buffer = await readFile(filePath);
  await importToOPFS(buffer);
});
```

---

## API Design

### DuckDB Service

```typescript
// frontend/src/services/database/duckdbService.ts

interface DuckDBService {
  // Initialization
  initialize(): Promise<void>;
  isInitialized(): boolean;
  isOPFSSupported(): boolean;
  
  // Sync operations
  syncFromYAML(workspacePath: string): Promise<SyncResult>;
  syncToYAML(workspacePath: string): Promise<ExportResult>;
  getSyncStatus(): Promise<SyncStatus>;
  
  // Query interface
  query<T>(sql: string, params?: unknown[]): Promise<T[]>;
  execute(sql: string, params?: unknown[]): Promise<void>;
  
  // Export/Import
  exportDatabase(): Promise<Uint8Array>;
  importDatabase(data: Uint8Array): Promise<void>;
  exportToParquet(tableName: string): Promise<Uint8Array>;
  
  // Lifecycle
  close(): Promise<void>;
  reset(): Promise<void>;
}
```

### Storage Adapter

```typescript
// frontend/src/services/storage/duckdbStorageAdapter.ts

interface DuckDBStorageAdapter {
  // Tables
  getTableById(id: string): Promise<Table | null>;
  getTablesByDomain(domainId: string): Promise<Table[]>;
  getTablesByTag(tag: string): Promise<Table[]>;
  saveTable(table: Table): Promise<void>;
  deleteTable(id: string): Promise<void>;
  
  // Relationships
  getRelationshipById(id: string): Promise<Relationship | null>;
  getRelationshipsForTable(tableId: string): Promise<Relationship[]>;
  getRelatedTables(tableId: string, depth?: number): Promise<Table[]>;
  
  // Domains
  getDomainById(id: string): Promise<Domain | null>;
  getAllDomains(): Promise<Domain[]>;
  
  // Graph queries
  findPath(sourceId: string, targetId: string): Promise<string[]>;
  detectCycles(): Promise<Relationship[]>;
  getUpstreamDependencies(tableId: string): Promise<Table[]>;
  getDownstreamDependencies(tableId: string): Promise<Table[]>;
}
```

---

## File Structure

### New Files

```
frontend/
├── src/
│   ├── services/
│   │   └── database/
│   │       ├── duckdbService.ts       # Core DuckDB-WASM service
│   │       ├── duckdbStorageAdapter.ts # Storage adapter using DuckDB
│   │       ├── opfsManager.ts         # OPFS file management
│   │       ├── syncEngine.ts          # YAML ↔ DuckDB sync
│   │       ├── schemaManager.ts       # Database schema creation
│   │       └── queryBuilder.ts        # Type-safe query builder
│   ├── workers/
│   │   └── duckdb.worker.ts           # Web Worker for DuckDB
│   └── hooks/
│       ├── useDuckDB.ts               # React hook for DuckDB
│       └── useQuery.ts                # SQL query hook
├── public/
│   └── duckdb/                        # DuckDB WASM files
│       ├── duckdb-mvp.wasm
│       ├── duckdb-eh.wasm
│       └── duckdb-browser.worker.js
└── package.json                       # Add @duckdb/duckdb-wasm
```

### Modified Files

```
frontend/src/
├── services/
│   └── storage/
│       ├── electronFileService.ts     # Add DuckDB integration
│       └── browserFileService.ts      # Add DuckDB integration
├── stores/
│   ├── tableStore.ts                  # Use DuckDB for queries
│   ├── relationshipStore.ts           # Use DuckDB for queries
│   └── domainStore.ts                 # Use DuckDB for queries
└── components/
    └── settings/
        └── DatabaseSettings.tsx       # Add OPFS status, export buttons
```

---

## Error Handling

### Fallback Strategy

```typescript
async function initializeStorage() {
  // Try DuckDB with OPFS
  if (await isOPFSSupported()) {
    try {
      await duckdbService.initialize();
      return 'duckdb-opfs';
    } catch (error) {
      console.warn('OPFS failed, falling back to in-memory');
    }
  }
  
  // Fallback to in-memory DuckDB
  try {
    await duckdbService.initializeInMemory();
    return 'duckdb-memory';
  } catch (error) {
    console.warn('DuckDB failed, falling back to arrays');
  }
  
  // Final fallback: array-based storage
  return 'array';
}
```

### Browser Compatibility Banner

```tsx
function StorageStatusBanner() {
  const { storageType } = useStorageStatus();
  
  if (storageType === 'array') {
    return (
      <Banner variant="warning">
        Your browser doesn't support OPFS. Data will not persist across sessions.
        <a href="/docs/browser-support">Learn more</a>
      </Banner>
    );
  }
  
  if (storageType === 'duckdb-memory') {
    return (
      <Banner variant="info">
        Using in-memory database. Data will not persist across sessions.
      </Banner>
    );
  }
  
  return null;
}
```

---

## Migration Path

### From Current Implementation

1. **No breaking changes** - existing YAML files work unchanged
2. **Opt-in DuckDB** - enabled automatically when `@duckdb/duckdb-wasm` is installed
3. **Graceful degradation** - falls back to array operations if DuckDB fails
4. **Data preservation** - YAML remains source of truth

### Upgrade Steps

1. Install `@duckdb/duckdb-wasm` package
2. Copy WASM files to `public/duckdb/`
3. Deploy updated application
4. DuckDB initializes automatically on first load
5. Users see improved performance immediately

---

## Testing Strategy

### Unit Tests

- DuckDB service initialization
- Query execution
- Sync operations
- Error handling

### Integration Tests

- YAML → DuckDB import
- DuckDB → YAML export
- OPFS persistence
- Browser compatibility

### Performance Tests

- Load 1,000 / 10,000 tables
- Query response times
- Memory usage monitoring
- OPFS storage limits

---

## Security Considerations

### OPFS Isolation

- OPFS is isolated per origin
- Data cannot be accessed by other websites
- Clearing site data removes OPFS storage

### Data Sensitivity

- Database may contain sensitive schema information
- Export functions should warn users about data exposure
- Consider encryption for downloaded `.duckdb` files

---

## Dependencies

### New Dependencies

```json
{
  "dependencies": {
    "@duckdb/duckdb-wasm": "1.29.0"
  }
}
```

### Required Versions

| Package | Version | Notes |
|---------|---------|-------|
| `@duckdb/duckdb-wasm` | 1.29.0 | DuckDB 1.4.3 core |
| `data-modelling-sdk` (WASM) | 1.13.5 | YAML parsing, validation |

### WASM Bundle Size

| File | Size | Notes |
|------|------|-------|
| duckdb-mvp.wasm | ~4MB | Minimal viable product |
| duckdb-eh.wasm | ~10MB | Full exception handling |
| data_modelling_sdk.wasm | ~2MB | SDK WASM binary |

**Recommendation:** Use `duckdb-mvp.wasm` for initial load, lazy-load full version if needed.

---

## Success Criteria

- [ ] DuckDB-WASM initializes successfully in browser and Electron
- [ ] OPFS persistence works across browser restarts
- [ ] Query performance meets targets (<1ms for ID lookup)
- [ ] Full sync cycle (YAML → DuckDB → YAML) preserves all data
- [ ] Fallback to array operations works when DuckDB unavailable
- [ ] Export/import of `.duckdb` files works correctly
- [ ] Memory usage stays under 500MB for 10,000 tables
- [ ] All existing tests continue to pass
