# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.1.3] - 2026-01-08

### Added
- **Bundled Example Workspaces**: Jaffleshop example workspace now appears in the Home page workspace list
  - Complete e-commerce data platform with medallion architecture (bronze/silver/gold)
  - 19 ODCS data contracts, 2 ODPS data products, 3 BPMN processes
  - 3 Knowledge articles, 3 Architecture decision records
  - Examples automatically refresh when a new app version is deployed
- **App Version Injection**: Added `__APP_VERSION__` build-time constant via Vite define

### Changed
- **Workspace Loader**: Added `loadFromStringFiles` method to WorkspaceV2Loader for loading workspaces from pre-loaded string content (used by bundled examples)
- **Project Structure**: Moved Jaffleshop example from `/examples/` to `/frontend/public/examples/` for bundling with the app

## [2.1.2] - 2026-01-08

### Fixed
- **Tags Persistence**: Fixed tags disappearing when canvas redraws by including tags in table data change detection hash
- **V2 Save Format**: Save button now uses V2 flat file format instead of V1 folder-based format
- **SDK Field Naming**: Fixed SDK export_to_odcs_yaml deserialization error by converting snake_case fields to camelCase for SDK compatibility
- **File Deletion on Save**: Deleted resources now properly remove orphaned files from disk during autosave and manual save
- **Security Vulnerabilities**: Updated react-router packages to fix CSRF, XSS, and open redirect vulnerabilities

### Changed
- **SDK Version**: Upgraded to data-modelling-sdk 1.13.5
  - Fixed ODCS `id` field preservation issue where contract UUIDs were lost during `TableData` construction
  - Added ODCS v3.1.0 contract-level field preservation: `id`, `apiVersion`, `version`, `status`, `kind`, `domain`, `dataProduct`, `tenant`, `description`, `servers`, `team`, `support`, `roles`, `slaProperties`, `quality`, `price`, `tags`, `customProperties`, `authoritativeDefinitions`, `contractCreatedTs`, `odcsMetadata`
  - SystemReference now includes optional `table_ids` and `asset_ids` UUID arrays for explicit system mapping
- **Canvas Zoom**: Increased zoom out limit from default to 0.1 (10%) and zoom in limit to 4x on Analytical and Operational Canvas views
- **Relationship Editor**: Relationship Type and Cardinality dropdowns now sync bidirectionally; changing one updates the other automatically
- **Connection Handles**: Added 14 connection points per node (tables, systems, compute assets):
  - 4 corner handles (top-left, top-right, bottom-left, bottom-right)
  - 2 center handles (top-center, bottom-center)
  - 6 side handles (3 on left, 3 on right at 25%, 50%, 75% positions)

## [2.1.1] - 2026-01-08

### Fixed
- **SDK Version**: Upgraded to data-modelling-sdk 1.13.3 for knowledge base and decision record support
- **BPMN Name Extraction**: Improved XML parsing with multiple fallback methods (getElementsByTagNameNS, getElementsByTagName, regex) for reliable process name extraction
- **Knowledge Base Loading**: Added fallback YAML parser for `.kb.yaml` files when SDK methods unavailable
- **Decision Records Loading**: Added fallback YAML parser for `.adr.yaml` files when SDK methods unavailable
- **Workspace Loading**: Fixed knowledge articles and decision records not populating their respective stores when loading workspace from folder

### Added
- **Jaffleshop Example**: Complete example workspace demonstrating:
  - 19 ODCS data contracts across bronze/silver/gold medallion layers
  - 2 ODPS data products
  - 3 BPMN processes (Raw Ingestion, Staging Transform, Mart Build)
  - 3 Knowledge Base articles (Architecture Overview, Data Quality Standards, MetricFlow Guide)
  - 3 Architecture Decision Records (DuckDB Lakehouse, Medallion Architecture, ODCS Contracts)
  - 15 table relationships forming star schema
  - System linking via customProperties metadata
- **Debug Logging**: Added domain ID logging for troubleshooting table/domain associations

## [2.1.0] - 2026-01-08

