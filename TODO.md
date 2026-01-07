# SDK 1.13.1 Upgrade - Implementation Tasks

This document contains all implementation tasks for upgrading to SDK 1.13.1.
Tasks are organized by phase and priority.

---

## Phase 1: Foundation

### 1.1 SDK Update

- [x] **P1-001**: Update SDK version to 1.13.1 ✅
  - File: `frontend/scripts/build-wasm.sh`
  - Updated SDK_VERSION from "1.11.0" to "1.13.1"
  - Script downloads from GitHub releases automatically via `npm run build:wasm`

- [x] **P1-002**: Update SDK interface in `sdkLoader.ts` ✅
  - File: `frontend/src/services/sdk/sdkLoader.ts`
  - Add new method signatures for SDK 1.13.1:
    - Decision methods: `load_decisions`, `save_decision`, `export_decision_markdown`
    - Knowledge methods: `load_knowledge`, `save_knowledge`, `search_knowledge`, `export_knowledge_markdown`
    - Database methods: `db_init`, `db_sync`, `db_status`, `db_export`, `query`
  - Update version detection logic for 1.13.1

- [x] **P1-003**: Update SDK version verification ✅
  - File: `frontend/src/services/sdk/sdkLoader.ts`
  - Add `verifySDK113Bindings()` method
  - Add graceful degradation for missing 1.13.1 features
  - Update console logging for new version
  - Added `hasDecisionSupport()`, `hasKnowledgeSupport()`, `hasDatabaseSupport()` methods

### 1.2 Type System Updates

- [x] **P1-004**: Create Decision types ✅
  - File: `frontend/src/types/decision.ts` (NEW)
  - Types created:
    - `Decision`, `DecisionOption`, `DecisionStatus` (enum), `DecisionCategory` (enum)
    - `DecisionIndex`, `DecisionIndexEntry`, `DecisionFilter`
    - `Tag` type (Simple, Pair, List formats)
    - Helper functions: `isValidStatusTransition`, `getDecisionStatusLabel`, etc.

- [x] **P1-005**: Create Knowledge types ✅
  - File: `frontend/src/types/knowledge.ts` (NEW)
  - Types created:
    - `KnowledgeArticle`, `ArticleType` (enum), `ArticleStatus` (enum)
    - `KnowledgeIndex`, `KnowledgeIndexEntry`, `KnowledgeFilter`
    - `KnowledgeSearchResult`
    - Helper functions: `isValidArticleStatusTransition`, `getArticleTypeLabel`, etc.

- [x] **P1-006**: Create Database config types ✅
  - File: `frontend/src/types/database.ts` (NEW)
  - Types created:
    - `DatabaseConfig`, `DatabaseBackend` (enum), `PostgresConfig`
    - `SyncConfig`, `GitHooksConfig`, `DatabaseStatus`, `DatabaseMetrics`
    - `SyncResult`, `SyncError`, `ExportResult`, `ExportError`
    - `QueryResult`, `FileSyncMetadata`, `SyncConflict`
    - `ConnectionStatus` (enum), `SyncStatus` (enum)
    - Helper functions: `validateDatabaseConfig`, `isDatabaseEnabled`, etc.

- [x] **P1-007**: Update Relationship type ✅
  - File: `frontend/src/types/relationship.ts`
  - Added: `drawio_edge_id?: string` (color was already present)

- [x] **P1-008**: Update CADSAsset type ✅
  - File: `frontend/src/types/cads.ts`
  - Updated to use enhanced `Tag` type from decision.ts
  - Cross-model reference fields were already present

- [x] **P1-009**: Update types index ✅
  - No index.ts file exists - types are imported directly from their files
  - This is the existing pattern in the codebase

### 1.3 Configuration System

- [x] **P1-010**: Create database configuration service ✅
  - File: `frontend/src/services/storage/databaseConfigService.ts` (NEW)
  - Implemented:
    - `loadConfig()`, `saveConfig()`, `getDefaultConfig()`
    - `updateConfig()`, `configExists()`, `createDefaultConfig()`
    - Cache management with `clearCache()`, `clearWorkspaceCache()`

