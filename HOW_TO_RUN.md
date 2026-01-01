# How to Run the Application

## Quick Start

### 1. Start the Web Application

```bash
cd frontend
npm install          # First time only
npm run dev          # Start dev server
```

**Application URL**: http://localhost:5173

### 2. Start the API Server (Optional)

The app works in **offline mode** without the API, but for full online features:

```bash
# Navigate to data-modelling-api directory
cd ../data-modelling-api

# Follow API's README to start the server
# API should run on http://localhost:8081
```

**Note**: If the API is not running, the app automatically switches to offline mode.

## Running Tests

```bash
cd frontend

# Run all tests
npm test

# Run tests with interactive UI
npm run test:ui

# Run tests with coverage report (must be 95%+)
npm run test:coverage

# Type checking
npm run type-check

# Linting
npm run lint
```

## Manual Testing

See [frontend/MANUAL_TESTING.md](./frontend/MANUAL_TESTING.md) for detailed test scenarios.

**Quick Test Checklist**:
1. ✅ Create a table
2. ✅ Add columns to table
3. ✅ Create a relationship between tables
4. ✅ Switch between domains (Conceptual/Logical/Physical)
5. ✅ Import an ODCS file
6. ✅ Export to ODCS format
7. ✅ Test offline mode (stop API, verify app still works)

## GitHub Actions CI/CD

### Automatic Runs

GitHub Actions automatically runs on:
- **Push** to `main`, `develop`, or `001-data-modelling-app` branches
- **Pull Requests** to `main` or `develop`

### What Gets Tested

1. **Test Suite** (Node.js 20.x and 22.x)
   - Unit tests
   - Integration tests
   - Coverage check (95% threshold)

2. **Build**
   - Web application build
   - Electron application build

3. **Security Audit**
   - npm audit for vulnerabilities

4. **Code Quality**
   - ESLint
   - TypeScript type checking
   - Prettier formatting check

### Viewing Results

1. Go to GitHub repository
2. Click "Actions" tab
3. Select the workflow run
4. View results for each job

### Manual Trigger

To manually trigger a workflow:
1. Push a commit to the branch
2. Or create a Pull Request

## Environment Setup

### Create `.env.local`

```bash
cd frontend
cp .env.example .env.local
```

Edit `.env.local` if needed:
```env
VITE_API_BASE_URL=http://localhost:8081
VITE_WS_BASE_URL=ws://localhost:8081
```

## Electron Desktop App

### Development Mode

```bash
cd frontend
npm run electron:dev
```

This runs:
1. Vite dev server (http://localhost:5173)
2. Electron app (connects to dev server)

### Production Build

```bash
cd frontend
npm run build
npm run build:electron
npm run electron:build
```

## Troubleshooting

### Port Already in Use

```bash
# Find what's using port 5173
lsof -i :5173

# Kill the process
kill -9 <PID>
```

### Tests Failing

```bash
# Run with verbose output
npm test -- --reporter=verbose

# Run specific test file
npm test -- tests/unit/services/api/workspaceService.test.ts

# Clear test cache
npm test -- --clearCache
```

### Build Errors

```bash
# Check TypeScript errors
npm run type-check

# Check linting errors
npm run lint

# Clean build
rm -rf dist node_modules
npm install
npm run build
```

### API Connection Issues

- Check API is running: `curl http://localhost:8081/api/v1/health`
- Check `.env.local` configuration
- App will automatically use offline mode if API unavailable

## Development Workflow

1. **Make changes** to code
2. **Run tests**: `npm test`
3. **Check coverage**: `npm run test:coverage`
4. **Type check**: `npm run type-check`
5. **Lint**: `npm run lint`
6. **Test manually**: Open http://localhost:5173
7. **Commit** when all checks pass

## Documentation

- **Testing Guide**: [frontend/TESTING.md](./frontend/TESTING.md)
- **Manual Testing**: [frontend/MANUAL_TESTING.md](./frontend/MANUAL_TESTING.md)
- **API Integration**: [frontend/docs/API_INTEGRATION.md](./frontend/docs/API_INTEGRATION.md)
- **Offline Mode**: [frontend/docs/OFFLINE_MODE.md](./frontend/docs/OFFLINE_MODE.md)