### Added
- **DuckDB-WASM Integration**: Complete in-browser SQL database with OPFS persistence
  - DuckDB-WASM 1.29.0 (DuckDB 1.4.3) for in-browser SQL queries
  - OPFS (Origin Private File System) for persistent storage
  - Automatic fallback to in-memory mode for unsupported browsers
  - Type-safe query builder with fluent API
  - YAML ↔ DuckDB synchronization engine with hash-based change detection
  - React hooks: `useDuckDB`, `useQuery`, `useMutation`, `useSyncStatus`
  - DuckDB context provider for application-wide database access
- **Database UI Components**:
  - `DatabaseSettings`: OPFS status, storage quota, sync configuration
  - `StorageStatusBanner`: Browser compatibility warnings
  - `ExportDatabaseDialog`: Export to JSON, CSV, or DuckDB format
  - `ImportDatabaseDialog`: Import with merge/replace options
  - `QueryConsole`: Developer SQL query interface (dev mode)
  - `DatabaseInspector`: Table browser and schema viewer (dev mode)
- **Electron DuckDB Support**:
  - Native file export/import via IPC handlers
  - Git hooks integration for DuckDB ↔ YAML sync (pre-commit, post-checkout, post-merge)
- **Documentation**:
  - `frontend/docs/DUCKDB_GUIDE.md`: User guide with browser compatibility and architecture
  - `frontend/docs/api/DUCKDB_SERVICE.md`: DuckDB service API reference
  - `frontend/docs/api/SYNC_ENGINE.md`: Sync engine API reference
  - `frontend/docs/DUCKDB_BINDINGS.md`: DuckDB-WASM bindings documentation
  - `frontend/docs/SDK_BINDINGS.md`: SDK WASM bindings documentation
- **Testing**: 117 new unit tests for DuckDB services
  - `duckdbService.test.ts`: 30 API contract tests
  - `queryBuilder.test.ts`: 50 query builder tests
  - `opfsManager.test.ts`: 18 OPFS manager tests
  - `syncEngine.test.ts`: 19 sync engine tests

### Changed
- **SDK Version**: Upgraded to data-modelling-sdk 1.13.2
- **Build Configuration**: Vite configured for WASM MIME types and SharedArrayBuffer headers
- **Test Suite**: Expanded from 487 to 604 tests

## [2.0.0] - 2026-01-07

### Added
- **SDK 1.13.1 Upgrade**: Major upgrade to data-modelling-sdk v1.13.1 with new features
- **Decision Logs (MADR)**: Architecture Decision Records management
  - MADR format support with status workflow (Draft → Proposed → Accepted/Rejected → Superseded)
  - Decision categories: Architecture, Technology, Process, Security, Data, Integration
  - Decision options with pros/cons tracking
  - Related decisions and knowledge articles linking
  - Markdown export functionality
  - Full-text search and filtering by status, category, domain
- **Knowledge Base**: Documentation and knowledge management system
  - Article types: Guide, Tutorial, Reference, Concept, Troubleshooting, Runbook
  - Publishing workflow: Draft → Review → Published → Archived
  - Full-text search across articles
  - Related articles and decisions cross-referencing
  - Prerequisites and See Also linking
  - Author and reviewer tracking
  - Markdown content with rich rendering
- **DuckDB Backend**: Optional embedded analytical database
  - YAML ↔ Database synchronization
  - SQL query execution for advanced analytics
  - Connection status monitoring
  - Configurable sync strategies (auto-sync, watch, sync-on-save)
  - Conflict resolution options (database-wins, yaml-wins, prompt)
- **PostgreSQL Backend**: Server-based database option
  - Full PostgreSQL connection support with SSL
  - Connection pooling configuration
  - Team collaboration support
- **Database Configuration**: New `.data-model.toml` configuration file
  - Database backend selection (none, duckdb, postgres)
  - Sync configuration options
  - Git hooks integration for version control
- **UI Components**: New components for decisions and knowledge
  - DecisionList with filtering, sorting, search
  - DecisionViewer with status workflow actions
  - DecisionEditor for creating and editing decisions
  - KnowledgeList with type and status filtering
  - ArticleViewer with markdown rendering
  - ArticleEditor for content management
  - Status and category badges