- [x] **P1-011**: Add configuration parsing ✅
  - File: `frontend/src/services/storage/databaseConfigService.ts`
  - Implemented custom TOML parser for `.data-model.toml`
  - Handles all config sections: database, postgres, sync, git
  - Serializes back to TOML format

- [x] **P1-012**: Create configuration UI component ✅
  - File: `frontend/src/components/settings/DatabaseSettings.tsx` (NEW)
  - Implemented:
    - Backend selector (DuckDB/PostgreSQL/None)
    - DuckDB path input, PostgreSQL connection settings
    - Sync settings (auto-sync, watch, sync-on-save, conflict strategy)
    - Git hooks settings (pre-commit, post-checkout, post-merge)
    - SDK 1.13.1+ feature detection with warning banner

- [x] **P1-013**: Integrate settings into Settings page ✅
  - File: `frontend/src/components/workspace/WorkspaceSettings.tsx`
  - Added DatabaseSettings component
  - Added AutoSaveSettings component
  - Settings shown when workspace has a folder path

---

## Phase 2: DuckDB Integration

### 2.1 Database Service Layer

- [x] **P2-001**: Create database service ✅
  - File: `frontend/src/services/sdk/databaseService.ts` (NEW)
  - Implemented all core functions:
    - `initializeDatabase()`, `syncToDatabase()`, `getDatabaseStatus()`
    - `exportToYaml()`, `executeQuery()`, `autoInitialize()`
    - Feature detection with `isSupported()`

- [x] **P2-002**: Implement database initialization ✅
  - Implemented in `databaseService.ts`
  - Calls SDK `db_init` with config JSON
  - Tracks initialization state per workspace

- [x] **P2-003**: Implement sync operations ✅
  - Implemented `syncToDatabase()` 
  - Returns full `SyncResult` with metrics
  - Error handling with detailed error objects

- [x] **P2-004**: Implement export operations ✅
  - Implemented `exportToYaml()`
  - Returns `ExportResult` with file counts

- [x] **P2-005**: Add database status monitoring ✅
  - Implemented `getDatabaseStatus()`
  - Returns connection status, sync status, metrics
  - Graceful handling when SDK not available

### 2.2 Storage Layer Updates

- [x] **P2-006**: Update electronFileService for DuckDB ✅
  - File: `frontend/src/services/storage/electronFileService.ts`
  - Added `useDatabaseBackend` flag
  - Added `shouldUseDatabaseBackend()` method
  - Implemented database-first loading methods
  - Added `syncToDatabase()` method
  - Fallback to YAML when database unavailable

- [x] **P2-007**: Create database storage adapter ✅
  - File: `frontend/src/services/storage/databaseStorage.ts` (NEW)
  - Implemented O(1) lookups for all entity types
  - Table, domain, relationship, system, compute asset loading
  - LRU cache for query results
  - Matches existing storage interface

- [x] **P2-008**: Add sync metadata tracking ✅
  - File: `frontend/src/services/storage/databaseStorage.ts`
  - Track file hashes with `FileSyncMetadata`
  - Track last sync times
  - `isOutOfSync()`, `getOutOfSyncFiles()` methods
  - `markAsSynced()`, `markAsModified()` methods

- [x] **P2-009**: Implement hybrid loading strategy ✅
  - File: `frontend/src/services/storage/electronFileService.ts`
  - `shouldUseDatabaseBackend()` checks availability
  - Database-first loading with YAML fallback
  - Auto-initialization when configured
  - Log loading source for debugging

### 2.3 Performance Optimizations

- [x] **P2-010**: Replace array filtering with database queries ✅
  - File: `frontend/src/services/sdk/filterService.ts`
  - Added `filterTablesByTagsFromDatabase()` using database queries
  - Added `filterAssetsByTagsFromDatabase()` for compute assets
  - Added `filterTablesByOwnerFromDatabase()` for owner filtering
  - Added `filterByTagsHybrid()` - tries database first, falls back to client-side

