# Open Data Modelling Application

A domain-centric data modelling application built with React and Electron. Create data architectures, models, and flow diagrams entirely offline.

[![Build and Release](https://github.com/your-org/data-modelling-app/actions/workflows/build-release.yml/badge.svg)](https://github.com/your-org/data-modelling-app/actions/workflows/build-release.yml)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)

**⚠️ IMPORTANT: This application currently only supports OFFLINE MODE.**

## Features

- **Data Modelling**: Conceptual, logical, and physical models with crow's feet notation
- **Infinite Canvas**: ReactFlow-based canvas for visualizing data models
- **Offline Mode**: **Currently only supports offline mode** - Works without API using local files and WASM SDK
- **Import/Export**: Support for ODCS, SQL, AVRO, JSON Schema, and Protobuf formats
- **Cross-Platform**: Electron desktop app (macOS, Windows, Linux)
- **Domain-Centric**: Organize data models by business domains with systems, tables, relationships, BPMN processes, and DMN decisions
- **Decision Logs** (SDK 1.13.6+): MADR-format Architecture Decision Records with status workflow
- **Knowledge Base** (SDK 1.13.6+): Documentation articles with types (Guide, Tutorial, Reference, etc.)
- **DuckDB-WASM** (v2.1.0+): In-browser SQL database with OPFS persistence for advanced querying and analytics

## Prerequisites

- **Node.js 20+** (LTS version)
- **npm** or **pnpm**
- **Rust** and **wasm-pack** (for building WASM SDK)
  ```bash
  # Install Rust
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
  
  # Install wasm-pack
  cargo install wasm-pack
  ```

## Pre-commit Hooks

This project uses pre-commit hooks to ensure code quality. After cloning, run:

```bash
cd frontend
npm install
```

The hooks will automatically run on `git commit` and check:
- **Linting** (ESLint) - Auto-fixes issues
- **Formatting** (Prettier) - Ensures consistent code style
- **Type Checking** (TypeScript) - Validates types
- **Tests** (Vitest) - Runs unit and integration tests
- **Security Audit** (npm audit) - Checks for vulnerabilities (non-blocking)

See [frontend/PRE_COMMIT_SETUP.md](frontend/PRE_COMMIT_SETUP.md) for detailed setup instructions.

## Quick Start

### Option 1: Docker (Web Version)

Build and run the web version using Docker:

```bash
# Build and start the frontend service
docker-compose up -d

# View logs
docker-compose logs -f frontend

# Access the application
# Web: http://localhost:5173
```

See [docker/README.md](docker/README.md) for detailed Docker setup instructions.

### Option 2: Local Development (Electron App)

#### Installation

```bash
# Install dependencies
cd frontend
npm install

# Build WASM SDK (required for offline mode)
npm run build:wasm
```

#### Development

```bash
# Start Electron app in development mode
cd frontend
npm run electron:dev

# This will:
# 1. Build Electron main/preload scripts
# 2. Start Vite dev server (http://localhost:5173)
# 3. Launch Electron app connected to dev server
```

**Note**: The development script (`scripts/dev.sh`) will automatically:
- Check Node.js version
- Install dependencies if needed
- Build WASM SDK if not present
- Start the development server

### Building WASM SDK

The WASM SDK is automatically built before the main build, but you can build it manually:

```bash
npm run build:wasm
```

This will:
1. Build the Rust SDK as a WASM module
2. Copy the WASM files to `frontend/public/wasm/`
3. Make them available for offline mode

### Testing

```bash
# Run all tests
npm test

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage

# Type check
npm run type-check

# Lint
npm run lint
```

### Building Electron Application

See [frontend/ELECTRON_BUILD_GUIDE.md](frontend/ELECTRON_BUILD_GUIDE.md) for detailed build instructions.

**Quick build commands:**

```bash
cd frontend

# Build WASM SDK (required)
npm run build:wasm

# Build frontend
npm run build

# Build Electron main/preload scripts
npm run build:electron

# Build production Electron app (creates installers)
npm run electron:build
```

This creates platform-specific installers:
- **macOS**: `.dmg` or `.pkg` files
- **Windows**: `.exe` or `.msi` files  
- **Linux**: `.AppImage` or `.deb` files

## Project Structure

```
frontend/
├── src/
│   ├── components/     # React components
│   ├── services/       # API, SDK, storage services
│   ├── stores/         # Zustand state management
│   ├── types/          # TypeScript type definitions
│   ├── utils/          # Utility functions
│   └── pages/          # Page components
├── tests/              # Test files
├── electron/           # Electron-specific code
├── public/
│   └── wasm/           # WASM SDK files (built from data-modelling-sdk)
├── scripts/
│   ├── build-wasm.sh   # Build script for WASM SDK
│   └── dev.sh          # Development server script
└── package.json
```

## Environment Variables

**Note**: Since the app operates in offline mode only, environment variables are not required. The app uses local file storage and WASM SDK for all operations.

## WASM SDK Integration

The application uses a WASM build of the `data-modelling-sdk` (version **1.13.6**) for offline functionality:

1. **SDK Version**: Requires `data-modelling-sdk = "1.13.6"` crate
2. **Build Process**: The SDK is built using `wasm-pack` and copied to `public/wasm/`
3. **Automatic Build**: Runs automatically before `npm run build` via `prebuild` script
4. **Development**: Can be built manually with `npm run build:wasm`
5. **Fallback**: If WASM SDK is not available, the app uses a JavaScript YAML parser fallback

**Note**: The SDK must be version 1.13.6 or compatible. The API project (`data-modelling-api`) is available on [crates.io](https://crates.io/crates/data-modelling-api) and uses `data-modelling-sdk = "1.13.6"` with features `["api-backend", "git"]`.

### SDK 1.13.1 Features

The SDK 1.13.1 release includes these new capabilities:

- **Decision Logs (MADR)**: Architecture Decision Records following the MADR format
  - Status workflow: Draft → Proposed → Accepted/Rejected → Superseded
  - Categories: Architecture, Technology, Process, Security, Data, Integration
  - Related decisions and knowledge articles linking
  - Markdown export
  
- **Knowledge Base**: Documentation and knowledge management
  - Article types: Guide, Tutorial, Reference, Concept, Troubleshooting, Runbook
  - Publishing workflow: Draft → Review → Published → Archived
  - Full-text search across articles
  - Related articles and decisions linking
  
- **DuckDB Backend**: Optional embedded analytical database
  - YAML ↔ Database synchronization
  - SQL query execution
  - Advanced analytics and reporting
  - Configuration via `.data-model.toml`

See the following documentation for more details:
- [Configuration Guide](frontend/docs/CONFIGURATION.md)
- [Decision Logs Guide](frontend/docs/DECISION_LOGS.md)
- [Knowledge Base Guide](frontend/docs/KNOWLEDGE_BASE.md)

### DuckDB-WASM Features (v2.1.0+)

The application includes DuckDB-WASM 1.29.0 (DuckDB 1.4.3) for in-browser SQL queries:

- **OPFS Persistence**: Database persists in browser's Origin Private File System
- **Browser Compatibility**: Chrome 86+, Edge 86+, Firefox 111+, Safari 15.2+
- **Automatic Fallback**: In-memory mode for unsupported browsers
- **YAML Sync**: Bidirectional synchronization with YAML workspace files
- **Type-safe Queries**: Fluent query builder with TypeScript support
- **Developer Tools**: SQL console and database inspector (dev mode)

See [DuckDB Guide](frontend/docs/DUCKDB_GUIDE.md) for detailed documentation.

## Offline Mode

**⚠️ IMPORTANT: This application currently only supports OFFLINE MODE.**

The app operates entirely offline using:
- **WASM SDK**: Direct use of `data-modelling-sdk` compiled to WebAssembly
- **Local File System**: Electron file system access for saving/loading workspaces
- **No API Required**: All functionality works without any backend server

**Note**: Online mode (API integration) is not currently supported. The application is designed to work standalone with local file storage.

## CI/CD

The GitHub Actions workflow (`.github/workflows/build-release.yml`):
- **Lint and Format**: Runs ESLint and Prettier checks
- **Test**: Runs test suite with 95% coverage requirement
- **Build**: Builds WASM SDK, frontend, and Electron applications for all platforms
- **Release**: Creates GitHub releases with installers when tags are pushed
- **Security**: Performs npm security audits

The workflow runs on:
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop`
- Tags starting with `v*` (creates release)
- Manual workflow dispatch

## Building from Source

### Prerequisites

- **Node.js 20+** (LTS version recommended)
- **Rust** and **wasm-pack** (for building WASM SDK)
  ```bash
  # Install Rust
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
  
  # Install wasm-pack
  cargo install wasm-pack
  ```

### Build Steps

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd dm
   ```

2. **Install dependencies**
   ```bash
   cd frontend
   npm install
   ```

3. **Build WASM SDK**
   ```bash
   npm run build:wasm
   ```
   Note: This requires the `data-modelling-sdk` repository to be accessible. See [frontend/ELECTRON_BUILD_GUIDE.md](frontend/ELECTRON_BUILD_GUIDE.md) for details.

4. **Build Electron application**
   ```bash
   npm run build
   npm run build:electron
   npm run electron:build
   ```

See [frontend/ELECTRON_BUILD_GUIDE.md](frontend/ELECTRON_BUILD_GUIDE.md) for complete build instructions.

## Contributing

1. Follow the project constitution (`.specify/memory/constitution.md`)
2. Maintain 95% test coverage
3. No partial implementations or TODOs without explicit authorization
4. Follow conventional commit messages
5. Run tests before committing: `npm test`

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for a detailed list of changes.

## License

ISC
