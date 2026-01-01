# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/your-org/data-modelling-app/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/your-org/data-modelling-app/releases/tag/v0.1.0