- [x] **P2-011**: Implement indexed lookups ✅
  - File: `frontend/src/services/storage/databaseStorage.ts`
  - `getTableById(id: string)` - O(1) lookup with cache
  - `getDomainById(id: string)` - O(1) lookup with cache
  - `getRelationshipById(id: string)` - O(1) lookup with cache
  - `getSystemById(id: string)` - O(1) lookup with cache
  - `getComputeAssetById(id: string)` - O(1) lookup with cache

- [x] **P2-012**: Optimize relationship graph queries ✅
  - File: `frontend/src/services/storage/databaseStorage.ts`
  - Implemented `getRelationshipsForTable(tableId: string)`
  - Implemented `getRelatedTables(tableId: string, depth: number)`
  - Uses recursive CTE for deep graph traversal
  - Efficient database JOINs

- [x] **P2-013**: Add query result caching ✅
  - File: `frontend/src/services/storage/databaseStorage.ts`
  - LRU cache with configurable size (default 100)
  - TTL-based expiration (default 30 seconds)
  - `invalidateCache()` for cache management
  - `getCacheStats()` for monitoring

### 2.4 Git Hook Integration (Electron Only)

- [x] **P2-014**: Implement pre-commit hook ✅
  - File: `frontend/src/services/storage/gitHooks.ts` (NEW)
  - `PRE_COMMIT_HOOK` template exports database to YAML
  - `executePreCommit()` for programmatic execution
  - Integration with databaseService.exportToYaml()

- [x] **P2-015**: Implement post-checkout hook ✅
  - File: `frontend/src/services/storage/gitHooks.ts`
  - `POST_CHECKOUT_HOOK` template syncs YAML to database
  - `executePostSync()` for programmatic execution
  - Only runs on branch checkout (not file checkout)

- [x] **P2-016**: Create hook installation utility ✅
  - File: `frontend/src/services/storage/gitHooks.ts`
  - `installHook()` installs individual hooks
  - `uninstallHook()` removes hooks
  - `installAllHooks()` / `uninstallAllHooks()` for batch operations
  - Handles existing hooks by appending

- [x] **P2-017**: Add hook configuration UI ✅
  - File: `frontend/src/components/settings/GitHooksSettings.tsx` (NEW)
  - Hook status display with install/uninstall buttons
  - Install All / Uninstall All buttons
  - Shows git availability and hooks path
  - Conflict detection for existing hooks

---

## Phase 3: Decision Logs

### 3.1 Decision Service

- [x] **P3-001**: Create decision service ✅
  - File: `frontend/src/services/sdk/decisionService.ts` (NEW)
  - Implemented all CRUD functions plus filtering and export

- [x] **P3-002**: Implement decision index management ✅
  - `loadDecisionIndex()`, `saveDecisionIndex()`
  - Auto-numbering for new decisions
  - Index updates on create/update

- [x] **P3-003**: Implement domain filtering ✅
  - `loadDecisionsByDomain()`, `filterDecisions()`
  - Status and category filtering
  - Search functionality

- [x] **P3-004**: Implement markdown export ✅
  - `exportToMarkdown()` with SDK fallback
  - Client-side MADR format generation

- [x] **P3-005**: Implement decision status transitions ✅
  - `changeStatus()` with validation
  - Supersede functionality with bidirectional linking
  - Decided timestamp tracking

### 3.2 Decision Store

- [x] **P3-006**: Create decision Zustand store ✅
  - File: `frontend/src/stores/decisionStore.ts` (NEW)
  - Full state management with persistence

- [x] **P3-007**: Implement store actions ✅
  - All CRUD actions implemented
  - `loadDecisions`, `createDecision`, `updateDecision`
  - `changeDecisionStatus`, `exportToMarkdown`

- [x] **P3-008**: Implement store selectors ✅
  - `getDecisionById`, `getDecisionsByStatus`
  - `getDecisionsByCategory`, `getDecisionsByDomain`
  - Convenience methods for common filters

