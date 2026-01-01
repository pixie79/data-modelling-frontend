# Implementation Plan: Data Modelling Web Application

**Branch**: `001-data-modelling-app` | **Date**: 2025-12-31 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-data-modelling-app/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Build a React-based web application with Electron desktop app support for creating data architectures, models, and flow diagrams. The application will support conceptual, logical, and physical data models with crow's feet notation, data flow diagrams with abstract icons, and multi-user real-time collaboration via WebSockets. The system will work both online (with API integration) and offline (with local file storage in ODCS 3.1.0 format). The web application and Electron desktop app share the same React codebase, with Electron providing native file system access and offline capabilities for macOS. The application leverages the existing data-modelling-sdk (Rust/WASM) and data-modelling-api (Rust/Axum) for core functionality, minimizing UI-specific code and maximizing code reuse.

## Technical Context

**Language/Version**: TypeScript 5.3+, React 18.2+, Node.js 20+ (LTS)  
**Primary Dependencies**: 
- React 18.2+ (UI framework)
- ReactFlow 11.11+ (infinite canvas and diagramming)
- Zustand 4.4+ (state management)
- TanStack Query 5.0+ (server state and caching)
- Axios 1.6+ (HTTP client for API)
- Vite 5.0+ (build tool and dev server)
- Electron 28+ (desktop app framework for macOS)
- Electron Builder 24+ (packaging and distribution)
- TypeScript 5.3+ (type safety)
- TailwindCSS 4.1+ (styling)
- data-modelling-sdk = "1.0.2" (WASM bindings for Rust SDK)
- WebSocket API (native browser WebSocket for real-time collaboration)

**Storage**: 
- Online: PostgreSQL (via data-modelling-api)
- Offline: Local files (ODCS 3.1.0 YAML format)
- Browser: localStorage/IndexedDB for workspace state and offline cache
- Electron: Native file system access for direct ODCS file I/O (macOS)

**Testing**: 
- Vitest 1.6+ (unit and integration tests)
- React Testing Library 14.0+ (component testing)
- Playwright 1.57+ (E2E testing)
- TypeScript compiler (type checking)

**Target Platform**: 
- Primary: Modern web browsers (Chrome, Firefox, Safari, Edge - latest 2 versions)
- Desktop: Electron app for macOS (offline-first with native file system access)

**Project Type**: Web application with Electron desktop app (shared React codebase, frontend-only, consumes existing API)

**Performance Goals**: 
- Canvas renders 100+ tables without freezing (SC-005)
- Real-time updates appear within 2 seconds (SC-003)
- Workspace save operations complete within 1 second (95% of time) (SC-006)
- Workspace switching under 3 seconds (SC-007)
- Support 5+ concurrent users without degradation (SC-002)

**Constraints**: 
- Must work offline without API (local file storage)
- Must support real-time collaboration via WebSocket when online
- Must use ODCS 3.1.0 format for persistence
- Must leverage existing SDK/API to minimize UI-specific code
- Must support domain-based canvas organization for large models
- Component-by-component updates (no full page refresh during editing)
- JWT token refresh before expiration with offline fallback
- Electron app must share React codebase with web app (minimal platform-specific code)
- Electron app must provide native file system access for macOS users

**Scale/Scope**: 
- Multiple workspaces per user (personal and shared)
- 100+ tables per workspace (organized into domain canvases)
- 5+ concurrent users per shared workspace
- Cross-device compatibility via ODCS format
- GIT export support for offline conflict resolution

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Code Quality & Compilation**: ✅ PASS
- TypeScript provides compile-time type checking and error detection
- ESLint configured for React/TypeScript with strict rules
- Prettier for automated code formatting
- Vite build process validates compilation before production builds
- Plan: Configure ESLint with TypeScript parser, Prettier integration, pre-commit hooks

**Dependency Management**: ✅ PASS
- All dependencies use latest stable versions (React 18.2+, TypeScript 5.3+, etc.)
- Dependencies align with existing React app patterns (reference implementation)
- SDK/API dependencies are versioned and maintained
- Plan: Use npm/pnpm for dependency management, regular security audits via `npm audit`, dependency update strategy documented

