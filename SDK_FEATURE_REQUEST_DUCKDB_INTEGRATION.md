# Feature Request: DuckDB Integration and Workspace Schema v2

**Date**: 2026-01-07  
**Requestor**: Data Modelling Application Team  
**SDK Version**: 1.10.0  
**Priority**: High  

---

## Executive Summary

We request the SDK team implement native DuckDB integration to support high-performance querying for large-scale workspaces (1000+ tables, relationships, domains). This feature would include:

1. A new simplified workspace schema (`workspace/v2`)
2. Flat file naming convention (eliminates folder hierarchy)
3. Direct YAML → DuckDB import/export methods
4. Resource content caching in DuckDB
5. Git hook integration support

**Key Benefits**:
- 10-100x query performance improvement at scale
- Simplified file structure (5 file types vs complex folders)
- Single source of truth for YAML ↔ DuckDB sync logic
- Enables tag-based filtering, graph traversal, cycle detection at O(log n) complexity

---

## Problem Statement

### Current Performance Bottlenecks

The application currently loads all YAML files into memory and performs client-side filtering using array operations:

```typescript
// O(n) - Full array scan for every query
const table = tables.find(t => t.id === tableId);
const domainTables = tables.filter(t => t.primary_domain_id === domainId);
const rels = relationships.filter(r => r.source_id === tableId || r.target_id === tableId);
```

**Performance at Scale**:

| Operation | 100 tables | 1,000 tables | 10,000 tables |
|-----------|------------|--------------|---------------|
| Find by ID | 0.01ms | 0.1ms | 1ms |
| Filter by domain | 0.05ms | 0.5ms | 5ms |
| Tag search | 0.2ms | 2ms | 20ms |
| Relationship graph | 1ms | 100ms | **10s+** |

### Critical Operations Requiring Optimization

1. **Tag-Based Filtering**: O(n×m) where n=tables, m=tags per table
2. **Graph Traversal**: Finding all upstream/downstream dependencies
3. **Cycle Detection**: Detecting circular dependencies in relationships
4. **Cross-Domain Lookups**: Searching for shared resources across domains

### Current File Structure Complexity

```
workspace-folder/
  ├── workspace.yaml
  ├── domain-1/
  │   ├── domain.yaml
  │   ├── tables.yaml
  │   ├── relationships.yaml
  │   └── products.yaml
  └── domain-2/
      └── ...
```

**Issues**:
- Recursive directory traversal required
- Multiple YAML file types (workspace, domain, tables, relationships, products, systems)
- Complex path management
- Slower file scanning

---

## Proposed Solution

### 1. New Workspace Schema (`workspace/v2`)

**Single workspace file**: `{workspace_name}.workspace.yaml`

Contains all workspace metadata, domains, systems, and relationships in one file.

#### Schema Definition

```yaml
apiVersion: workspace/v2
kind: Workspace
metadata:
  id: string                    # UUID
  name: string                  # Workspace name (also filename prefix)
  description: string           # Optional
  version: string               # Schema version (e.g., "2.0.0")
  created_at: timestamp         # ISO 8601
  last_modified_at: timestamp   # ISO 8601
  owner:                        # Optional
    name: string
    email: string
    team: string
  tags:                         # Optional workspace-level tags
    - key: string
      value: string

spec:
  # Domains within this workspace
  domains:
    - id: string                # UUID
      name: string              # Domain name
      description: string       # Optional
      owner:                    # Optional
        name: string
        email: string
        team: string
      folder_path: string       # Legacy - for migration
      workspace_path: string    # Legacy - for migration
      view_positions:           # Store per-view canvas positions
        conceptual:
          x: number
          y: number
        logical:
          x: number
          y: number
        physical:
          x: number
          y: number
      tags:                     # Optional domain-level tags
        - key: string
          value: string
      
      # Systems within this domain
      systems:
        - id: string            # UUID
          name: string          # System name (e.g., "crm", "analytics")
          description: string   # Optional
          system_type: string   # E.g., "postgresql", "snowflake", "s3"
          connection_info:      # Optional - connection details
            host: string
            port: number
            database: string
          owner:                # Optional
            name: string
            email: string
            team: string
          position_x: number    # Canvas position
          position_y: number
          metadata:             # Optional - flexible JSON object
            key: value
          tags:                 # Optional system-level tags
            - key: string
              value: string

  # All relationships in the workspace
  relationships:
    - id: string                # UUID
      domain_id: string         # Domain this relationship belongs to (optional)
      source_id: string         # ID of source entity
      target_id: string         # ID of target entity
      source_type: string       # "table" | "system" | "compute-asset" | "product"
      target_type: string       # "table" | "system" | "compute-asset" | "product"
      type: string              # "one-to-one" | "one-to-many" | "many-to-many"
      source_cardinality: string # E.g., "1", "0..1", "0..*", "1..*"
      target_cardinality: string
      label: string             # Optional relationship label
      description: string       # Optional
      is_circular: boolean      # Flag for circular dependencies
      metadata:                 # Optional - flexible JSON object
        key: value
      tags:                     # Optional relationship-level tags
        - key: string
          value: string
```

#### Validation Rules for Workspace Schema

1. **Required Fields**:
   - `apiVersion` must be "workspace/v2"
   - `kind` must be "Workspace"
   - `metadata.id` must be a valid UUID
   - `metadata.name` must be non-empty string
   - `spec.domains` must be an array (can be empty)
   - `spec.relationships` must be an array (can be empty)

