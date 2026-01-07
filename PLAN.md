# SDK 1.13.1 Upgrade Plan

## Executive Summary

This document outlines the comprehensive plan for upgrading the Open Data Modelling application from SDK 1.8.4 to SDK 1.13.1. The upgrade introduces three major feature areas:

1. **DuckDB Storage Backend** - High-performance embedded database replacing file-based array operations
2. **MADR Decision Logs** - Architecture Decision Records with full lifecycle management
3. **Knowledge Base System** - Domain documentation and knowledge article management

## Current State Analysis

### Application Overview
- **Package**: `open-data-modelling` v1.1.2
- **Current SDK Version**: 1.8.4 (WASM)
- **Architecture**: React + TypeScript + Electron (offline-first)
- **Storage**: File-based YAML with IndexedDB caching (browser) / Direct filesystem (Electron)

### Current SDK Integration Points
| Service | Location | Current SDK Methods |
|---------|----------|---------------------|
| odcsService | `services/sdk/odcsService.ts` | `parse_odcs_yaml`, `export_to_odcs_yaml` |
| odpsService | `services/sdk/odpsService.ts` | `parse_odps_yaml`, `export_to_odps_yaml` |
| cadsService | `services/sdk/cadsService.ts` | `parse_cads_yaml`, `export_to_cads_yaml` |
| bpmnService | `services/sdk/bpmnService.ts` | `parse_bpmn_xml`, `export_to_bpmn_xml`, `validate_bpmn_xml` |
| dmnService | `services/sdk/dmnService.ts` | `parse_dmn_xml`, `export_to_dmn_xml`, `validate_dmn_xml` |
| openapiService | `services/sdk/openapiService.ts` | `parse_openapi`, `export_openapi`, `openapi_to_odcs` |
| importExportService | `services/sdk/importExportService.ts` | SQL/AVRO/Protobuf/JSON Schema methods |
| filterService | `services/sdk/filterService.ts` | `filter_by_tags`, `filter_nodes_by_*` methods |
| sdkLoader | `services/sdk/sdkLoader.ts` | Module initialization and version detection |

### Performance Bottlenecks (Addressed by DuckDB)
- O(n) array operations for finding/filtering entities
- Relationship graph traversal becomes prohibitive at scale (10s+ for 10,000 tables)
- Tag-based filtering scans full arrays
- Complex folder hierarchy requiring recursive directory traversal

---

## New Features in SDK 1.13.1

### 1. DuckDB Storage Backend

#### Overview
The DuckDB integration provides an embedded analytical database offering 10-100x performance improvement over file-based operations for large workspaces.

#### Key Components
- **DatabaseBackend trait** - Unified interface for database operations
- **DuckDBBackend** - Embedded analytical database implementation
- **SyncEngine** - Bidirectional YAML ↔ Database synchronization
- **DatabaseConfig** - Configuration via `.data-model.toml`

#### New SDK Methods
```typescript
// Database operations (via CLI/Electron IPC)
db_init(workspace_path: string): Promise<void>
db_sync(workspace_path: string): Promise<SyncResult>
db_status(workspace_path: string): Promise<DatabaseStatus>
db_export(workspace_path: string): Promise<ExportResult>
query(sql: string): Promise<QueryResult>
```

#### Configuration
```toml
# .data-model.toml
[database]
backend = "duckdb"
path = ".data-model.duckdb"

[sync]
auto_sync = true
watch = false

[git]
hooks_enabled = true
```

#### Database Schema
- Core tables: `workspaces`, `domains`, `systems`, `tables`, `columns`, `relationships`
- Resource tables: `products`, `compute_assets`, `bpmn_processes`, `dmn_decisions`
- Normalized `tags` table for efficient filtering
- `sync_metadata` for file change tracking

### 2. MADR Decision Logs

#### Overview
Architecture Decision Records (ADRs) following the MADR format with full lifecycle management.

#### Data Models
```typescript
interface Decision {
  id: string;
  number: number;
  title: string;
  status: DecisionStatus;
  category: DecisionCategory;
  context: string;
  decision: string;
  consequences: string;
  options: DecisionOption[];
  domain_id?: string;
  created_at: string;
  updated_at: string;
  superseded_by?: string;
  tags: Tag[];
}

enum DecisionStatus {
  Draft = 'draft',
  Proposed = 'proposed',
  Accepted = 'accepted',
  Deprecated = 'deprecated',
  Superseded = 'superseded',
  Rejected = 'rejected'
}

enum DecisionCategory {
  Architecture = 'architecture',
  Technology = 'technology',
  Process = 'process',
  Security = 'security',
  Data = 'data',
  Integration = 'integration'
}

interface DecisionOption {
  title: string;
  description: string;
  pros: string[];
  cons: string[];
}
```