- [x] **P3-009**: Add persistence ✅
  - Zustand persist middleware
  - Persists selected decision ID and filter
  - Auto-updates filtered list on changes

### 3.3 Decision UI Components

- [x] **P3-010**: Create DecisionList component ✅
  - File: `frontend/src/components/decision/DecisionList.tsx` (NEW)
  - Features:
    - List all decisions with status badges
    - Filter by status/category
    - Sort by number/date
    - Click to select

- [x] **P3-011**: Create DecisionEditor component ✅
  - File: `frontend/src/components/decision/DecisionEditor.tsx` (NEW)
  - Features:
    - Title and context editing
    - Decision text (markdown support)
    - Consequences section
    - Options management (add/remove/edit)
    - Category and status selection
    - Domain assignment

- [x] **P3-012**: Create DecisionViewer component ✅
  - File: `frontend/src/components/decision/DecisionViewer.tsx` (NEW)
  - Features:
    - Rendered markdown display
    - Status badge
    - Category badge
    - Options pros/cons display
    - Superseded-by link
    - Export to markdown button

- [x] **P3-013**: Create DecisionStatusBadge component ✅
  - File: `frontend/src/components/decision/DecisionStatusBadge.tsx` (NEW)
  - Color-coded status display
  - Status icons
  - Tooltip with status description

- [x] **P3-014**: Create DecisionOptionEditor component ✅
  - File: `frontend/src/components/decision/DecisionOptionEditor.tsx` (NEW)
  - Option title/description editing
  - Pros list management
  - Cons list management

- [x] **P3-015**: Add decision view to ViewSelector ✅
  - File: `frontend/src/components/domain/ViewSelector.tsx`
  - Added "Decisions" view mode
  - File: `frontend/src/stores/modelStore.ts`
  - Added 'decisions' to ViewMode type
  - File: `frontend/src/pages/ModelEditor.tsx`
  - Integrated DecisionPanel for decisions view
  - File: `frontend/src/components/decision/DecisionPanel.tsx` (NEW)
  - Main panel with list/view/edit modes

- [x] **P3-016**: Create decision status workflow UI ✅
  - File: `frontend/src/components/decision/DecisionWorkflow.tsx` (NEW)
  - Visual status progression
  - One-click status transitions
  - Supersede action

---

## Phase 4: Knowledge Base

### 4.1 Knowledge Service

- [x] **P4-001**: Create knowledge service ✅
  - File: `frontend/src/services/sdk/knowledgeService.ts` (NEW)
  - All CRUD functions implemented

- [x] **P4-002**: Implement knowledge index management ✅
  - `loadKnowledgeIndex()`, `saveKnowledgeIndex()`
  - Auto-numbering, index updates on create/update

- [x] **P4-003**: Implement domain filtering ✅
  - `loadKnowledgeByDomain()`, `filterKnowledge()`
  - Type and status filtering

- [x] **P4-004**: Implement search functionality ✅
  - `searchKnowledge()` with SDK and client-side fallback
  - Relevance scoring, result highlighting

- [x] **P4-005**: Implement markdown export ✅
  - `exportToMarkdown()` with SDK fallback
  - Client-side markdown generation

- [x] **P4-006**: Implement article status transitions ✅
  - `changeStatus()` with validation
  - Timestamp tracking for publish/review/archive

### 4.2 Knowledge Store

- [x] **P4-007**: Create knowledge Zustand store ✅
  - File: `frontend/src/stores/knowledgeStore.ts` (NEW)
  - Full state management with search support

- [x] **P4-008**: Implement store actions ✅
  - All CRUD actions plus search
  - `loadKnowledge`, `createArticle`, `updateArticle`
  - `changeArticleStatus`, `search`, `exportToMarkdown`

- [x] **P4-009**: Implement store selectors ✅
  - `getArticleById`, `getArticlesByType`
  - `getArticlesByStatus`, `getArticlesByDomain`
  - `getPublishedArticles`, `getDraftArticles`