2. **Domain Validation**:
   - Each domain must have unique `id`
   - Domain `name` must be non-empty
   - System IDs within a domain must be unique
   - System `name` must be non-empty

3. **Relationship Validation**:
   - `source_id` and `target_id` must reference existing entities
   - `source_type` and `target_type` must be valid enum values
   - `type` must be valid cardinality type
   - Circular relationships should be flagged with `is_circular: true`

4. **Reference Integrity**:
   - All `domain_id` references must point to existing domains
   - Relationship `source_id`/`target_id` should reference existing resources (validated during import)

---

### 2. Simplified File Naming Convention

**Flat structure** - no folder hierarchy:

```
workspace-folder/
  ├── myworkspace.workspace.yaml                    # Workspace + domains + systems + relationships
  ├── myworkspace_sales_crm_customer.odcs.yaml     # System-level ODCS resource
  ├── myworkspace_sales_order.odcs.yaml            # Domain-level ODCS resource
  ├── myworkspace_sales_revenue.odps.yaml          # ODPS data product
  ├── myworkspace_sales_orderprocess.bpmn          # BPMN process (domain-level)
  ├── myworkspace_sales_order_validation.bpmn      # BPMN process (resource-level)
  ├── myworkspace_sales_pricingrules.dmn           # DMN decision (domain-level)
  └── myworkspace.workspace.duckdb                 # DuckDB cache (git-ignored)
```

#### File Naming Patterns

| Resource Type | Pattern | Example | Underscores |
|--------------|---------|---------|-------------|
| Workspace | `{workspace}.workspace.yaml` | `myworkspace.workspace.yaml` | 0 |
| ODCS (System) | `{workspace}_{domain}_{system}_{resource}.odcs.yaml` | `myworkspace_sales_crm_customer.odcs.yaml` | 3 |
| ODCS (Domain) | `{workspace}_{domain}_{resource}.odcs.yaml` | `myworkspace_sales_order.odcs.yaml` | 2 |
| ODPS | `{workspace}_{domain}_{product}.odps.yaml` | `myworkspace_sales_revenue.odps.yaml` | 2 |
| BPMN (Domain) | `{workspace}_{domain}_{process}.bpmn` | `myworkspace_sales_orderprocess.bpmn` | 2 |
| BPMN (Resource) | `{workspace}_{domain}_{resource}_{process}.bpmn` | `myworkspace_sales_order_validation.bpmn` | 3 |
| DMN (Domain) | `{workspace}_{domain}_{decision}.dmn` | `myworkspace_sales_pricingrules.dmn` | 2 |
| DMN (Resource) | `{workspace}_{domain}_{resource}_{decision}.dmn` | `myworkspace_sales_order_approval.dmn` | 3 |

#### Pattern Matching Logic

```rust
pub fn categorize_workspace_files(files: Vec<&str>) -> CategorizedFiles {
    let workspace_pattern = Regex::new(r"^.*\.workspace\.yaml$").unwrap();
    let odcs_pattern = Regex::new(r"^.*_.*_.*\.odcs\.yaml$").unwrap();
    let odps_pattern = Regex::new(r"^.*_.*\.odps\.yaml$").unwrap();
    let bpmn_pattern = Regex::new(r"^.*\.bpmn$").unwrap();
    let dmn_pattern = Regex::new(r"^.*\.dmn$").unwrap();
    
    CategorizedFiles {
        workspace: files.iter().find(|f| workspace_pattern.is_match(f)),
        odcs: files.iter().filter(|f| odcs_pattern.is_match(f)).collect(),
        odps: files.iter().filter(|f| odps_pattern.is_match(f)).collect(),
        bpmn: files.iter().filter(|f| bpmn_pattern.is_match(f)).collect(),
        dmn: files.iter().filter(|f| dmn_pattern.is_match(f)).collect(),
    }
}
```

**Benefits**:
- No recursive directory traversal needed
- Predictable file scanning (5 patterns)
- Filename encodes full context (workspace/domain/system/resource)
- Git-friendly (flat structure easier to track)
- Protected loads (extension + underscore count validation)

---

### 3. DuckDB Schema

#### Database Schema Definition

The SDK should create and manage the following DuckDB schema:

```sql
-- ============================================================
-- CORE ENTITIES
-- ============================================================

-- Workspaces
CREATE TABLE workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    version TEXT,
    created_at TIMESTAMP,
    last_modified_at TIMESTAMP,
    owner JSON,              -- {name, email, team}
    tags JSON,               -- [{key, value}]
    metadata JSON
);

-- Domains
CREATE TABLE domains (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    owner JSON,
    folder_path TEXT,        -- Legacy migration support
    workspace_path TEXT,     -- Legacy migration support
    view_positions JSON,     -- {conceptual: {x, y}, logical: {x, y}, physical: {x, y}}
    tags JSON,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE INDEX idx_domains_workspace ON domains(workspace_id);
CREATE INDEX idx_domains_name ON domains(workspace_id, name);

-- Systems
CREATE TABLE systems (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    primary_domain_id TEXT NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    system_type TEXT,        -- "postgresql", "snowflake", "s3", etc.
    connection_info JSON,    -- {host, port, database, ...}
    owner JSON,
    position_x REAL,
    position_y REAL,
    metadata JSON,
    tags JSON,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE INDEX idx_systems_workspace ON systems(workspace_id);
CREATE INDEX idx_systems_domain ON systems(primary_domain_id);
CREATE INDEX idx_systems_name ON systems(primary_domain_id, name);

-- Tables (ODCS resources)
CREATE TABLE tables (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    primary_domain_id TEXT NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
    primary_system_id TEXT REFERENCES systems(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    alias TEXT,
    description TEXT,
    model_type TEXT CHECK(model_type IN ('conceptual', 'logical', 'physical')),
    data_level TEXT CHECK(data_level IN ('operational', 'bronze', 'silver', 'gold')),
    position_x REAL,
    position_y REAL,
    width REAL,
    height REAL,
    metadata JSON,
    owner JSON,              -- {name, email, team, domain}
    sla JSON,                -- {availability, latency, retention, freshness, ...}
    quality_rules JSON,      -- Array of data quality rule objects
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE INDEX idx_tables_workspace ON tables(workspace_id);
CREATE INDEX idx_tables_domain ON tables(primary_domain_id);
CREATE INDEX idx_tables_system ON tables(primary_system_id);
CREATE INDEX idx_tables_name ON tables(name);
CREATE INDEX idx_tables_model_type ON tables(model_type);
CREATE INDEX idx_tables_data_level ON tables(data_level);

-- Columns
CREATE TABLE columns (
    id TEXT PRIMARY KEY,
    table_id TEXT NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    data_type TEXT NOT NULL,
    nullable BOOLEAN DEFAULT true,
    is_primary_key BOOLEAN DEFAULT false,
    is_foreign_key BOOLEAN DEFAULT false,
    foreign_key_table_id TEXT REFERENCES tables(id) ON DELETE SET NULL,
    foreign_key_column_id TEXT REFERENCES columns(id) ON DELETE SET NULL,
    description TEXT,
    "order" INTEGER,         -- Column order in table
    constraints JSON,        -- {unique, check, default, ...}
    quality_rules JSON,      -- Column-level quality rules
    metadata JSON,
    created_at TIMESTAMP
);

CREATE INDEX idx_columns_table ON columns(table_id);
CREATE INDEX idx_columns_name ON columns(table_id, name);
CREATE INDEX idx_columns_fk_table ON columns(foreign_key_table_id);
CREATE INDEX idx_columns_fk_column ON columns(foreign_key_column_id);

-- Relationships
CREATE TABLE relationships (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    domain_id TEXT REFERENCES domains(id) ON DELETE SET NULL,
    source_id TEXT NOT NULL,    -- Generic ID (can reference tables, systems, assets, products)
    target_id TEXT NOT NULL,
    source_type TEXT NOT NULL CHECK(source_type IN ('table', 'system', 'compute-asset', 'product')),
    target_type TEXT NOT NULL CHECK(target_type IN ('table', 'system', 'compute-asset', 'product')),
    type TEXT CHECK(type IN ('one-to-one', 'one-to-many', 'many-to-many')),
    source_cardinality TEXT,    -- "1", "0..1", "0..*", "1..*"
    target_cardinality TEXT,
    label TEXT,
    description TEXT,
    is_circular BOOLEAN DEFAULT false,
    metadata JSON,
    tags JSON,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE INDEX idx_relationships_workspace ON relationships(workspace_id);
CREATE INDEX idx_relationships_domain ON relationships(domain_id);
CREATE INDEX idx_relationships_source ON relationships(source_id, source_type);
CREATE INDEX idx_relationships_target ON relationships(target_id, target_type);
CREATE INDEX idx_relationships_both ON relationships(source_id, target_id);  -- For cycle detection

-- ============================================================
-- RESOURCE TYPES
-- ============================================================

-- Data Products (ODPS)
CREATE TABLE products (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    domain_id TEXT NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    product_type TEXT,       -- "batch", "streaming", "api", etc.
    owner JSON,
    sla JSON,
    metadata JSON,
    tags JSON,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE INDEX idx_products_workspace ON products(workspace_id);
CREATE INDEX idx_products_domain ON products(domain_id);
CREATE INDEX idx_products_name ON products(domain_id, name);

-- Compute Assets (Transformations, Pipelines)
CREATE TABLE compute_assets (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    domain_id TEXT NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    asset_type TEXT,         -- "transformation", "pipeline", "job", etc.
    position_x REAL,
    position_y REAL,
    metadata JSON,
    owner JSON,
    tags JSON,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE INDEX idx_compute_assets_workspace ON compute_assets(workspace_id);
CREATE INDEX idx_compute_assets_domain ON compute_assets(domain_id);
CREATE INDEX idx_compute_assets_name ON compute_assets(domain_id, name);

-- BPMN Processes
CREATE TABLE bpmn_processes (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    domain_id TEXT NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
    resource_id TEXT,        -- Optional - tied to specific resource (table/product)
    resource_type TEXT CHECK(resource_type IN ('table', 'product', 'asset', NULL)),
    name TEXT NOT NULL,
    description TEXT,
    xml_content TEXT NOT NULL,  -- Full BPMN XML
    metadata JSON,
    tags JSON,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE INDEX idx_bpmn_workspace ON bpmn_processes(workspace_id);
CREATE INDEX idx_bpmn_domain ON bpmn_processes(domain_id);
CREATE INDEX idx_bpmn_resource ON bpmn_processes(resource_id, resource_type);

-- DMN Decisions
CREATE TABLE dmn_decisions (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    domain_id TEXT NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
    resource_id TEXT,        -- Optional - tied to specific resource
    resource_type TEXT CHECK(resource_type IN ('table', 'product', 'asset', NULL)),
    name TEXT NOT NULL,
    description TEXT,
    xml_content TEXT NOT NULL,  -- Full DMN XML
    metadata JSON,
    tags JSON,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE INDEX idx_dmn_workspace ON dmn_decisions(workspace_id);
CREATE INDEX idx_dmn_domain ON dmn_decisions(domain_id);
CREATE INDEX idx_dmn_resource ON dmn_decisions(resource_id, resource_type);

-- ============================================================
-- TAGS (Normalized for Fast Filtering)
-- ============================================================

CREATE TABLE tags (
    id INTEGER PRIMARY KEY,
    resource_type TEXT NOT NULL CHECK(resource_type IN ('workspace', 'domain', 'system', 'table', 'product', 'asset', 'relationship', 'bpmn', 'dmn')),
    resource_id TEXT NOT NULL,
    tag_key TEXT,            -- Optional key for key-value tags
    tag_value TEXT NOT NULL, -- Tag value or simple tag string
    created_at TIMESTAMP
);

CREATE INDEX idx_tags_resource ON tags(resource_id, resource_type);
CREATE INDEX idx_tags_value ON tags(tag_value);
CREATE INDEX idx_tags_key_value ON tags(tag_key, tag_value);
CREATE INDEX idx_tags_type_value ON tags(resource_type, tag_value);

-- ============================================================
-- RESOURCE CONTENT CACHE
-- ============================================================

-- Cache for ODCS content
CREATE TABLE cached_odcs (
    resource_id TEXT PRIMARY KEY REFERENCES tables(id) ON DELETE CASCADE,
    yaml_content TEXT NOT NULL,
    file_path TEXT NOT NULL,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

-- Cache for ODPS content
CREATE TABLE cached_odps (
    resource_id TEXT PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
    yaml_content TEXT NOT NULL,
    file_path TEXT NOT NULL,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

-- Cache for BPMN content (already stored in bpmn_processes.xml_content)
-- Cache for DMN content (already stored in dmn_decisions.xml_content)

-- ============================================================
-- SYNC METADATA (File Tracking)
-- ============================================================

CREATE TABLE sync_metadata (
    file_path TEXT PRIMARY KEY,
    file_hash TEXT NOT NULL,     -- SHA-256 hash for change detection
    resource_type TEXT NOT NULL, -- "workspace", "odcs", "odps", "bpmn", "dmn"
    resource_id TEXT,            -- Optional reference to entity
    last_synced_at TIMESTAMP NOT NULL,
    sync_status TEXT CHECK(sync_status IN ('synced', 'modified', 'conflict', 'deleted'))
);

CREATE INDEX idx_sync_status ON sync_metadata(sync_status);
CREATE INDEX idx_sync_resource ON sync_metadata(resource_id);
```

