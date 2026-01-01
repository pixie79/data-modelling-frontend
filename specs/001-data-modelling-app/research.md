# Research & Technology Decisions

**Date**: 2025-12-31  
**Feature**: Data Modelling Web Application

## Overview

This document consolidates research findings and technology decisions for the data modelling web application. All decisions align with the requirement to leverage existing SDK/API and minimize UI-specific code.

## Key Decisions

### 1. Frontend Framework: React 18.2+

**Decision**: Use React 18.2+ with TypeScript for the web application.

**Rationale**:
- User explicitly stated "The REACT framework works ok"
- Existing reference implementation uses React (modelling-old/frontend-react)
- React ecosystem provides mature libraries for infinite canvas (ReactFlow)
- Strong TypeScript support for type safety
- Large community and extensive documentation

**Alternatives Considered**:
- **Dioxus (Rust)**: Existing data-modelling-app uses Dioxus, but user wants React
- **Vue.js**: Less familiar to team, smaller ecosystem for diagramming
- **Svelte**: Less mature ecosystem, smaller community

### 2. Infinite Canvas Library: ReactFlow 11.11+

**Decision**: Use ReactFlow for infinite canvas and diagram rendering.

**Rationale**:
- Industry-standard library for node-based diagrams
- Supports infinite canvas with zoom/pan
- Customizable nodes and edges (for tables and relationships)
- Built-in selection, drag-and-drop, and layout algorithms
- Active maintenance and large community
- Used in reference implementation

**Alternatives Considered**:
- **D3.js**: Lower-level, requires more custom code
- **Konva.js**: Canvas-based, less React-friendly
- **Fabric.js**: Canvas-based, heavier weight

### 3. State Management: Zustand 4.4+

**Decision**: Use Zustand for global state management.

**Rationale**:
- Lightweight and simple API
- No boilerplate compared to Redux
- Good TypeScript support
- Used in reference implementation
- Sufficient for workspace/model/collaboration state

**Alternatives Considered**:
- **Redux Toolkit**: More boilerplate, overkill for this use case
- **Jotai**: Atomic state management, more complex
- **Context API**: Performance concerns with frequent updates

### 4. Server State Management: TanStack Query 5.0+

**Decision**: Use TanStack Query (React Query) for server state and caching.

**Rationale**:
- Handles API calls, caching, and synchronization automatically
- Built-in offline support and retry logic
- Optimistic updates for better UX
- Reduces boilerplate for API integration
- Used in reference implementation

**Alternatives Considered**:
- **SWR**: Similar features but less mature
- **Apollo Client**: Overkill, designed for GraphQL
- **Manual fetch**: Too much boilerplate

### 5. Build Tool: Vite 5.0+

**Decision**: Use Vite as build tool and dev server.

**Rationale**:
- Fast HMR (Hot Module Replacement) for development
- Optimized production builds
- Native ES modules support
- Used in reference implementation
- Better performance than Webpack

**Alternatives Considered**:
- **Webpack**: Slower, more configuration needed
- **Parcel**: Less popular, smaller ecosystem
- **Create React App**: Deprecated, slow

### 6. SDK Integration: WASM Bindings

**Decision**: Use WebAssembly (WASM) bindings to integrate Rust SDK.

**Rationale**:
- SDK already supports WASM (data-modelling-sdk Cargo.toml shows wasm feature)
- Reuses existing Rust code for ODCS handling and validation
- Better performance for heavy computations
- Type-safe bindings via wasm-bindgen
- Minimizes code duplication

**Alternatives Considered**:
- **REST API only**: Would require reimplementing validation logic
- **JavaScript rewrite**: Duplicates SDK functionality, maintenance burden

### 7. Real-Time Collaboration: WebSocket (Native Browser API)

**Decision**: Use native browser WebSocket API for real-time collaboration.

**Rationale**:
- API already supports WebSocket (Axum with ws feature)
- No additional dependencies needed
- Standard browser API, well-supported
- JWT authentication can be passed via query params or headers
- Lightweight compared to Socket.io

**Alternatives Considered**:
- **Socket.io**: Additional dependency, not needed for simple use case
- **Server-Sent Events**: One-way only, insufficient for collaboration
- **Polling**: Inefficient, poor UX