- **Domain Integration**: Link decisions and knowledge to domains
  - Decision counts shown in domain tabs
  - Knowledge article counts in domain tabs
  - Domain-scoped views for decisions and articles
- **Cross-Model Linking**: OpenAPI/CADS asset linking
  - Link decisions to external specifications
  - Reference knowledge from API definitions

### Changed
- **SDK Version**: Upgraded from 1.11.0 to 1.13.1
- **README**: Updated with SDK 1.13.1 features and documentation links
- **Test Coverage**: Added comprehensive test suites for new features
  - Unit tests for decision and knowledge services
  - Unit tests for database service
  - Store tests for decision and knowledge state management
  - Component tests for decision and knowledge UI
  - Integration tests for database sync
  - E2E tests for decision and knowledge workflows

### Documentation
- **Configuration Guide**: New `docs/CONFIGURATION.md` for database setup
- **Decision Logs Guide**: New `docs/DECISION_LOGS.md` user guide
- **Knowledge Base Guide**: New `docs/KNOWLEDGE_BASE.md` user guide

## [1.1.2] - 2026-01-06

### Added
- **Cloudflare Pages Support**: Added wrangler.toml configuration for Cloudflare Pages deployment
- **Automated Releases**: New consolidated CI/CD workflow that automatically creates GitHub releases on merge to main
- **Pre-built WASM SDK**: Build script now downloads pre-built WASM SDK from GitHub releases instead of building from source

### Changed
- **SDK Version**: Upgraded to data-modelling-sdk v1.8.4 with separate ODCL parser and improved validation
- **Build Process**: Removed SDK git submodule in favor of downloading pre-built WASM binaries (faster builds, no Rust required)
- **GitHub Workflows**: Consolidated three separate workflows (ci.yml, build-test.yml, build-release.yml) into single main.yml
- **ESLint Configuration**: Updated package.json lint scripts to use ESLINT_USE_FLAT_CONFIG=false for compatibility
- **Cloudflare Documentation**: Simplified deployment guide to use Cloudflare Pages Git integration

### Fixed
- **TypeScript Errors**: Fixed unused variable warnings for deprecated fallback parser methods
- **Build Output**: Fixed Cloudflare Pages deployment to use correct output directory (frontend/dist)
- **Lint-Staged**: Removed ESLint from pre-commit hook to avoid configuration conflicts
- **Electron Build**: Removed unused statSync import and unnecessary eslint-disable directives

### Removed
- Removed SDK git submodule (no longer needed with pre-built WASM downloads)
- Removed obsolete migration documentation files (SDK_1.8.3_*)
- Removed obsolete feature requests and GitHub issue templates
- Removed unused test files for deprecated features

## [1.1.0] - 2026-01-04

### Changed
- **Offline Mode Only**: Application now explicitly supports offline mode only. All API-related documentation and bug reports have been removed.
- **Documentation**: Comprehensive documentation updates:
  - Updated README.md to reflect offline-only mode and Electron desktop app focus
  - Rewrote Electron build guide with clear step-by-step instructions
  - Updated offline mode documentation to remove API references
  - Updated HOW_TO_RUN.md and QUICK_START.md for offline mode
- **CI/CD**: New GitHub Actions workflow (`.github/workflows/build-release.yml`):
  - Lint and format checks
  - Test suite with coverage requirements
  - Multi-platform builds (Ubuntu, macOS, Windows)
  - Automated release creation with installers when tags are pushed
  - Security audits

### Removed
- Removed outdated API bug reports and integration documentation
- Removed API-related setup guides (GitHub OAuth, API integration)
- Removed references to Docker Compose and API server requirements

### Fixed
- Documentation now accurately reflects current application state (offline mode only)
- Build instructions clarified for Electron app development

## [0.5.0] - 2025-01-XX

### Added - Phase 7: Personal and Shared Workspace Management
- **Workspace Management**: Complete workspace CRUD operations
  - Workspace creation (personal and shared types)
  - Workspace renaming and deletion
  - Workspace type conversion (personal to shared)
  - Workspace switching with state save/load