**Security-First Design**: ✅ PASS
- JWT authentication via existing API (no credentials stored in frontend)
- Input validation via SDK (ODCS format validation)
- XSS protection via React's built-in escaping
- CORS handled by API backend
- WebSocket connections authenticated via JWT tokens
- Local file storage isolated to user's browser (no cross-origin access)
- Plan: Document security considerations, implement input sanitization, secure WebSocket connections

**Security Auditing**: ✅ PASS
- npm audit for dependency vulnerabilities
- ESLint security plugins (eslint-plugin-security)
- OWASP dependency check integration
- Manual security review for authentication flows and WebSocket handling
- Plan: Configure automated security scanning in CI/CD, schedule regular audits

**Linting Discipline**: ✅ PASS
- ESLint configured for TypeScript/React with strict rules
- Prettier for consistent formatting
- Pre-commit hooks to enforce linting before commit
- CI/CD pipeline blocks on linting errors
- Plan: Configure ESLint rules, integrate with IDE, add pre-commit hooks, CI/CD validation

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
frontend/
├── src/
│   ├── components/
│   │   ├── canvas/              # Infinite canvas components
│   │   │   ├── InfiniteCanvas.tsx
│   │   │   ├── CanvasNode.tsx    # Table/flow node rendering
│   │   │   ├── CanvasEdge.tsx    # Relationship/flow edge rendering
│   │   │   └── CanvasControls.tsx # Zoom, pan, selection
│   │   ├── table/               # Table editor components
│   │   │   ├── TableEditor.tsx
│   │   │   ├── ColumnEditor.tsx
│   │   │   └── TableProperties.tsx
│   │   ├── domain/               # Domain canvas management
│   │   │   ├── DomainTabs.tsx
│   │   │   └── DomainSelector.tsx
│   │   ├── dataflow/            # Data flow diagram components
│   │   │   ├── DataFlowCanvas.tsx
│   │   │   ├── FlowNode.tsx
│   │   │   └── FlowConnection.tsx
│   │   ├── collaboration/        # Real-time collaboration UI
│   │   │   ├── PresenceIndicator.tsx
│   │   │   ├── CollaborationStatus.tsx
│   │   │   └── ConflictResolver.tsx
│   │   ├── workspace/           # Workspace management
│   │   │   ├── WorkspaceList.tsx
│   │   │   ├── WorkspaceSelector.tsx
│   │   │   └── WorkspaceSettings.tsx
│   │   ├── auth/                # Authentication components
│   │   │   └── AuthProvider.tsx
│   │   └── common/              # Shared UI components
│   │       ├── Dialog.tsx
│   │       ├── Toast.tsx
│   │       └── Loading.tsx
│   ├── pages/
│   │   ├── Home.tsx              # Workspace selection
│   │   ├── ModelEditor.tsx       # Main modeling interface
│   │   └── NotFound.tsx
│   ├── services/
│   │   ├── api/                 # API client services
│   │   │   ├── apiClient.ts     # HTTP client wrapper
│   │   │   ├── workspaceService.ts
│   │   │   ├── tableService.ts
│   │   │   ├── relationshipService.ts
│   │   │   └── authService.ts
│   │   ├── websocket/            # WebSocket services
│   │   │   ├── websocketClient.ts
│   │   │   └── collaborationService.ts
│   │   ├── storage/              # Local storage services
│   │   │   ├── localFileService.ts  # ODCS file I/O (browser)
│   │   │   ├── electronFileService.ts  # ODCS file I/O (Electron native)
│   │   │   ├── localStorageService.ts
│   │   │   └── indexedDBService.ts
│   │   ├── platform/             # Platform abstraction layer
│   │   │   ├── platform.ts       # Platform detection and abstraction
│   │   │   ├── browser.ts        # Browser-specific implementations
│   │   │   └── electron.ts       # Electron-specific implementations
│   │   ├── sdk/                  # SDK/WASM integration
│   │   │   ├── sdkLoader.ts     # WASM module loader
│   │   │   ├── odcsService.ts    # ODCS format handling
│   │   │   └── validationService.ts
│   │   └── sync/                 # Sync services
│   │       ├── syncService.ts    # Online/offline sync
│   │       └── conflictResolver.ts
│   ├── stores/                   # State management (Zustand)
│   │   ├── workspaceStore.ts
│   │   ├── modelStore.ts
│   │   ├── collaborationStore.ts
│   │   └── uiStore.ts
│   ├── hooks/                    # Custom React hooks
│   │   ├── useWebSocket.ts
│   │   ├── useCollaboration.ts
│   │   ├── useOfflineSync.ts
│   │   └── useCanvas.ts
│   ├── types/                     # TypeScript type definitions
│   │   ├── workspace.ts
│   │   ├── table.ts
│   │   ├── relationship.ts
│   │   ├── dataflow.ts
│   │   └── api.ts
│   ├── utils/                     # Utility functions
│   │   ├── validation.ts
│   │   ├── formatting.ts
│   │   └── errors.ts
│   ├── App.tsx                    # Root component
│   └── main.tsx                   # Entry point (web)
├── electron/                      # Electron-specific code
│   ├── main.ts                    # Electron main process
│   ├── preload.ts                 # Preload script (bridge)
│   ├── electron-builder.yml       # Electron Builder config
│   └── icons/                     # App icons for macOS
├── public/                         # Static assets
│   └── wasm/                      # WASM modules (SDK)
├── tests/
│   ├── unit/                      # Unit tests
│   ├── integration/              # Integration tests
│   ├── e2e/                       # E2E tests (Playwright for web)
│   ├── electron/                  # Electron-specific tests
│   └── setup.ts                   # Test setup
├── package.json
├── tsconfig.json
├── vite.config.ts                 # Vite config for web build
├── vite.electron.config.ts        # Vite config for Electron build
├── tailwind.config.js
├── eslint.config.js
└── prettier.config.js
```

**Structure Decision**: Web application with Electron desktop app structure selected. The React codebase is shared between web and Electron platforms, with a platform abstraction layer (`services/platform/`) to handle platform-specific differences (file I/O, native dialogs, etc.). Electron-specific code is isolated in the `electron/` directory (main process, preload script, build config). The structure follows React best practices with clear separation of concerns: components for UI, services for business logic and API integration, stores for state management, and hooks for reusable behavior. The SDK integration is handled via WASM modules loaded at runtime. Platform-specific implementations are abstracted to minimize code duplication and maintain a single source of truth for UI logic.

## Constitution Check (Post-Design)

*Re-evaluated after Phase 1 design completion.*

**Code Quality & Compilation**: ✅ PASS
- TypeScript provides compile-time type checking
- ESLint configured with TypeScript parser and React plugins
- Prettier integrated for automated formatting
- Vite build process validates compilation
- Pre-commit hooks enforce code quality

**Dependency Management**: ✅ PASS
- All dependencies use latest stable versions
- npm/pnpm for dependency management
- Regular security audits via `npm audit`
- Dependency update strategy documented in research.md

**Security-First Design**: ✅ PASS
- JWT authentication via API (no credentials in frontend)
- Input validation via SDK (ODCS format validation)
- XSS protection via React's built-in escaping
- WebSocket authentication via JWT tokens
- Local file storage isolated to user's browser
- Security considerations documented in research.md

**Security Auditing**: ✅ PASS
- npm audit for dependency vulnerabilities
- ESLint security plugins configured
- OWASP dependency check integration planned
- Manual security review for authentication flows
- Security scanning in CI/CD pipeline

**Linting Discipline**: ✅ PASS
- ESLint configured for TypeScript/React
- Prettier for consistent formatting
- Pre-commit hooks enforce linting
- CI/CD pipeline blocks on linting errors
- Linting integrated into development workflow

**Complete Implementation & Testing**: ✅ PASS
- Test framework planned (Vitest, React Testing Library, Playwright)
- Electron-specific tests planned for native features
- 95% test coverage requirement documented
- No TODOs or partial implementations allowed
- Platform abstraction layer ensures complete implementations for both web and Electron

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations detected. All architecture decisions align with constitution principles:
- Code quality: TypeScript compilation, ESLint, Prettier
- Dependency management: Latest stable versions, security audits
- Security-first: JWT auth, input validation, XSS protection
- Security auditing: npm audit, ESLint security plugins
- Linting discipline: ESLint + Prettier, pre-commit hooks, CI/CD integration