---

### 4. SDK Methods (Rust API)

#### 4.1 Workspace Schema Methods

```rust
/// Parse workspace YAML (v2 schema)
/// 
/// # Arguments
/// * `yaml_content` - The YAML string to parse
/// 
/// # Returns
/// * `Ok(Workspace)` - Parsed workspace object
/// * `Err(ParseError)` - Validation or parsing error
pub fn parse_workspace_yaml(yaml_content: &str) -> Result<Workspace, ParseError>;

/// Export workspace to YAML (v2 schema)
/// 
/// # Arguments
/// * `workspace` - The workspace object to export
/// 
/// # Returns
/// * `Ok(String)` - YAML string
/// * `Err(ExportError)` - Serialization error
pub fn export_workspace_yaml(workspace: &Workspace) -> Result<String, ExportError>;

/// Validate workspace schema
/// 
/// # Arguments
/// * `yaml_content` - The YAML string to validate
/// 
/// # Returns
/// * `ValidationResult` - Contains errors and warnings
pub fn validate_workspace_schema(yaml_content: &str) -> ValidationResult;
```

#### 4.2 File Scanning Methods

```rust
/// Scan workspace directory for all files
/// 
/// # Arguments
/// * `workspace_dir` - Path to workspace directory
/// 
/// # Returns
/// * `Ok(WorkspaceFiles)` - Categorized file paths
/// * `Err(ScanError)` - Directory read error or no workspace file found
pub fn scan_workspace_files(workspace_dir: &str) -> Result<WorkspaceFiles, ScanError>;

/// Structure for categorized files
pub struct WorkspaceFiles {
    pub workspace_file: String,           // Path to *.workspace.yaml
    pub odcs_files: Vec<String>,          // Paths to *.odcs.yaml
    pub odps_files: Vec<String>,          // Paths to *.odps.yaml
    pub bpmn_files: Vec<String>,          // Paths to *.bpmn
    pub dmn_files: Vec<String>,           // Paths to *.dmn
}
```

#### 4.3 DuckDB Import Methods

```rust
/// Load workspace from YAML files into DuckDB
/// 
/// This method:
/// 1. Scans directory for all workspace files
/// 2. Parses workspace.yaml
/// 3. Parses all ODCS, ODPS, BPMN, DMN files
/// 4. Creates DuckDB schema if needed
/// 5. Inserts all data into DuckDB
/// 6. Caches resource content
/// 7. Computes file hashes and updates sync_metadata
/// 
/// # Arguments
/// * `workspace_dir` - Path to workspace directory
/// * `db_path` - Path to DuckDB file (e.g., "workspace.duckdb")
/// 
/// # Returns
/// * `Ok(LoadResult)` - Statistics about loaded data
/// * `Err(DatabaseError)` - Parse or database error
pub fn load_to_duckdb(
    workspace_dir: &str,
    db_path: &str
) -> Result<LoadResult, DatabaseError>;

/// Load result statistics
pub struct LoadResult {
    pub workspace_count: usize,
    pub domain_count: usize,
    pub system_count: usize,
    pub table_count: usize,
    pub column_count: usize,
    pub relationship_count: usize,
    pub product_count: usize,
    pub asset_count: usize,
    pub bpmn_count: usize,
    pub dmn_count: usize,
    pub duration_ms: u64,
}
```

