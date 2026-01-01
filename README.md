# Data Modelling Web Application

A React-based web application with Electron desktop app support for creating data architectures, models, and flow diagrams.

[![Build and Test](https://github.com/your-org/data-modelling-app/actions/workflows/build-test.yml/badge.svg)](https://github.com/your-org/data-modelling-app/actions/workflows/build-test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- **Data Modelling**: Conceptual, logical, and physical models with crow's feet notation
- **Infinite Canvas**: ReactFlow-based canvas for visualizing data models
- **Multi-User Collaboration**: Real-time collaboration via WebSockets
- **Offline Mode**: Works without API using local files and WASM SDK
- **Import/Export**: Support for ODCS, SQL, AVRO, JSON Schema, and Protobuf formats
- **Cross-Platform**: Web app and Electron desktop app (macOS)

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

## Quick Start

### Installation

```bash
# Install dependencies
cd frontend
npm install

# Build WASM SDK (required for offline mode)
npm run build:wasm

# Create environment file (optional)
cp .env.example .env.local
# Edit .env.local with your API URL if needed
```

### Development

```bash
# Start development server
npm run dev
# or use the convenience script
./scripts/dev.sh

# Application will be available at http://localhost:5173
```

The development script (`scripts/dev.sh`) will automatically:
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

### Building

```bash
# Build web application (includes WASM SDK)
npm run build

# Build Electron application
npm run build:electron

# Preview production build
npm run preview
```

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

Create `frontend/.env.local`:

```env
VITE_API_BASE_URL=http://localhost:8081
VITE_WS_BASE_URL=ws://localhost:8081
```

## WASM SDK Integration

The application uses a WASM build of the `data-modelling-sdk` for offline functionality:

1. **Build Process**: The SDK is built using `wasm-pack` and copied to `public/wasm/`
2. **Automatic Build**: Runs automatically before `npm run build` via `prebuild` script
3. **Development**: Can be built manually with `npm run build:wasm`
4. **Fallback**: If WASM SDK is not available, the app uses a JavaScript YAML parser fallback

## Offline Mode

The app supports two modes:

- **Online Mode**: Uses API endpoints (requires API server)
- **Offline Mode**: Uses WASM SDK directly (works without API)

The app automatically detects which mode to use based on API availability.

## CI/CD

The GitHub Actions workflow (`.github/workflows/build-test.yml`):
- Builds WASM SDK before building the application
- Runs tests with 95% coverage requirement
- Builds both web and Electron applications
- Performs security audits
- Checks code formatting
- Validates TypeScript types

## API Specification

The OpenAPI specification (`openapi.json`) has been reverse-engineered from the frontend codebase and includes:
- Authentication endpoints (GitHub OAuth, token management)
- Workspace and domain management
- Table and relationship CRUD operations
- Import/Export endpoints for multiple formats
- Complete schema definitions

To regenerate the OpenAPI spec from the API server (when available):
```bash
bash scripts/fetch-openapi.sh
```

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
