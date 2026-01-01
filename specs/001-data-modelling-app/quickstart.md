# Quick Start Guide

**Date**: 2025-12-31  
**Feature**: Data Modelling Web Application

## Overview

This guide provides step-by-step instructions for getting started with the data modelling web application. It covers setup, basic usage, and common workflows.

## Prerequisites

- Node.js 20+ (LTS version)
- npm or pnpm package manager
- Modern web browser (Chrome, Firefox, Safari, Edge - latest 2 versions)
- data-modelling-api running (for online mode)
- Git (for offline GIT export)

## Setup

### 1. Install Dependencies

```bash
cd frontend
npm install
# or
pnpm install
```

### 2. Configure Environment

Create `.env.local` file:

```env
VITE_API_BASE_URL=http://localhost:8081
VITE_WS_BASE_URL=ws://localhost:8081
```

### 3. Start Development Server

```bash
npm run dev
# or
pnpm dev
```

The application will be available at `http://localhost:5173`

### 4. Build for Production

```bash
npm run build
# or
pnpm build
```

## Basic Usage

### Creating a Workspace

1. Open the application in your browser
2. Click "Create New Workspace"
3. Enter a workspace name
4. Choose workspace type:
   - **Personal**: Only you can access
   - **Shared**: Multiple users can collaborate
5. Click "Create"

### Adding Tables to a Canvas

1. Select a domain canvas tab (Conceptual, Logical, or Physical)
2. Click "Add Table" button or use keyboard shortcut
3. Enter table name and properties
4. Drag the table to position it on the canvas
5. Resize by dragging corners

### Editing Table Properties

1. Click on a table to select it
2. Open the table editor panel
3. Add/edit columns:
   - Column name
   - Data type (VARCHAR, INTEGER, etc.)
   - Nullable flag
   - Primary key flag
   - Foreign key reference
4. Click "Save" to persist changes

### Creating Relationships

1. Select two tables on the canvas
2. Click "Create Relationship" or drag from source to target table
3. Configure relationship properties:
   - Cardinality (one-to-one, one-to-many, many-to-many)
   - Optionality (required, optional)
   - Source and target columns
4. Relationship appears with crow's feet notation

### Creating Data Flow Diagrams

1. Switch to "Data Flow" view
2. Add flow nodes:
   - Click "Add Node" and select type (database, Kafka topic, API, etc.)
   - Position nodes on canvas
3. Connect nodes:
   - Drag from source to target node
   - Add labels to connections
4. Link to conceptual tables:
   - Select a flow node
   - Click "Link to Table"
   - Choose conceptual table from workspace

### Working Offline

1. Disconnect from internet or close API connection
2. Application automatically switches to offline mode
3. Create/edit models as normal
4. Changes are stored locally
5. Save workspace:
   - Click "Save" → "Save Locally"
   - Choose file location
   - File saved in ODCS 3.1.0 format

### Loading Offline Files

1. Click "Load Workspace" → "Load from File"
2. Select ODCS YAML file
3. Workspace loads with all tables and relationships
4. Continue editing offline or sync when online

### Collaborating Online

1. Open a shared workspace
2. WebSocket connection establishes automatically
3. See other users' presence indicators
4. Changes appear in real-time (within 2 seconds)
5. Conflicts resolved via last-change-wins strategy

## Common Workflows

### Workflow 1: Create Conceptual Model

1. Create new workspace
2. Select "Conceptual" domain tab
3. Add tables representing business entities
4. Define relationships between entities
5. Save workspace

**Expected Result**: Conceptual data model with tables and relationships

---

### Workflow 2: Convert Conceptual to Logical Model

1. Open workspace with conceptual model
2. Switch to "Logical" domain tab
3. Tables appear with logical notation
4. Add logical-specific attributes (normalization, etc.)
5. Refine relationships

**Expected Result**: Logical data model derived from conceptual

---

### Workflow 3: Create Physical Model

1. Open workspace with logical model
2. Switch to "Physical" domain tab
3. Tables appear with physical notation
4. Add physical-specific details (indexes, constraints, etc.)
5. Map to actual database schema

**Expected Result**: Physical data model ready for implementation

---

### Workflow 4: Document Data Flow

1. Open workspace with conceptual model
2. Switch to "Data Flow" view
3. Add source database node
4. Add processing nodes (Kafka topics, APIs)
5. Add target database node
6. Connect nodes with flow arrows
7. Link flow to conceptual tables

**Expected Result**: Data flow diagram showing data movement

---

### Workflow 5: Collaborate on Shared Workspace

1. Create shared workspace
2. Invite collaborators via email/GitHub username
3. Collaborators receive invitation
4. Multiple users edit simultaneously
5. See real-time updates from other users
6. Presence indicators show who's editing what

**Expected Result**: Collaborative editing session with real-time updates

---

### Workflow 6: Work Offline and Sync

1. Start editing workspace online
2. Disconnect from internet
3. Continue editing (changes stored locally)
4. Reconnect to internet
5. Application attempts automatic merge
6. Review conflicts if any
7. Sync completes

**Expected Result**: Offline changes merged with online changes

---

### Workflow 7: Export to GIT

1. Open workspace
2. Click "Export" → "Export to GIT"
3. Choose repository location
4. Workspace exported as ODCS files
5. Commit to GIT repository
6. Use GIT for conflict resolution

**Expected Result**: Workspace exported to GIT repository

## Keyboard Shortcuts

- `N`: Create new table
- `R`: Create new relationship
- `Delete`: Delete selected element
- `Ctrl+S` / `Cmd+S`: Save workspace
- `Ctrl+Z` / `Cmd+Z`: Undo
- `Ctrl+Y` / `Cmd+Y`: Redo
- `Ctrl+F` / `Cmd+F`: Search tables
- `+` / `-`: Zoom in/out
- `Space + Drag`: Pan canvas

## Troubleshooting

### Application Won't Start

- Check Node.js version: `node --version` (should be 20+)
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`
- Check port 5173 is available

### API Connection Failed

- Verify data-modelling-api is running on port 8081
- Check `.env.local` configuration
- Verify CORS settings in API

### WebSocket Connection Failed

- Check API WebSocket endpoint is accessible
- Verify JWT token is valid
- Check browser console for errors

### Offline Mode Not Working

- Check browser supports IndexedDB
- Verify file system access permissions
- Check browser console for errors

### Changes Not Syncing

- Verify internet connection
- Check WebSocket connection status
- Review browser console for sync errors
- Try manual sync: Click "Sync Now"

## Next Steps

- Read [Architecture Documentation](../ARCHITECTURE.md) for technical details
- Review [API Contracts](./contracts/api-contracts.md) for API integration
- Check [Data Model](./data-model.md) for entity relationships
- Explore [User Guide](../USER_GUIDE.md) for advanced features

