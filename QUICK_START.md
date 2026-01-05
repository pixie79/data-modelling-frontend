# Quick Start Guide

**⚠️ IMPORTANT: This application currently only supports OFFLINE MODE.**

## Quick Start Options

### Option 1: Docker (Web Version)

Build and run using Docker (automatically builds latest SDK):

```bash
docker-compose up -d
# Access at http://localhost:5173
```

See [docker/README.md](./docker/README.md) for details.

### Option 2: Electron Desktop Application

```bash
cd frontend
npm install
npm run build:wasm   # Build WASM SDK (required)
npm run electron:dev # Start Electron app
```

This will:
1. Build Electron main/preload scripts
2. Start Vite dev server (http://localhost:5173)
3. Launch Electron app connected to dev server

**Note**: No API server is required. The app operates entirely offline.

## Running Tests

```bash
cd frontend

# Run all tests
npm test

# Run tests with UI
npm run test:ui

# Run tests with coverage (must be 95%+)
npm run test:coverage

# Type check
npm run type-check

# Lint code
npm run lint
```

## Building Production Release

```bash
cd frontend
npm run build:wasm   # Build WASM SDK
npm run build        # Build frontend
npm run build:electron # Build Electron scripts
npm run electron:build  # Create production package
```

This creates platform-specific installers in `release/` directory.

See [frontend/ELECTRON_BUILD_GUIDE.md](./frontend/ELECTRON_BUILD_GUIDE.md) for detailed instructions.

## Manual Testing Checklist

See [frontend/MANUAL_TESTING.md](./frontend/MANUAL_TESTING.md) for detailed test scenarios.

Quick checklist:
- [ ] Create tables
- [ ] Edit tables
- [ ] Create relationships
- [ ] Switch domains
- [ ] Import/Export ODCS
- [ ] Test offline mode
- [ ] Verify validation

## GitHub Actions

CI/CD is configured in `.github/workflows/build-release.yml`:

- **Lint and Format**: Runs ESLint and Prettier checks
- **Test**: Runs test suite on Node.js 20.x and 22.x (95% coverage threshold)
- **Build**: Builds WASM SDK, frontend, and Electron apps for all platforms
- **Release**: Creates GitHub releases with installers when tags are pushed
- **Security**: Performs npm security audits

The workflow runs on:
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop`
- Tags starting with `v*` (creates release)
- Manual workflow dispatch

## Troubleshooting

### Port Already in Use

```bash
# Find process using port 5173
lsof -i :5173

# Kill process
kill -9 <PID>
```

### Dependencies Issues

```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
```

### Tests Failing

```bash
# Run with verbose output
npm test -- --reporter=verbose

# Check specific test file
npm test -- tests/unit/services/api/workspaceService.test.ts
```

## Next Steps

1. **Read Testing Guide**: [frontend/TESTING.md](./frontend/TESTING.md)
2. **Manual Testing**: [frontend/MANUAL_TESTING.md](./frontend/MANUAL_TESTING.md)
3. **Electron Build Guide**: [frontend/ELECTRON_BUILD_GUIDE.md](./frontend/ELECTRON_BUILD_GUIDE.md)
4. **Offline Mode**: [frontend/docs/OFFLINE_MODE.md](./frontend/docs/OFFLINE_MODE.md)