#### New SDK Methods
```typescript
// Decision loading
load_decisions(): Promise<Decision[]>
load_decision_index(): Promise<DecisionIndex>
load_decisions_by_domain(domain_id: string): Promise<Decision[]>

// Decision saving
save_decision(decision: Decision): Promise<void>
save_decision_index(index: DecisionIndex): Promise<void>
export_decision_markdown(decision_id: string): Promise<string>
```

#### File Structure
```
decisions/
├── index.yaml           # Decision index with metadata
├── 0001-use-duckdb.yaml # Individual decision files
├── 0002-adopt-madr.yaml
└── ...
decisions-md/
├── 0001-use-duckdb.md   # Auto-generated markdown
└── ...
```

### 3. Knowledge Base System

#### Overview
Domain documentation system for guides, references, tutorials, and runbooks.

#### Data Models
```typescript
interface KnowledgeArticle {
  id: string;
  number: number;
  title: string;
  type: ArticleType;
  status: ArticleStatus;
  summary: string;
  content: string;
  domain_id?: string;
  authors: string[];
  reviewers: string[];
  created_at: string;
  updated_at: string;
  published_at?: string;
  tags: Tag[];
}

enum ArticleType {
  Guide = 'guide',
  Reference = 'reference',
  Concept = 'concept',
  Tutorial = 'tutorial',
  Troubleshooting = 'troubleshooting',
  Runbook = 'runbook'
}

enum ArticleStatus {
  Draft = 'draft',
  Review = 'review',
  Published = 'published',
  Archived = 'archived',
  Deprecated = 'deprecated'
}
```

#### New SDK Methods
```typescript
// Knowledge loading
load_knowledge(): Promise<KnowledgeArticle[]>
load_knowledge_index(): Promise<KnowledgeIndex>
load_knowledge_by_domain(domain_id: string): Promise<KnowledgeArticle[]>

// Knowledge saving
save_knowledge(article: KnowledgeArticle): Promise<void>
save_knowledge_index(index: KnowledgeIndex): Promise<void>
export_knowledge_markdown(article_id: string): Promise<string>

// Search
search_knowledge(query: string): Promise<KnowledgeArticle[]>
```

#### File Structure
```
knowledge/
├── index.yaml              # Knowledge index
├── 0001-data-governance.yaml
├── 0002-odcs-best-practices.yaml
└── ...
knowledge-md/
├── 0001-data-governance.md  # Auto-generated markdown
└── ...
```

### 4. Additional SDK Enhancements

#### Enhanced CADS Assets
```typescript
interface CADSAsset {
  // ... existing fields ...
  bpmn_models: CADSBPMNModel[];      // Cross-model BPMN references
  dmn_models: CADSDMNModel[];         // Cross-model DMN references
  openapi_specs: CADSOpenAPISpec[];   // Cross-model OpenAPI references
}
```

#### Enhanced Relationships
```typescript
interface Relationship {
  // ... existing fields ...
  color?: string;           // UI display color
  drawio_edge_id?: string;  // Diagram integration
}
```

#### Workspace Model Updates
```typescript
interface Workspace {
  // ... existing fields ...
  relationships: Relationship[];  // Embedded in workspace (no separate file)
}
```

#### Domain-Based File Organization
New flat file naming convention:
```
{workspace}_{domain}_{system}_{resource}.{type}.yaml
```

---

## Implementation Phases

### Phase 1: Foundation (Weeks 1-2)

#### 1.1 SDK Update
- Update WASM SDK to 1.13.1
- Update `sdkLoader.ts` with new method detection
- Add new SDK methods to interface definitions
- Verify all existing functionality continues to work

#### 1.2 Type System Updates
- Add Decision and DecisionOption types
- Add KnowledgeArticle types
- Add DecisionStatus and ArticleStatus enums
- Add DecisionCategory and ArticleType enums
- Update Relationship type with new fields
- Update CADSAsset type with cross-model references
- Add DatabaseConfig types

#### 1.3 Configuration System
- Add `.data-model.toml` configuration support
- Create configuration types and validation
- Add configuration UI in Settings component

### Phase 2: DuckDB Integration (Weeks 3-5)

#### 2.1 Database Service Layer
- Create `databaseService.ts` for database operations
- Implement database initialization
- Implement sync operations
- Implement query interface
- Add database status monitoring

