# Testing Guide - User Story 1

This guide explains how to manually test User Story 1 (Core Data Modelling) and how to run the application.

## Prerequisites

- Node.js 20+ (LTS version)
- npm or pnpm
- Modern web browser (Chrome, Firefox, Safari, Edge)
- data-modelling-api running (optional, for online mode testing)

## Quick Start

### 1. Install Dependencies

```bash
cd frontend
npm install
```

### 2. Configure Environment

Create `frontend/.env.local`:

```env
VITE_API_BASE_URL=http://localhost:8081
VITE_WS_BASE_URL=ws://localhost:8081
```

**Note**: If the API is not running, the app will automatically switch to offline mode.

### 3. Start Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

### 4. Run Tests

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

## Manual Testing - User Story 1

### Test Scenario 1: Create and Edit Tables

1. **Open the application** at `http://localhost:5173`
2. **Create a workspace** (or use existing one)
3. **Select a domain** (Conceptual, Logical, or Physical)
4. **Add a table**:
   - Click "Add Table" button
   - Enter table name (e.g., "Users")
   - Add columns:
     - `id` (UUID, Primary Key, Not Null)
     - `name` (VARCHAR, Nullable)
     - `email` (VARCHAR, Nullable)
   - Save the table
5. **Verify table appears** on the canvas
6. **Edit table**:
   - Click on the table
   - Modify column properties
   - Add/remove columns
   - Save changes
7. **Verify changes persist** (refresh page if needed)

### Test Scenario 2: Create Relationships

1. **Create two tables**:
   - "Users" table
   - "Orders" table
2. **Create relationship**:
   - Drag from "Users" table to "Orders" table
   - Or use "Create Relationship" button
   - Select relationship type (one-to-many)
   - Configure cardinality
   - Save relationship
3. **Verify relationship** appears on canvas with crow's feet notation
4. **Edit relationship**:
   - Click on the relationship edge
   - Modify cardinality or type
   - Save changes

### Test Scenario 3: Domain Organization

1. **Switch between domains**:
   - Click on domain tabs (Conceptual, Logical, Physical)
   - Verify tables appear/disappear based on domain
2. **Verify primary domain editing**:
   - Tables should be editable only on their primary domain
   - Tables on non-primary domains should show "RO" (read-only) badge

### Test Scenario 4: Import/Export

1. **Import ODCS file**:
   - Click "Import/Export" button
   - Select "Import" tab
   - Choose "ODCS 3.1.0" format
   - Upload a YAML file or paste content
   - Verify tables are imported correctly
2. **Export to ODCS**:
   - Click "Import/Export" button
   - Select "Export" tab
   - Choose "ODCS 3.1.0" format
   - Click "Export"
   - Verify file downloads with correct content
3. **Test other formats**:
   - SQL (PostgreSQL, MySQL, SQLite)
   - AVRO Schema
   - JSON Schema
   - Protobuf Schema

### Test Scenario 5: Offline Mode

1. **Disconnect from API** (or don't start API server):
   - App should detect offline mode
   - Should show offline indicator
2. **Create/edit tables**:
   - Should work locally
   - Changes saved to IndexedDB/localStorage
3. **Export to file**:
   - Should work using WASM SDK
   - File should download correctly
4. **Reconnect**:
   - Changes should sync when API becomes available

### Test Scenario 6: Validation

1. **Create circular relationship**:
   - Create relationship: Users → Orders
   - Create relationship: Orders → Users
   - Verify warning appears
2. **Create orphaned relationship**:
   - Create relationship to non-existent table
   - Verify validation error
3. **Duplicate table names**:
   - Create two tables with same name in same domain
   - Verify validation error

## Browser Console Testing

Open browser DevTools (F12) and check:

- **No errors** in console
- **Network requests** (if API is running)
- **IndexedDB** storage (Application tab → Storage → IndexedDB)
- **LocalStorage** (Application tab → Storage → Local Storage)

## Electron Testing

### Run Electron App

```bash
# Development mode (with hot reload)
npm run electron:dev

# Build and run
npm run build
npm run electron
```

### Test Electron Features

1. **Native file dialogs**:
   - File → Open
   - File → Save
2. **File system access**:
   - Open ODCS file from disk
   - Save to disk
3. **Offline mode**:
   - Works without API
   - Uses native file system

## Troubleshooting

### Application Won't Start

- Check Node.js version: `node --version` (should be 20+)
- Clear cache: `rm -rf node_modules && npm install`
- Check port 5173 is available: `lsof -i :5173`

### Tests Failing

- Run `npm test` to see detailed errors
- Check test coverage: `npm run test:coverage`
- Verify all dependencies installed: `npm install`

### API Connection Issues

- Verify API is running: `curl http://localhost:8081/api/v1/health`
- Check `.env.local` configuration
- App will fallback to offline mode automatically

### Build Issues

- Run type check: `npm run type-check`
- Run linter: `npm run lint`
- Check for TypeScript errors: `npx tsc --noEmit`

## Test Coverage

Current test coverage: **95%+** (per constitution requirement)

- Unit tests: `tests/unit/`
- Integration tests: `tests/integration/`
- E2E tests: `tests/e2e/` (when implemented)

Run coverage report:
```bash
npm run test:coverage
```

