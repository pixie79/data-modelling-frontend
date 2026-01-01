# Quick Start Guide

## Manual Testing - User Story 1

### Option 1: Quick Start Script

```bash
cd frontend
npm run dev:quick
# OR
./scripts/dev.sh
```

### Option 2: Manual Steps

```bash
# 1. Install dependencies
cd frontend
npm install

# 2. Create environment file (optional)
cp .env.example .env.local
# Edit .env.local if needed

# 3. Start development server
npm run dev
```

**Application will be available at: http://localhost:5173**

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

## Running the API Server (Optional)

The app works in offline mode, but for full online features:

```bash
# Start the data-modelling-api server
# Should run on http://localhost:8081
# Check the API repository for instructions
```

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

CI/CD is configured in `.github/workflows/ci.yml`:

- **Automatically runs on push/PR**
- **Tests on Node.js 20.x and 22.x**
- **Checks coverage (95% threshold)**
- **Builds web and Electron apps**
- **Runs security audit**

To trigger manually:
1. Push to branch
2. Create Pull Request
3. Check Actions tab in GitHub

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
3. **API Integration**: [frontend/docs/API_INTEGRATION.md](./frontend/docs/API_INTEGRATION.md)

