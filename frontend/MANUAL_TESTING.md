# Manual Testing Guide - User Story 1

## Overview

This guide provides step-by-step instructions for manually testing User Story 1: Core Data Modelling features.

## Prerequisites

1. **Start the development server**:
   ```bash
   cd frontend
   npm run dev
   ```

2. **Optional: Start the API server** (for online mode testing):
   ```bash
   # In another terminal, start the data-modelling-api
   # The API should run on http://localhost:8081
   ```

3. **Open browser** to `http://localhost:5173`

**Note**: The app will automatically start in **offline mode** if the API is not running. No authentication is required in offline mode.

## Mode Testing

### Test Scenario 0: Offline Mode (No Authentication)

**Objective**: Verify app works without API and authentication

**Steps**:
1. Start app **without** API server running
2. App should detect offline mode automatically
3. Verify "Offline" mode indicator is shown
4. Verify "Auth not required" message is displayed
5. Verify you can access the app without logging in
6. Click "Open Workspace Folder" button
7. Select a folder with structure: `workspace-name/domain-folder/tables.yaml` and `relationships.yaml`
8. Verify workspace loads with all domains, tables, and relationships
9. Create a table (should work locally)
10. Export to ODCS file (should work)

**Expected Results**:
- ✅ App starts in offline mode
- ✅ No login screen appears
- ✅ Folder picker opens when clicking "Open Workspace Folder"
- ✅ Workspace loads from folder structure correctly
- ✅ All domains, tables, and relationships are loaded
- ✅ Can create/edit tables locally
- ✅ Export works using WASM SDK
- ✅ No API calls are made

### Test Scenario 0.5: Switch to Online Mode

**Objective**: Verify mode switching requires authentication

**Steps**:
1. Start app in offline mode (no API)
2. Click "Online/Offline Toggle" button
3. Verify error message: "API server is not available"
4. Start API server
5. Click toggle again
6. Verify redirect to login page
7. Complete authentication
8. Verify switch to online mode

**Expected Results**:
- ✅ Toggle checks API availability
- ✅ Shows error if API unavailable
- ✅ Requires authentication when switching to online
- ✅ Successfully switches after authentication

## Test Scenarios

### Scenario 1: Basic Table Creation

**Objective**: Verify tables can be created and displayed on the canvas

**Steps**:
1. Open the application
2. Create or select a workspace
3. Select a domain (Conceptual, Logical, or Physical)
4. Click "Add Table" button (or use keyboard shortcut)
5. Enter table name: "Users"
6. Add columns:
   - `id` (UUID, Primary Key, Not Null)
   - `name` (VARCHAR, Nullable)
   - `email` (VARCHAR, Nullable)
7. Click "Save"
8. Verify table appears on canvas
9. Verify table shows columns correctly

**Expected Results**:
- ✅ Table appears on canvas
- ✅ Table shows name "Users"
- ✅ Columns are displayed
- ✅ Primary key indicator (PK) is visible
- ✅ Table can be selected

### Scenario 2: Table Editing

**Objective**: Verify tables can be edited after creation

**Steps**:
1. Click on the "Users" table
2. Table editor panel should open
3. Modify table name to "UserAccounts"
4. Add a new column: `created_at` (TIMESTAMP, Nullable)
5. Remove the `email` column
6. Save changes
7. Verify changes are reflected on canvas

**Expected Results**:
- ✅ Table name updates
- ✅ New column appears
- ✅ Removed column disappears
- ✅ Changes persist after page refresh

### Scenario 3: Relationship Creation

**Objective**: Verify relationships can be created between tables

**Steps**:
1. Create a second table: "Orders"
2. Add columns to Orders:
   - `id` (UUID, Primary Key)
   - `user_id` (UUID, Foreign Key)
   - `total` (DECIMAL)
3. Create relationship:
   - Drag from "Users" table to "Orders" table
   - OR click "Create Relationship" button
4. Configure relationship:
   - Type: One-to-Many
   - Source: Users.id
   - Target: Orders.user_id
   - Cardinality: 1 to N
5. Save relationship
6. Verify relationship appears on canvas