#### 4.4 DuckDB Export Methods

```rust
/// Export workspace from DuckDB to YAML files
/// 
/// This method:
/// 1. Queries all data from DuckDB
/// 2. Generates workspace.yaml
/// 3. Generates individual ODCS, ODPS files
/// 4. Writes BPMN, DMN files
/// 5. Updates file hashes in sync_metadata
/// 
/// # Arguments
/// * `db_path` - Path to DuckDB file
/// * `output_dir` - Directory to write files to
/// 
/// # Returns
/// * `Ok(ExportResult)` - Statistics about exported files
/// * `Err(DatabaseError)` - Query or file write error
pub fn export_from_duckdb(
    db_path: &str,
    output_dir: &str
) -> Result<ExportResult, DatabaseError>;

/// Export result statistics
pub struct ExportResult {
    pub workspace_file: String,
    pub odcs_files: Vec<String>,
    pub odps_files: Vec<String>,
    pub bpmn_files: Vec<String>,
    pub dmn_files: Vec<String>,
    pub duration_ms: u64,
}
```

#### 4.5 DuckDB Rebuild Methods

```rust
/// Rebuild DuckDB from YAML files (full sync)
/// 
/// This is used by Git hooks after pull/merge/checkout.
/// 
/// Steps:
/// 1. Drop all existing tables in DuckDB
/// 2. Recreate schema
/// 3. Load all YAML files
/// 4. Update sync_metadata
/// 
/// # Arguments
/// * `workspace_dir` - Path to workspace directory
/// * `db_path` - Path to DuckDB file
/// 
/// # Returns
/// * `Ok(RebuildResult)` - Statistics and duration
/// * `Err(DatabaseError)` - Error during rebuild
pub fn rebuild_duckdb(
    workspace_dir: &str,
    db_path: &str
) -> Result<RebuildResult, DatabaseError>;

/// Rebuild result
pub struct RebuildResult {
    pub entities_loaded: usize,
    pub files_processed: usize,
    pub duration_ms: u64,
}
```

#### 4.6 Resource Content Caching

```rust
/// Cache resource content in DuckDB
/// 
/// Stores full YAML/XML content for resources to avoid re-parsing.
/// 
/// # Arguments
/// * `db_path` - Path to DuckDB file
/// * `resource_id` - UUID of resource
/// * `resource_type` - Type: ODCS, ODPS, BPMN, DMN
/// * `content` - Full file content (YAML or XML)
/// * `file_path` - Relative file path
/// 
/// # Returns
/// * `Ok(())` - Success
/// * `Err(CacheError)` - Database error
pub fn cache_resource_content(
    db_path: &str,
    resource_id: &str,
    resource_type: ResourceType,
    content: &str,
    file_path: &str
) -> Result<(), CacheError>;

/// Resource type enum
pub enum ResourceType {
    ODCS,
    ODPS,
    BPMN,
    DMN,
}
```

#### 4.7 Hash and Sync Methods

```rust
/// Compute SHA-256 hash of file content
/// 
/// # Arguments
/// * `content` - File content string
/// 
/// # Returns
/// * SHA-256 hash as hex string
pub fn compute_file_hash(content: &str) -> String;

/// Check if files have changed since last sync
/// 
/// # Arguments
/// * `db_path` - Path to DuckDB file
/// * `file_paths` - List of files to check
/// 
/// # Returns
/// * `Vec<ChangedFile>` - Files that have changed
pub fn detect_file_changes(
    db_path: &str,
    file_paths: Vec<&str>
) -> Result<Vec<ChangedFile>, DatabaseError>;

pub struct ChangedFile {
    pub file_path: String,
    pub old_hash: String,
    pub new_hash: String,
    pub change_type: ChangeType,  // Modified, Added, Deleted
}

pub enum ChangeType {
    Modified,
    Added,
    Deleted,
}
```

---

### 5. Import/Export Logic

#### Import Workflow (YAML → DuckDB)

```
1. Scan workspace directory
   └─ Find *.workspace.yaml (must exist, error if not found)
   └─ Find all *.odcs.yaml, *.odps.yaml, *.bpmn, *.dmn

2. Parse workspace.yaml
   └─ Validate schema version (must be workspace/v2)
   └─ Extract workspace metadata
   └─ Extract all domains
   └─ Extract all systems
   └─ Extract all relationships

3. Open/create DuckDB connection
   └─ If schema doesn't exist: CREATE SCHEMA
   └─ If schema exists: Begin transaction

4. Insert workspace data
   └─ INSERT INTO workspaces (...)
   └─ INSERT INTO domains (...)
   └─ INSERT INTO systems (...)
   └─ INSERT INTO relationships (...)

5. Parse and insert ODCS files
   └─ For each *.odcs.yaml:
       ├─ Parse ODCS YAML
       ├─ Extract table definition
       ├─ INSERT INTO tables (...)
       ├─ For each column: INSERT INTO columns (...)
       ├─ Extract tags: INSERT INTO tags (...)
       ├─ Cache content: INSERT INTO cached_odcs (...)
       └─ Compute file hash: INSERT INTO sync_metadata (...)

6. Parse and insert ODPS files
   └─ For each *.odps.yaml:
       ├─ Parse ODPS YAML
       ├─ INSERT INTO products (...)
       ├─ Extract tags: INSERT INTO tags (...)
       ├─ Cache content: INSERT INTO cached_odps (...)
       └─ Update sync_metadata

7. Parse and insert BPMN files
   └─ For each *.bpmn:
       ├─ Parse BPMN XML
       ├─ INSERT INTO bpmn_processes (xml_content, ...)
       ├─ Extract tags from XML: INSERT INTO tags (...)
       └─ Update sync_metadata

8. Parse and insert DMN files
   └─ For each *.dmn:
       ├─ Parse DMN XML
       ├─ INSERT INTO dmn_decisions (xml_content, ...)
       ├─ Extract tags: INSERT INTO tags (...)
       └─ Update sync_metadata

9. Commit transaction

10. Return LoadResult with statistics
```

