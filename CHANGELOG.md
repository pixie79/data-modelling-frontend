# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