- **Workspace UI Components**: User interface for workspace management
  - WorkspaceList: Displays all available workspaces (personal and shared)
  - WorkspaceSelector: Dropdown selector for current workspace
  - WorkspaceSettings: Dialog for managing workspace settings, collaborators, and permissions
  - VersionHistory: Dialog for viewing PostgreSQL-based version history (online mode)
- **Workspace Service**: API integration for workspace operations
  - Create, rename, delete workspaces
  - Add/remove collaborators
  - Update collaborator access levels (read/edit)
  - Convert workspace type (personal to shared)
- **Versioning Service**: PostgreSQL-based version history
  - Get workspace version history
  - View specific version details
  - Restore workspace to previous version
- **Home Page Integration**: Enhanced home page with workspace management
  - Workspace list display with personal/shared indicators
  - Workspace creation dialog (online and offline modes)
  - Workspace selection and navigation
- **ModelEditor Integration**: Workspace management in editor
  - Workspace settings button in header
  - Version history button (online mode only)
  - Workspace settings and version history dialogs
- **Tests**: Comprehensive test coverage
  - Unit tests for workspace service and versioning service
  - Unit tests for workspace store
  - Component tests for all workspace UI components
  - Integration tests for workspace management workflow
  - E2E tests for complete user story 5 workflow

### Added - Phase 6: Offline Mode with Local File Storage
- **Offline Synchronization**: Online/offline sync service
  - Sync workspace state between local and remote
  - Auto-merge on connection restoration
  - Conflict detection and resolution (remote wins strategy)
  - Manual conflict resolution support
- **Conflict Resolution**: Conflict handling system
  - Conflict detection during sync
  - Remote wins strategy (configurable)
  - Export conflicts for manual resolution
  - Apply local or remote version manually
- **Auto-Save**: Configurable auto-save functionality
  - WebSocket real-time save for online mode
  - Configurable interval auto-save for offline mode (default: 5 minutes)
  - User-configurable auto-save interval
  - Auto-save enable/disable toggle
- **Browser Refresh Handling**: State preservation on refresh
  - Detect local and remote changes
  - User choice for handling conflicts on refresh
  - State persistence across browser sessions
- **Git Versioning**: Offline version control
  - Initialize Git repository for workspace
  - Commit changes with messages
  - View version history
  - Checkout specific versions
  - Export version snapshots
- **Retry Logic**: Enhanced error handling
  - Retry failed save operations (5 attempts)
  - Jitter-based exponential backoff
  - User manual retry option after max attempts
  - Data held in memory during retry failures
- **Offline File Operations**: Enhanced local file handling
  - Open workspace folder (containing domain subfolders)
  - Support for workspace folder structure: workspace-folder/domain-folder/tables.yaml and relationships.yaml
  - Electron file system integration
  - Browser file picker integration
- **Tests**: Comprehensive test coverage
  - Unit tests for sync service and conflict resolver
  - Unit tests for auto-save functionality
  - Unit tests for Git versioning service
  - Integration tests for offline sync workflow
  - E2E tests for complete user story 4 workflow

### Changed
- Home page now supports workspace creation and selection
- ModelEditor includes workspace settings and version history dialogs
- Workspace store enhanced with auto-save and browser refresh handling
- Offline mode now supports opening workspace folders (not just single files)

## [0.3.0] - 2025-01-XX

### Added - Phase 5: Multi-User Collaboration with Real-Time Updates
- **WebSocket Collaboration**: Real-time collaboration via WebSocket connections
  - WebSocket client service with automatic reconnection and exponential backoff
  - JWT authentication for WebSocket connections
  - Connection status monitoring (connected/disconnected/reconnecting)
- **Collaboration Service**: Real-time update handling for tables and relationships
  - Table update broadcasting and receiving
  - Relationship update broadcasting and receiving
  - Presence updates (cursor position, selected elements)
  - Conflict detection and warnings
  - Last-change-wins conflict resolution strategy
