# Sync Engine API Reference

The Sync Engine handles synchronization between YAML files and the DuckDB database.

## Module Location

```typescript
import { getSyncEngine, SyncEngine } from '@/services/database/syncEngine';
```

## Getting the Service

```typescript
// Get the singleton instance
const sync = getSyncEngine();

// With custom configuration
const sync = getSyncEngine({
  debug: true,
  conflictStrategy: 'yaml-wins',
  autoSync: false,
});
```

## Methods

### syncFromMemory(data)

Syncs workspace data from memory to the DuckDB database.

```typescript
async syncFromMemory(data: WorkspaceData): Promise<SyncResult>
```

**Parameters:**

- `data`: WorkspaceData object containing all entities to sync

```typescript
interface WorkspaceData {
  workspace: Workspace;
  domains: Domain[];
  tables: Table[];
  relationships: Relationship[];
  systems: System[];
}
```

**Returns:** `SyncResult`

```typescript
interface SyncResult {
  success: boolean;
  direction: 'yaml-to-db' | 'db-to-yaml' | 'bidirectional';
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
```

**Example:**

```typescript
const result = await sync.syncFromMemory({
  workspace: myWorkspace,
  domains: [domain1, domain2],
  tables: [table1, table2],
  relationships: [rel1],
  systems: [],
});

console.log(`Synced ${result.stats.tablesProcessed} tables in ${result.durationMs}ms`);
```

---

### loadFromDatabase(workspaceId)

Loads workspace data from the DuckDB database.

```typescript
async loadFromDatabase(workspaceId: string): Promise<WorkspaceData | null>
```

**Returns:** WorkspaceData if found, null if workspace doesn't exist.

**Example:**

```typescript
const data = await sync.loadFromDatabase('workspace-1');
if (data) {
  console.log(`Loaded workspace: ${data.workspace.name}`);
  console.log(`Tables: ${data.tables.length}`);
}
```

---

### recordFileSync(filePath, resourceType, resourceId, content)

Records file sync metadata for change tracking.

```typescript
async recordFileSync(
  filePath: string,
  resourceType: string,
  resourceId: string,
  content: string
): Promise<void>
```

**Example:**

```typescript
await sync.recordFileSync(
  '/workspaces/my-workspace/domains/domain-1.yaml',
  'domain',
  'domain-1',
  yamlContent
);
```

---

### hasFileChanged(filePath, currentContent)

Checks if a file has changed since last sync using hash comparison.

```typescript
async hasFileChanged(filePath: string, currentContent: string): Promise<boolean>
```

**Returns:** `true` if file is new or has changed, `false` otherwise.

**Example:**

```typescript
const changed = await sync.hasFileChanged('/path/to/file.yaml', newContent);
if (changed) {
  // File needs to be synced
}
```

---

### getSyncMetadata()

Gets all file sync metadata.

```typescript
async getSyncMetadata(): Promise<FileSyncMetadata[]>
```

**Returns:**

```typescript
interface FileSyncMetadata {
  filePath: string;
  fileHash: string;
  resourceType: string;
  resourceId: string;
  lastSyncedAt: string;
  syncStatus: 'synced' | 'modified' | 'new' | 'deleted';
}
```

---

### getChangedFiles()

Gets files that have changed since last sync.

```typescript
async getChangedFiles(): Promise<FileSyncMetadata[]>
```

---

### markFileModified(filePath)

Marks a file as modified (pending sync).

```typescript
async markFileModified(filePath: string): Promise<void>
```

---

### clearSyncMetadata()

Clears all sync metadata (forces full re-sync).

```typescript
async clearSyncMetadata(): Promise<void>
```

---

### getSyncStats()

Gets sync statistics.

```typescript
async getSyncStats(): Promise<{
  totalFiles: number;
  syncedFiles: number;
  modifiedFiles: number;
  lastSyncAt: string | null;
}>
```

---

### getStatus()

Gets current sync status.

```typescript
getStatus(): SyncStatus  // 'idle' | 'syncing' | 'success' | 'error'
```

## Types

### SyncStatus

```typescript
type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';
```

### SyncDirection

```typescript
type SyncDirection = 'yaml-to-db' | 'db-to-yaml' | 'bidirectional';
```

### SyncError

```typescript
interface SyncError {
  entityType: 'table' | 'relationship' | 'domain' | 'system' | 'workspace';
  entityId?: string;
  message: string;
  filePath?: string;
}
```

### SyncEngineConfig

```typescript
interface SyncEngineConfig {
  debug?: boolean;
  conflictStrategy?: 'yaml-wins' | 'db-wins' | 'prompt';
  autoSync?: boolean;
}
```

## Change Detection

The sync engine uses SHA-256 hashing for change detection:

1. When a file is synced, its content hash is stored
2. On subsequent syncs, the current content hash is compared
3. If hashes differ, the file is marked as changed
4. Only changed files are re-synced

```typescript
// Example flow
await sync.recordFileSync('/path/file.yaml', 'table', 'table-1', content);

// Later...
const changed = await sync.hasFileChanged('/path/file.yaml', newContent);
// Returns true if content hash differs
```

## Error Handling

Sync operations collect errors without stopping the entire sync:

```typescript
const result = await sync.syncFromMemory(data);

if (!result.success) {
  console.log('Sync completed with errors:');
  result.errors.forEach((err) => {
    console.log(`${err.entityType} ${err.entityId}: ${err.message}`);
  });
}

// Partial success - some entities synced
console.log(`Synced: ${result.stats.tablesProcessed} tables`);
```

## Related

- [DuckDB Service API](./DUCKDB_SERVICE.md)
- [Storage Adapter API](./STORAGE_ADAPTER.md)