#### 2.2 Storage Layer Updates
- Update `electronFileService.ts` with DuckDB support
- Add database-first loading option
- Implement fallback to YAML when database unavailable
- Add sync metadata tracking

#### 2.3 Performance Optimizations
- Replace array-based filtering with database queries
- Implement indexed lookups for IDs
- Optimize relationship graph queries
- Add query caching layer

#### 2.4 Git Hook Integration (Electron Only)
- Implement pre-commit hook (database → YAML export)
- Implement post-checkout hook (YAML → database sync)
- Add hook configuration UI

### Phase 3: Decision Logs (Weeks 6-7)

#### 3.1 Decision Service
- Create `decisionService.ts` for CRUD operations
- Implement decision loading/saving
- Implement index management
- Add markdown export functionality

#### 3.2 Decision Store
- Create `decisionStore.ts` Zustand store
- Add decision state management
- Implement filtering by domain/status/category

#### 3.3 Decision UI Components
- Create `DecisionList.tsx` component
- Create `DecisionEditor.tsx` component
- Create `DecisionViewer.tsx` component
- Add decision tab to domain view
- Implement status workflow UI

### Phase 4: Knowledge Base (Weeks 8-9)

#### 4.1 Knowledge Service
- Create `knowledgeService.ts` for CRUD operations
- Implement article loading/saving
- Implement index management
- Add markdown export functionality
- Implement search functionality

#### 4.2 Knowledge Store
- Create `knowledgeStore.ts` Zustand store
- Add article state management
- Implement filtering by domain/type/status

#### 4.3 Knowledge UI Components
- Create `KnowledgeList.tsx` component
- Create `ArticleEditor.tsx` component
- Create `ArticleViewer.tsx` component
- Create `KnowledgeSearch.tsx` component
- Add knowledge tab to domain view

### Phase 5: Integration & Polish (Weeks 10-11)

#### 5.1 Cross-Feature Integration
- Link decisions to domains
- Link knowledge articles to domains
- Cross-reference between decisions and knowledge
- CADS asset cross-model linking UI

#### 5.2 Workspace V2 Migration
- Implement V1 → V2 format migration
- Add migration wizard UI
- Ensure backward compatibility

#### 5.3 Enhanced Relationship Features
- Add color picker for relationships
- Implement DrawIO edge ID integration
- Update canvas rendering

### Phase 6: Testing & Documentation (Week 12)

#### 6.1 Test Coverage
- Unit tests for all new services
- Integration tests for database operations
- E2E tests for decision/knowledge workflows
- Maintain 95% coverage threshold

#### 6.2 Documentation
- Update README with new features
- Document configuration options
- Create user guides for decision logs
- Create user guides for knowledge base

---

## Migration Strategy

### Backward Compatibility
- SDK 1.13.1 supports legacy `tables/` directory structure
- Existing workspaces continue to work without changes
- New features are opt-in

### Upgrade Path
1. **Update SDK WASM files** - Replace `public/wasm/` contents
2. **Update TypeScript types** - Add new type definitions
3. **Enable DuckDB** (optional) - Create `.data-model.toml` configuration
4. **Create decision/knowledge directories** (optional) - Enable new features

### Data Migration
- No automatic migration required
- Users can opt-in to DuckDB by adding configuration
- Workspace V2 migration available via wizard

---

## Risk Assessment

### Technical Risks
| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| WASM size increase | Slower initial load | Medium | Lazy-load DuckDB features, code splitting |
| DuckDB memory limits | Large workspace issues | Low | 4GB WASM limit; monitor usage, warn users |
| Breaking API changes | App crashes | Low | Comprehensive version checking |
| Performance regression | User experience degradation | Low | Extensive benchmarking |

### DuckDB Browser Support (Updated)
DuckDB WASM is production-ready for browser use:
- **Current Version**: 1.4.3 (stable)
- **Browser Support**: Chrome, Firefox, Safari, Node.js
- **Features**: In-process SQL, Arrow support, Parquet/CSV/JSON file reading

**Constraints to consider:**
- Single-threaded by default in browser (acceptable for our use case)
- Memory limited to 4GB in WASM (browsers may impose stricter limits)
- For very large workspaces (10,000+ tables), monitor memory usage

**Conclusion**: DuckDB WASM can be used in both Electron AND browser builds. No feature restriction needed.

### Mitigation Strategies
1. **Feature flags** - Gate new features behind configuration
2. **Fallback mechanisms** - YAML fallback when DuckDB unavailable
3. **Version detection** - Graceful degradation for older SDK
4. **Incremental rollout** - Phase features separately
5. **Memory monitoring** - Track DuckDB memory usage in browser, warn if approaching limits