- [x] **P4-010**: Add persistence ✅
  - Zustand persist middleware
  - Persists selected article ID, filter, search query

### 4.3 Knowledge UI Components

- [x] **P4-011**: Create KnowledgeList component ✅
  - File: `frontend/src/components/knowledge/KnowledgeList.tsx` (NEW)
  - Features:
    - List all articles with type/status badges
    - Filter by type/status
    - Sort by number/date/title
    - Click to select

- [x] **P4-012**: Create ArticleEditor component ✅
  - File: `frontend/src/components/knowledge/ArticleEditor.tsx` (NEW)
  - Features:
    - Title and summary editing
    - Content editing (markdown)
    - Type and status selection
    - Domain assignment
    - Authors/reviewers management
    - Tag management

- [x] **P4-013**: Create ArticleViewer component ✅
  - File: `frontend/src/components/knowledge/ArticleViewer.tsx` (NEW)
  - Features:
    - Rendered markdown display
    - Type/status badges
    - Author/reviewer display
    - Published date
    - Export to markdown button

- [x] **P4-014**: Create KnowledgeSearch component ✅
  - File: `frontend/src/components/knowledge/KnowledgeSearch.tsx` (NEW)
  - Features:
    - Search input with debounce
    - Results list
    - Result highlighting
    - Filter by type/status

- [x] **P4-015**: Create ArticleTypeBadge component ✅
  - File: `frontend/src/components/knowledge/ArticleTypeBadge.tsx` (NEW)
  - Color-coded type display
  - Type icons (Guide, Reference, etc.)

- [x] **P4-016**: Create ArticleStatusBadge component ✅
  - File: `frontend/src/components/knowledge/ArticleStatusBadge.tsx` (NEW)
  - Color-coded status display
  - Status icons

- [x] **P4-017**: Add knowledge view to ViewSelector ✅
  - File: `frontend/src/components/domain/ViewSelector.tsx`
  - Added "Knowledge" view mode
  - File: `frontend/src/stores/modelStore.ts`
  - Added 'knowledge' to ViewMode type
  - File: `frontend/src/pages/ModelEditor.tsx`
  - Integrated KnowledgePanel for knowledge view
  - File: `frontend/src/components/knowledge/KnowledgePanel.tsx` (NEW)
  - Main panel with browse/search, list/view/edit modes

---

## Phase 5: Integration & Polish

### 5.1 Cross-Feature Integration

- [x] **P5-001**: Link decisions to domains ✅
  - File: `frontend/src/components/domain/DomainTabs.tsx`
  - Show decision count in domain tabs (badge with "D" suffix)
  - Domain-scoped decision counts displayed

- [x] **P5-002**: Link knowledge articles to domains ✅
  - File: `frontend/src/components/domain/DomainTabs.tsx`
  - Show article count in domain tabs (badge with "K" suffix)
  - Domain-scoped article counts displayed

- [x] **P5-003**: Cross-reference decisions and knowledge ✅
  - File: `frontend/src/components/decision/DecisionViewer.tsx`
  - Added "Related Knowledge Articles" section
  - Shows KB numbers and titles for articles referencing the decision

- [x] **P5-004**: Cross-reference knowledge and decisions ✅
  - File: `frontend/src/components/knowledge/ArticleViewer.tsx`
  - Enhanced "Related Decisions" section
  - Shows ADR numbers and titles for linked decisions

- [x] **P5-005**: Implement CADS asset cross-model linking UI ✅
  - File: `frontend/src/components/asset/ComputeAssetEditor.tsx`
  - BPMN model selector (BPMNLink component)
  - DMN model selector (DMNLink component)
  - OpenAPI spec selector (OpenAPILink component - NEW)
  - File: `frontend/src/components/asset/OpenAPILink.tsx` (NEW)
  - Display linked models with add/remove functionality

### 5.2 Workspace V2 Migration

> **Note**: Tasks P5-006 through P5-009 are skipped - no V1 implementations exist that require migration.