#### Export Workflow (DuckDB → YAML)

```
1. Open DuckDB connection

2. Query workspace data
   └─ SELECT * FROM workspaces
   └─ SELECT * FROM domains WHERE workspace_id = ?
   └─ SELECT * FROM systems WHERE workspace_id = ?
   └─ SELECT * FROM relationships WHERE workspace_id = ?

3. Generate workspace.yaml
   └─ Construct workspace/v2 schema
   └─ Include all domains with nested systems
   └─ Include all relationships
   └─ Write to {workspace_name}.workspace.yaml
   └─ Compute hash and update sync_metadata

4. Export ODCS files
   └─ SELECT * FROM tables WHERE workspace_id = ?
   └─ For each table:
       ├─ SELECT * FROM columns WHERE table_id = ?
       ├─ SELECT * FROM tags WHERE resource_id = ? AND resource_type = 'table'
       ├─ Construct ODCS YAML (use existing export_to_odcs_yaml)
       ├─ Determine filename: {workspace}_{domain}_{system}_{table}.odcs.yaml
       ├─ Write file
       └─ Update sync_metadata

5. Export ODPS files
   └─ SELECT * FROM products WHERE workspace_id = ?
   └─ For each product:
       ├─ SELECT tags
       ├─ Construct ODPS YAML
       ├─ Determine filename: {workspace}_{domain}_{product}.odps.yaml
       ├─ Write file
       └─ Update sync_metadata

6. Export BPMN files
   └─ SELECT * FROM bpmn_processes WHERE workspace_id = ?
   └─ For each process:
       ├─ Get xml_content
       ├─ Determine filename based on resource_id/resource_type
       ├─ Write {workspace}_{domain}_{resource}_{process}.bpmn
       └─ Update sync_metadata

7. Export DMN files
   └─ SELECT * FROM dmn_decisions WHERE workspace_id = ?
   └─ For each decision:
       ├─ Get xml_content
       ├─ Determine filename
       ├─ Write file
       └─ Update sync_metadata

8. Return ExportResult with file paths
```

#### Rebuild Workflow (Full Sync)

```
1. Open DuckDB connection

2. Drop all tables (if exist)
   └─ DROP TABLE IF EXISTS ... (in reverse dependency order)

3. Recreate schema
   └─ Execute full CREATE TABLE statements

4. Call load_to_duckdb()
   └─ (Same as import workflow)

5. Return RebuildResult
```

---

### 6. Validation Rules

#### File-Level Validation

1. **Workspace File**:
   - Must have exactly one `*.workspace.yaml` file
   - Must be valid YAML syntax
   - Must conform to `workspace/v2` schema
   - All domain IDs must be unique
   - All system IDs within workspace must be unique

2. **ODCS Files**:
   - Filename must match pattern: `{workspace}_{domain}_{system}_{resource}.odcs.yaml` or `{workspace}_{domain}_{resource}.odcs.yaml`
   - Must be valid ODCS YAML (use existing validation)
   - Table ID must be unique within workspace
   - Column names must be unique within table
   - Foreign key references should be validated (warning if not found)

3. **ODPS Files**:
   - Filename must match pattern: `{workspace}_{domain}_{product}.odps.yaml`
   - Must be valid ODPS YAML
   - Product ID must be unique within workspace

4. **BPMN Files**:
   - Must be valid BPMN 2.0 XML
   - Process ID must be unique

5. **DMN Files**:
   - Must be valid DMN 1.3 XML
   - Decision ID must be unique

#### Cross-File Validation

1. **Domain References**:
   - All `primary_domain_id` in tables must reference existing domain
   - All `domain_id` in relationships must reference existing domain (or be NULL)

2. **System References**:
   - All `primary_system_id` in tables must reference existing system (or be NULL)

3. **Relationship References**:
   - `source_id` and `target_id` should reference existing entities
   - Provide warnings (not errors) for missing references to allow incremental loading

4. **Circular Dependency Detection**:
   - Detect cycles in relationships during import
   - Set `is_circular: true` flag automatically

#### Data Integrity Checks

1. **Foreign Keys**:
   - Check that foreign key references point to existing tables/columns
   - Warn if foreign key points to non-primary-key column

2. **Tag Validation**:
   - Tags must have non-empty values
   - Tag keys (if present) must be non-empty

3. **Position Data**:
   - Position coordinates should be numeric
   - Width/height should be positive

---

### 7. Git Hook Integration

#### Provided Hook Scripts

The SDK should provide template Git hook scripts:

##### `post-checkout` Hook

```bash
#!/bin/bash
# .git/hooks/post-checkout
# Triggered after: git checkout, git switch, git pull

WORKSPACE_DIR="$(git rev-parse --show-toplevel)"
WORKSPACE_NAME=$(basename "$WORKSPACE_DIR")
DB_PATH="$WORKSPACE_DIR/$WORKSPACE_NAME.workspace.duckdb"

# Check if workspace.yaml exists
if [ ! -f "$WORKSPACE_DIR/$WORKSPACE_NAME.workspace.yaml" ]; then
    echo "No workspace.yaml found, skipping DuckDB rebuild"
    exit 0
fi

echo "Rebuilding DuckDB from YAML files..."
data-modelling-sdk rebuild-duckdb --workspace-dir "$WORKSPACE_DIR" --db-path "$DB_PATH"

if [ $? -eq 0 ]; then
    echo "✓ DuckDB rebuild complete"
else
    echo "✗ DuckDB rebuild failed"
    exit 1
fi
```

##### `post-merge` Hook

```bash
#!/bin/bash
# .git/hooks/post-merge
# Triggered after: git merge, git pull (with merge)

# Same logic as post-checkout
exec "$(dirname "$0")/post-checkout"
```

##### `pre-commit` Hook (Optional)

```bash
#!/bin/bash
# .git/hooks/pre-commit
# Export DuckDB to YAML before committing

WORKSPACE_DIR="$(git rev-parse --show-toplevel)"
WORKSPACE_NAME=$(basename "$WORKSPACE_DIR")
DB_PATH="$WORKSPACE_DIR/$WORKSPACE_NAME.workspace.duckdb"

# Check if DuckDB file exists
if [ ! -f "$DB_PATH" ]; then
    echo "No DuckDB file found, skipping export"
    exit 0
fi

echo "Exporting DuckDB to YAML files..."
data-modelling-sdk export-from-duckdb --db-path "$DB_PATH" --output-dir "$WORKSPACE_DIR"

if [ $? -eq 0 ]; then
    # Stage any modified YAML files
    git add *.workspace.yaml *.odcs.yaml *.odps.yaml *.bpmn *.dmn 2>/dev/null
    echo "✓ DuckDB export complete"
else
    echo "✗ DuckDB export failed"
    exit 1
fi
```

#### CLI Tool

The SDK should provide a CLI tool: `data-modelling-sdk`

```bash
# Rebuild DuckDB from YAML
data-modelling-sdk rebuild-duckdb --workspace-dir /path/to/workspace --db-path workspace.duckdb

# Export DuckDB to YAML
data-modelling-sdk export-from-duckdb --db-path workspace.duckdb --output-dir /path/to/workspace

# Validate workspace files
data-modelling-sdk validate --workspace-dir /path/to/workspace

# Show workspace info
data-modelling-sdk info --db-path workspace.duckdb
```

---

### 8. Error Handling

#### Parse Errors

```rust
pub enum ParseError {
    InvalidYaml(String),          // YAML syntax error
    SchemaVersionMismatch(String), // Wrong apiVersion
    MissingRequiredField(String),  // Required field missing
    InvalidFieldValue(String),     // Invalid enum or type
    InvalidReference(String),      // Reference to non-existent entity
}
```

#### Database Errors

```rust
pub enum DatabaseError {
    ConnectionFailed(String),
    SchemaCreationFailed(String),
    InsertFailed(String),
    QueryFailed(String),
    TransactionFailed(String),
    FileNotFound(String),
    FileReadError(String),
    FileWriteError(String),
}
```

#### Validation Results

```rust
pub struct ValidationResult {
    pub valid: bool,
    pub errors: Vec<ValidationError>,
    pub warnings: Vec<ValidationWarning>,
}

pub struct ValidationError {
    pub file_path: Option<String>,
    pub line: Option<usize>,
    pub field: Option<String>,
    pub message: String,
}

pub struct ValidationWarning {
    pub file_path: Option<String>,
    pub message: String,
}
```

---

### 9. Migration Path

#### From Current Format to v2

The SDK should provide a migration function:

```rust
/// Migrate workspace from v1 (folder-based) to v2 (flat files)
/// 
/// Steps:
/// 1. Scan old folder structure
/// 2. Parse all domain.yaml, tables.yaml, relationships.yaml files
/// 3. Consolidate into new workspace.yaml
/// 4. Rename resource files to new naming convention
/// 5. Generate DuckDB file
/// 
/// # Arguments
/// * `old_workspace_dir` - Path to old workspace (with domain folders)
/// * `new_workspace_dir` - Path to new workspace (flat structure)
/// * `workspace_name` - Name for new workspace
/// 
/// # Returns
/// * `Ok(MigrationResult)` - Statistics about migration
/// * `Err(MigrationError)` - Error during migration
pub fn migrate_workspace_v1_to_v2(
    old_workspace_dir: &str,
    new_workspace_dir: &str,
    workspace_name: &str
) -> Result<MigrationResult, MigrationError>;
```

---

### 10. Performance Requirements

1. **Import Performance**:
   - Load 1,000 tables in < 1 second
   - Load 10,000 tables in < 10 seconds

2. **Export Performance**:
   - Export 1,000 tables in < 2 seconds
   - Export 10,000 tables in < 20 seconds

3. **Query Performance** (App-side, not SDK):
   - Find by ID: < 1ms
   - Filter by domain: < 10ms
   - Tag search: < 50ms
   - Graph traversal (depth 10): < 200ms