**Expected Results**:
- ✅ Relationship edge appears between tables
- ✅ Crow's feet notation is displayed correctly
- ✅ Relationship shows cardinality indicators
- ✅ Relationship can be selected and edited

### Scenario 4: Domain Switching

**Objective**: Verify domain-based organization works correctly

**Steps**:
1. Create tables in Conceptual domain
2. Switch to Logical domain tab
3. Verify tables appear/disappear based on domain
4. Switch to Physical domain tab
5. Verify domain-specific view
6. Switch back to Conceptual domain

**Expected Results**:
- ✅ Domain tabs work correctly
- ✅ Tables filter by domain
- ✅ Primary domain indicator is visible
- ✅ Read-only badge appears on non-primary domains

### Scenario 5: Import ODCS File

**Objective**: Verify ODCS import functionality

**Steps**:
1. Create a test ODCS YAML file:
   ```yaml
   workspace:
     name: Test Workspace
   tables:
     - name: Products
       columns:
         - name: id
           data_type: UUID
           is_primary_key: true
         - name: name
           data_type: VARCHAR
   ```
2. Click "Import/Export" button
3. Select "Import" tab
4. Choose "ODCS 3.1.0" format
5. Click "Upload File" and select the YAML file
6. Verify tables are imported

**Expected Results**:
- ✅ File upload works
- ✅ Tables are imported correctly
- ✅ Columns are imported correctly
- ✅ No errors in console

### Scenario 6: Export to ODCS

**Objective**: Verify ODCS export functionality

**Steps**:
1. Create a table with columns
2. Click "Import/Export" button
3. Select "Export" tab
4. Choose "ODCS 3.1.0" format
5. Click "Export"
6. Verify file downloads
7. Open downloaded file and verify content

**Expected Results**:
- ✅ File downloads successfully
- ✅ File contains correct YAML structure
- ✅ Tables and columns are exported correctly

### Scenario 7: Offline Mode

**Objective**: Verify offline mode works without API

**Steps**:
1. Stop the API server (if running)
2. Refresh the browser
3. Verify app detects offline mode
4. Create a new table
5. Add columns
6. Export to ODCS file
7. Verify file downloads correctly

**Expected Results**:
- ✅ App switches to offline mode
- ✅ Tables can be created locally
- ✅ Export works using WASM SDK
- ✅ No API errors in console

### Scenario 8: Validation

**Objective**: Verify validation works correctly

**Steps**:
1. Create circular relationship:
   - Users → Orders
   - Orders → Users
2. Verify warning appears
3. Create duplicate table names in same domain
4. Verify validation error
5. Create relationship to non-existent table
6. Verify validation error

**Expected Results**:
- ✅ Circular relationship warning appears
- ✅ Duplicate name validation works
- ✅ Orphaned relationship validation works
- ✅ Errors are displayed clearly

## Browser Console Checks

Open DevTools (F12) and verify:

- ✅ No errors in console
- ✅ Network requests succeed (if API running)
- ✅ IndexedDB storage works (Application tab)
- ✅ LocalStorage works (Application tab)

## Keyboard Shortcuts

Test these shortcuts:

- `N` - New table
- `R` - Create relationship
- `Delete` - Delete selected table/relationship
- `Space + Drag` - Pan canvas
- `Ctrl/Cmd + Z` - Undo
- `Ctrl/Cmd + Y` - Redo

## Electron Testing

### Run Electron App

```bash
npm run electron:dev
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

## Reporting Issues

If you find issues during manual testing:

1. Note the exact steps to reproduce
2. Check browser console for errors
3. Check network tab for failed requests
4. Take screenshots if applicable
5. Report in GitHub Issues

## Test Checklist

- [ ] Tables can be created
- [ ] Tables can be edited
- [ ] Tables can be deleted
- [ ] Relationships can be created
- [ ] Relationships show correct notation
- [ ] Domain switching works
- [ ] Import ODCS works
- [ ] Export ODCS works
- [ ] Offline mode works
- [ ] Validation works
- [ ] Keyboard shortcuts work
- [ ] No console errors
- [ ] Performance is acceptable