- [~] **P5-006**: Implement V1 to V2 format detection (SKIPPED)
  - File: `frontend/src/services/storage/workspaceMigration.ts` (NEW)
  - Detect workspace format version
  - Check for migration eligibility

- [~] **P5-007**: Implement V1 to V2 migration logic (SKIPPED)
  - File: `frontend/src/services/storage/workspaceMigration.ts`
  - Convert folder structure to flat files
  - Merge relationships into workspace.yaml
  - Preserve all data

- [~] **P5-008**: Create migration wizard UI (SKIPPED)
  - File: `frontend/src/components/workspace/MigrationWizard.tsx` (NEW)
  - Step-by-step migration guide
  - Preview changes
  - Backup creation
  - Rollback option

- [~] **P5-009**: Ensure backward compatibility (SKIPPED)
  - File: `frontend/src/services/storage/electronFileService.ts`
  - Support both V1 and V2 formats
  - Auto-detect format on load
  - Transparent to user

### 5.3 Enhanced Relationship Features

- [x] **P5-010**: Add color picker for relationships ✅
  - File: `frontend/src/components/relationship/RelationshipEditor.tsx`
  - Color picker with hex input
  - Color preview and reset button
  - Default color option (black)

- [x] **P5-011**: Update canvas edge rendering with colors ✅
  - File: `frontend/src/components/canvas/CardinalityEdge.tsx`
  - Apply relationship color to edges via `lineColor` variable
  - Fallback to default color (black or gray for cross-domain)

- [x] **P5-012**: Implement DrawIO edge ID integration ✅
  - File: `frontend/src/components/relationship/RelationshipEditor.tsx`
  - DrawIO edge ID field with monospace input
  - Load/save `drawio_edge_id` property
  - Integration with relationship updates

---

## Phase 6: Testing & Documentation

### 6.1 Test Coverage

- [ ] **P6-001**: Unit tests for decision service
  - File: `frontend/tests/services/sdk/decisionService.test.ts` (NEW)
  - Test all CRUD operations
  - Test index management
  - Test markdown export
  - Test status transitions

- [ ] **P6-002**: Unit tests for knowledge service
  - File: `frontend/tests/services/sdk/knowledgeService.test.ts` (NEW)
  - Test all CRUD operations
  - Test index management
  - Test search functionality
  - Test markdown export

- [ ] **P6-003**: Unit tests for database service
  - File: `frontend/tests/services/sdk/databaseService.test.ts` (NEW)
  - Test initialization
  - Test sync operations
  - Test query execution
  - Test error handling

- [ ] **P6-004**: Unit tests for decision store
  - File: `frontend/tests/stores/decisionStore.test.ts` (NEW)
  - Test all actions
  - Test selectors
  - Test persistence

- [ ] **P6-005**: Unit tests for knowledge store
  - File: `frontend/tests/stores/knowledgeStore.test.ts` (NEW)
  - Test all actions
  - Test selectors
  - Test search

- [ ] **P6-006**: Integration tests for database operations
  - File: `frontend/tests/integration/database.test.ts` (NEW)
  - Test YAML → DB sync
  - Test DB → YAML export
  - Test query performance

- [ ] **P6-007**: Component tests for decision UI
  - File: `frontend/tests/components/decision/` (NEW directory)
  - Test DecisionList
  - Test DecisionEditor
  - Test DecisionViewer
  - Test status workflow

- [ ] **P6-008**: Component tests for knowledge UI
  - File: `frontend/tests/components/knowledge/` (NEW directory)
  - Test KnowledgeList
  - Test ArticleEditor
  - Test ArticleViewer
  - Test KnowledgeSearch

- [ ] **P6-009**: E2E tests for decision workflows
  - File: `frontend/tests/e2e/decisions.spec.ts` (NEW)
  - Create decision flow
  - Edit decision flow
  - Status transition flow
  - Markdown export flow

- [ ] **P6-010**: E2E tests for knowledge workflows
  - File: `frontend/tests/e2e/knowledge.spec.ts` (NEW)
  - Create article flow
  - Edit article flow
  - Search flow
  - Publish flow