4. **Rebuild Performance**:
   - Full rebuild from 1,000 files: < 2 seconds
   - Full rebuild from 10,000 files: < 20 seconds

---

## Expected Usage in Application

### Initialization

```typescript
import { sdkLoader } from '@/services/sdk/sdkLoader';

const sdk = sdkLoader.getModule();

// Load workspace into DuckDB
const result = await sdk.load_to_duckdb(
    '/path/to/workspace',
    '/path/to/workspace/myworkspace.workspace.duckdb'
);

console.log(`Loaded ${result.table_count} tables, ${result.relationship_count} relationships`);
```

### Git Hook (Automatic Rebuild)

```bash
# After git pull
cd /path/to/workspace
data-modelling-sdk rebuild-duckdb \
    --workspace-dir . \
    --db-path myworkspace.workspace.duckdb
```

### Export Before Commit

```typescript
// User clicks "Save" in app
const sdk = sdkLoader.getModule();

await sdk.export_from_duckdb(
    '/path/to/workspace/myworkspace.workspace.duckdb',
    '/path/to/workspace'
);

// Git commit YAML files
```

### Query DuckDB (App-side)

```typescript
import { getDuckDBInstance } from '@/services/database/duckdbFactory';

const db = getDuckDBInstance('/path/to/workspace/myworkspace.workspace.duckdb');

// Fast indexed lookup
const table = await db.query(`SELECT * FROM tables WHERE id = ?`, [tableId]);

// Tag filtering
const taggedTables = await db.query(`
    SELECT DISTINCT t.* FROM tables t
    JOIN tags tg ON tg.resource_id = t.id AND tg.resource_type = 'table'
    WHERE tg.tag_value IN (?, ?, ?)
`, ['production', 'critical', 'pii']);

// Graph traversal
const dependencies = await db.query(`
    WITH RECURSIVE deps AS (
        SELECT target_id, 0 as level FROM relationships WHERE source_id = ?
        UNION ALL
        SELECT r.target_id, d.level + 1
        FROM relationships r JOIN deps d ON r.source_id = d.id
        WHERE d.level < 10
    )
    SELECT t.*, d.level FROM deps d JOIN tables t ON t.id = d.id
`, [startTableId]);
```

---

## Dependencies

- **DuckDB Rust crate**: `duckdb = "0.9.2"`
- **YAML parsing**: `serde_yaml = "0.9"`
- **SHA-256 hashing**: `sha2 = "0.10"`
- **File I/O**: `std::fs`, `std::path`
- **XML parsing** (for BPMN/DMN): `quick-xml = "0.31"` or similar

---

## Testing Requirements

1. **Unit Tests**:
   - Test each public method with valid/invalid inputs
   - Test schema validation with various error cases
   - Test file pattern matching

2. **Integration Tests**:
   - Test full import workflow with sample workspace
   - Test full export workflow
   - Test rebuild workflow
   - Test migration from v1 to v2

3. **Performance Tests**:
   - Benchmark import with 1,000 and 10,000 tables
   - Benchmark export
   - Benchmark rebuild

4. **Sample Data**:
   - Provide sample workspace with:
     - 2-3 domains
     - 5-10 systems
     - 20-30 tables
     - 50+ relationships
     - Sample ODCS, ODPS, BPMN, DMN files

---

## Documentation Requirements

1. **API Documentation**:
   - Rustdoc comments for all public methods
   - Usage examples for each method

2. **Schema Documentation**:
   - Full workspace/v2 YAML schema specification
   - Migration guide from v1 to v2

3. **Git Hook Setup Guide**:
   - How to install hooks
   - How to customize hook behavior
   - Troubleshooting common issues

---

## Open Questions

1. **Incremental Sync**: Should we support incremental updates (only changed files) or always full rebuild?
   - **Proposal**: Start with full rebuild, add incremental later if needed

2. **Conflict Resolution**: How should we handle merge conflicts in YAML files?
   - **Proposal**: Git handles conflicts, rebuild after resolution

3. **Multi-Workspace Support**: Should one DuckDB file support multiple workspaces?
   - **Proposal**: One DuckDB per workspace (simpler, aligns with Git repos)

4. **Compression**: Should we compress DuckDB files?
   - **Proposal**: Not initially, but DuckDB supports compression natively

5. **Schema Evolution**: How do we handle schema migrations (v2 → v3)?
   - **Proposal**: SDK provides migration functions, app checks version

---

## Success Criteria

- [ ] All SDK methods implemented and tested
- [ ] Import/export workflows handle 10,000+ entities in < 20s
- [ ] Full test coverage (unit + integration)
- [ ] Documentation complete (API + schema + guides)
- [ ] Sample workspace provided
- [ ] CLI tool functional
- [ ] Git hook templates provided
- [ ] Migration tool from v1 to v2 works correctly

---

## Timeline Estimate

- **Week 1-2**: Schema design, API design, Rust project setup
- **Week 3-4**: Implement workspace parsing, file scanning, validation
- **Week 5-6**: Implement DuckDB import/export logic
- **Week 7-8**: Implement rebuild, caching, hash checking
- **Week 9**: CLI tool and Git hooks
- **Week 10**: Migration tool (v1 → v2)
- **Week 11-12**: Testing, documentation, samples

**Total**: ~12 weeks for full implementation

---

## Contact

For questions or clarifications, please contact the Data Modelling Application Team.

**Related Planning Document**: `/Users/mark/.claude/plans/rustling-cuddling-coral.md`