- **Collaboration Store**: Zustand store for collaboration state management
  - Participant management (add, update, remove)
  - Presence tracking with cursor positions and selected elements
  - Conflict management with conflict warnings
  - Access control (primary owner per canvas, edit/read permissions)
- **UI Components**: Collaboration user interface components
  - PresenceIndicator: Shows who's online and what they're editing
  - CollaborationStatus: Displays connection status and warnings
  - ConflictResolver: Handles and displays conflict warnings
- **React Hooks**: Custom hooks for collaboration features
  - useWebSocket: Manages WebSocket connections
  - useCollaboration: Manages collaboration features and real-time updates
- **ModelEditor Integration**: Full integration of collaboration features
  - Collaboration components in header
  - Real-time updates applied to model store
  - Conflict resolver dialog integration
  - Online/offline mode awareness
- **Tests**: Comprehensive test coverage
  - Unit tests for WebSocket client and collaboration service
  - Unit tests for collaboration store
  - Component tests for collaboration UI components
  - Hook tests for useWebSocket and useCollaboration
  - Integration tests for real-time collaboration workflow
  - E2E tests for complete user story 3 workflow

### Changed
- ModelEditor now includes collaboration status and presence indicators
- Collaboration features automatically disabled in offline mode

## [0.2.0] - 2025-01-XX

### Added
- Initial OpenAPI specification reverse-engineered from frontend code
- GitHub Actions CI/CD workflow for automated testing and building
- Comprehensive test suite with 95% coverage requirement
- Electron desktop app support for macOS
- Offline mode with WASM SDK integration
- Dual-mode operation (online via API, offline via WASM SDK)
- Import/Export support for ODCS, SQL, AVRO, JSON Schema, and Protobuf formats
- Domain-based canvas tabs for organizing large models
- Crow's feet notation for relationship visualization
- Multi-user collaboration via WebSockets
- Authentication via GitHub OAuth (web and desktop flows)
- Platform abstraction layer for browser and Electron environments
- Auto-save functionality (WebSocket real-time for online, configurable interval for offline)
- Error handling with retry logic (5 attempts with jitter backoff)
- Accessibility features (WCAG 2.1 Level AA compliance)
- Responsive design for tablet and desktop viewports

### Changed
- Updated project constitution to require 95% test coverage and prohibit partial implementations
- Integrated Electron as primary target from project start
- Refactored authentication to support dynamic redirect_uri for multiple frontend instances
- Updated OAuth flow to support desktop applications with polling mechanism

### Fixed
- Electron app blank screen issue (fixed asset paths for file:// protocol)
- Electron CommonJS/ES Module compatibility issues
- OAuth callback handling for web applications
- API client blocking requests in offline mode
- CardinalityEdge component TypeScript errors
- WASM SDK build integration into frontend build process

### Security
- Implemented JWT token refresh mechanism
- Added security audit step to CI/CD pipeline
- Context isolation enabled in Electron preload scripts

## [0.1.0] - 2025-01-01

### Added
- Initial project setup
- Frontend React application with TypeScript
- Vite build configuration
- TailwindCSS styling
- ReactFlow infinite canvas
- Zustand state management
- TanStack Query for server state
- Basic workspace and domain management
- Table and relationship CRUD operations
- ODCS 3.1.0 format support
- Local file storage for offline mode
- IndexedDB caching
- Platform detection and abstraction
- Electron main and preload scripts
- Test infrastructure (Vitest, Playwright, Testing Library)
- ESLint and Prettier configuration
- TypeScript strict mode
- GitHub Actions CI/CD workflow

[Unreleased]: https://github.com/your-org/data-modelling-app/compare/v2.0.0...HEAD
[2.0.0]: https://github.com/your-org/data-modelling-app/compare/v1.1.2...v2.0.0
[1.1.2]: https://github.com/your-org/data-modelling-app/compare/v1.1.0...v1.1.2
[1.1.0]: https://github.com/your-org/data-modelling-app/compare/v0.1.0...v1.1.0
[0.1.0]: https://github.com/your-org/data-modelling-app/releases/tag/v0.1.0