### 8. Offline Storage: IndexedDB + Local Files

**Decision**: Use IndexedDB for workspace state cache and local file system for ODCS exports.

**Rationale**:
- IndexedDB provides structured storage for workspace state
- Local file system (File API) for ODCS file I/O
- SDK supports browser storage (web-sys features in Cargo.toml)
- Enables offline-first architecture
- Cross-device compatibility via ODCS file format

**Alternatives Considered**:
- **localStorage only**: Size limitations, not suitable for large models
- **Service Workers**: Adds complexity, not required for this use case

### 9. Styling: TailwindCSS 4.1+

**Decision**: Use TailwindCSS for styling.

**Rationale**:
- Utility-first CSS framework
- Rapid UI development
- Used in reference implementation
- Good integration with React
- Consistent design system

**Alternatives Considered**:
- **CSS Modules**: More verbose, less rapid development
- **Styled Components**: Runtime overhead, larger bundle size
- **Material-UI**: Heavier, opinionated design system

### 10. Testing Strategy

**Decision**: Use Vitest for unit/integration tests, Playwright for E2E tests.

**Rationale**:
- Vitest is fast and Vite-native
- React Testing Library for component testing
- Playwright for reliable E2E testing
- Used in reference implementation
- Good TypeScript support

**Alternatives Considered**:
- **Jest**: Slower, more configuration needed
- **Cypress**: Less reliable, more flaky tests
- **Testing Library**: Already included with Vitest

## Integration Patterns

### SDK/WASM Integration Pattern

1. Load WASM module at application startup
2. Expose SDK functions via TypeScript bindings (generated from wasm-bindgen)
3. Use SDK for ODCS validation, parsing, and export
4. Keep UI logic in React, delegate data operations to SDK

### API Integration Pattern

1. Use TanStack Query for all API calls
2. Implement optimistic updates for better UX
3. Handle offline mode by queuing mutations
4. Sync queue when connection restored

### WebSocket Integration Pattern

1. Establish WebSocket connection on workspace open
2. Send JWT token in connection handshake
3. Handle incoming updates via event listeners
4. Merge updates into local state (last-change-wins)
5. Reconnect automatically on connection loss

## Performance Considerations

- **Canvas Rendering**: Use ReactFlow's virtualization for large models
- **State Updates**: Batch updates to prevent excessive re-renders
- **WASM Loading**: Lazy load WASM module, show loading state
- **API Calls**: Use TanStack Query caching to minimize requests
- **WebSocket**: Throttle high-frequency updates

## Security Considerations

- **Authentication**: JWT tokens stored in httpOnly cookies (handled by API)
- **Authorization**: API enforces permissions, frontend displays appropriate UI
- **Input Validation**: SDK validates ODCS format before processing
- **XSS Protection**: React's built-in escaping prevents XSS
- **WebSocket Security**: Authenticate connections, validate message format

### 11. Desktop App Framework: Electron 28+

**Decision**: Use Electron for macOS desktop app with shared React codebase.

**Rationale**:
- User requirement: "We can consider electron for an offline version for osx but ideally i dont want lots of fencing in the UI code"
- Electron allows sharing React codebase between web and desktop
- Native file system access for better offline experience on macOS
- Minimal platform-specific code needed (platform abstraction layer)
- Mature framework with large community
- Good performance and native integration

**Alternatives Considered**:
- **Tauri**: Rust-based, smaller bundle size, but requires more platform-specific code
- **Native macOS app**: Would require separate codebase, violates code reuse principle
- **Progressive Web App**: Limited native file system access, not suitable for offline-first

**Implementation Strategy**:
- Platform abstraction layer (`services/platform/`) to handle differences
- Electron main process handles native file I/O
- Preload script provides secure bridge between renderer and main process
- Shared React components and business logic
- Minimal Electron-specific code isolated in `electron/` directory

## Future Considerations

- **Mobile Support**: React Native could reuse business logic
- **Progressive Web App**: Service workers for offline caching (future enhancement)
- **Windows/Linux Electron**: Extend Electron app to other platforms