- [ ] **P6-011**: Verify 95% coverage maintained
  - Run `npm run test:coverage`
  - Address any coverage gaps
  - Update coverage exclusions if needed

### 6.2 Documentation

- [ ] **P6-012**: Update README with new features
  - File: `frontend/README.md`
  - Document decision log feature
  - Document knowledge base feature
  - Document DuckDB configuration

- [ ] **P6-013**: Document configuration options
  - File: `frontend/docs/CONFIGURATION.md` (NEW)
  - `.data-model.toml` format
  - Database backends
  - Sync options
  - Git hooks

- [ ] **P6-014**: Create decision log user guide
  - File: `frontend/docs/DECISION_LOGS.md` (NEW)
  - What are ADRs/MADR
  - Creating decisions
  - Status workflow
  - Best practices

- [ ] **P6-015**: Create knowledge base user guide
  - File: `frontend/docs/KNOWLEDGE_BASE.md` (NEW)
  - Article types
  - Publishing workflow
  - Search tips
  - Best practices

---

## Task Priority Legend

- **P1-xxx**: Phase 1 - Foundation (Priority: Critical)
- **P2-xxx**: Phase 2 - DuckDB Integration (Priority: High)
- **P3-xxx**: Phase 3 - Decision Logs (Priority: High)
- **P4-xxx**: Phase 4 - Knowledge Base (Priority: Medium)
- **P5-xxx**: Phase 5 - Integration & Polish (Priority: Medium)
- **P6-xxx**: Phase 6 - Testing & Documentation (Priority: High)

---

## Dependencies

### Task Dependencies (must complete before)

| Task | Depends On |
|------|------------|
| P1-002 | P1-001 (SDK files) |
| P1-003 | P1-002 (interface updates) |
| P2-001 | P1-006 (database types) |
| P2-006 | P2-001 (database service) |
| P3-001 | P1-004 (decision types) |
| P3-006 | P3-001 (decision service) |
| P3-010 | P3-006 (decision store) |
| P4-001 | P1-005 (knowledge types) |
| P4-007 | P4-001 (knowledge service) |
| P4-011 | P4-007 (knowledge store) |
| P5-001 | P3-010, P3-015 (decision UI) |
| P5-002 | P4-011, P4-017 (knowledge UI) |
| P6-001 | P3-001 (decision service) |
| P6-002 | P4-001 (knowledge service) |

---

## Estimated Effort

| Phase | Tasks | Estimated Days |
|-------|-------|----------------|
| Phase 1 | 13 | 5-7 days |
| Phase 2 | 17 | 10-12 days |
| Phase 3 | 16 | 7-8 days |
| Phase 4 | 17 | 7-8 days |
| Phase 5 | 12 | 6-7 days |
| Phase 6 | 15 | 5-6 days |
| **Total** | **90** | **40-48 days** |

---

## Acceptance Criteria

### Phase 1 Complete When:
- [ ] SDK 1.13.1 WASM loads successfully
- [ ] All new types are defined and exported
- [ ] Configuration can be saved/loaded
- [ ] No regressions in existing functionality

### Phase 2 Complete When:
- [ ] DuckDB can be initialized for a workspace
- [ ] YAML files sync to database
- [ ] Queries execute successfully
- [ ] Performance improvement measurable (>10x for large datasets)

### Phase 3 Complete When:
- [ ] Decisions can be created, edited, deleted
- [ ] Decision status workflow functions
- [ ] Markdown export works
- [ ] Decision UI is polished and usable

### Phase 4 Complete When:
- [ ] Articles can be created, edited, deleted
- [ ] Search returns relevant results
- [ ] Markdown export works
- [ ] Knowledge UI is polished and usable

### Phase 5 Complete When:
- [ ] Cross-feature links work
- [ ] Migration wizard tested
- [ ] Relationship colors display on canvas

### Phase 6 Complete When:
- [ ] 95% test coverage maintained
- [ ] All E2E tests pass
- [ ] Documentation complete and accurate