---

## Success Criteria

### Performance Targets
- ID lookup: <1ms (vs 1ms+ currently for 10k tables)
- Domain filtering: <10ms
- Tag search: <50ms
- Import 1,000 tables: <1 second
- Export 1,000 tables: <2 seconds

### Quality Targets
- Test coverage: 95%+ maintained
- Zero regressions in existing functionality
- TypeScript strict mode compliance
- ESLint warnings: <110

### User Experience
- Seamless upgrade for existing users
- Intuitive decision log interface
- Searchable knowledge base
- Clear configuration options

---

## Dependencies

### SDK Requirements
- SDK version 1.13.1 with WASM feature
- DuckDB backend feature enabled (for database support)

### Frontend Dependencies (No Changes)
- React 18.2.0
- Zustand 5.0.9
- TypeScript 5.9.3
- Vite 7.3.0

### New Development Dependencies
- None required (all functionality via WASM SDK)

---

## Timeline Summary

| Phase | Duration | Key Deliverables |
|-------|----------|------------------|
| 1. Foundation | 2 weeks | SDK update, types, config |
| 2. DuckDB | 3 weeks | Database service, storage updates, optimization |
| 3. Decision Logs | 2 weeks | Service, store, UI components |
| 4. Knowledge Base | 2 weeks | Service, store, UI components |
| 5. Integration | 2 weeks | Cross-feature integration, migration |
| 6. Testing | 1 week | Tests, documentation |
| **Total** | **12 weeks** | Full SDK 1.13.1 integration |

---

## Appendix A: New File Structure

### New Service Files
```
frontend/src/services/
├── sdk/
│   ├── decisionService.ts       # NEW: Decision CRUD
│   ├── knowledgeService.ts      # NEW: Knowledge CRUD
│   └── databaseService.ts       # NEW: DuckDB operations
└── storage/
    └── databaseConfig.ts        # NEW: Config management
```

### New Store Files
```
frontend/src/stores/
├── decisionStore.ts             # NEW: Decision state
└── knowledgeStore.ts            # NEW: Knowledge state
```

### New Component Files
```
frontend/src/components/
├── decision/
│   ├── DecisionList.tsx         # NEW
│   ├── DecisionEditor.tsx       # NEW
│   ├── DecisionViewer.tsx       # NEW
│   └── DecisionStatusBadge.tsx  # NEW
└── knowledge/
    ├── KnowledgeList.tsx        # NEW
    ├── ArticleEditor.tsx        # NEW
    ├── ArticleViewer.tsx        # NEW
    └── KnowledgeSearch.tsx      # NEW
```

### New Type Files
```
frontend/src/types/
├── decision.ts                  # NEW: Decision types
├── knowledge.ts                 # NEW: Knowledge types
└── database.ts                  # NEW: Database config types
```

## Appendix B: SDK Method Mapping

### New Methods to Implement in Frontend

| SDK Method | Frontend Service | Purpose |
|------------|-----------------|---------|
| `load_decisions` | decisionService | Load all decisions |
| `load_decision_index` | decisionService | Load decision index |
| `save_decision` | decisionService | Save decision |
| `export_decision_markdown` | decisionService | Generate markdown |
| `load_knowledge` | knowledgeService | Load all articles |
| `load_knowledge_index` | knowledgeService | Load knowledge index |
| `save_knowledge` | knowledgeService | Save article |
| `search_knowledge` | knowledgeService | Search articles |
| `export_knowledge_markdown` | knowledgeService | Generate markdown |
| `db_init` | databaseService | Initialize DuckDB |
| `db_sync` | databaseService | Sync YAML to DB |
| `db_status` | databaseService | Check DB health |
| `db_export` | databaseService | Export DB to YAML |
| `query` | databaseService | Execute SQL query |

## Appendix C: Configuration Schema

### .data-model.toml
```toml
[database]
# Storage backend: "duckdb" | "postgres" | "none"
backend = "duckdb"

# Path to DuckDB file (relative to workspace)
path = ".data-model.duckdb"

[postgres]
# PostgreSQL connection (if backend = "postgres")
connection_string = "postgresql://user:pass@localhost/db"
pool_size = 5

[sync]
# Automatically sync YAML to database on load
auto_sync = true

# Watch for file changes and auto-sync
watch = false

[git]
# Enable Git hooks for automatic sync
hooks_enabled = true
```
