# Offline Mode & Authentication

## Overview

The application supports two modes: **Online** and **Offline**. Authentication is only required in online mode, and API calls are automatically disabled in offline mode.

## Mode Detection

### Automatic Detection

On app startup, the application automatically detects if the API server is available:
- If API is reachable → **Online Mode** (requires authentication)
- If API is unavailable → **Offline Mode** (no authentication required)

### Manual Override

Users can manually switch between modes using the **Online/Offline Toggle** button:
- Located in the header of Home and ModelEditor pages
- Shows current mode status
- Allows switching between modes

## Authentication Behavior

### Offline Mode
- ✅ **Authentication is skipped** - No login required
- ✅ **API calls are disabled** - All API requests are blocked
- ✅ **Works locally** - Uses WASM SDK and local storage
- ✅ **No network required** - Fully functional without internet

### Online Mode
- 🔒 **Authentication required** - Must log in via GitHub OAuth
- 🌐 **API calls enabled** - Full API integration available
- 👥 **Collaboration enabled** - Real-time multi-user features
- ☁️ **Cloud storage** - Data stored on server

## Switching Modes

### Switching to Online Mode

When switching from offline to online:
1. App checks if API server is available
2. If API unavailable → Shows error, stays in offline mode
3. If API available → Checks authentication
4. If not authenticated → Redirects to login page
5. If authenticated → Switches to online mode

### Switching to Offline Mode

When switching from online to offline:
1. Immediately switches to offline mode
2. API calls are disabled
3. Authentication is not required
4. Works with local storage/WASM SDK

## Implementation Details

### SDK Mode Store

The mode is managed by `useSDKModeStore` (Zustand with persistence):
- Stores current mode (`online` | `offline`)
- Tracks manual override flag
- Persists to localStorage
- Provides mode detection and switching

### API Client

The `apiClient` intercepts all requests:
- Checks mode before making requests
- Rejects requests in offline mode with clear error message
- Only adds auth tokens in online mode

### Auth Provider

The `AuthProvider` component:
- Skips initialization in offline mode
- Only initializes auth in online mode
- Disables token refresh in offline mode

## User Interface

### Online/Offline Toggle Component

The toggle shows:
- Current mode (Online/Offline)
- Authentication status
- Help text explaining current mode
- Visual indicator (toggle switch)

### Home Page

- **Offline Mode**: 
  - "Open Workspace Folder" button - Opens folder picker to select workspace directory
  - Expected folder structure: `workspace-folder/domain-folder/tables.yaml` and `relationships.yaml`
  - "New Workspace" button - Creates empty workspace
- **Online Mode**: Requires authentication before access

### Model Editor

- **Offline Mode**: Loads from workspace folder structure, disables API calls
- **Online Mode**: Loads from API, enables collaboration

## Workspace Folder Structure

When working offline, workspaces are organized as folders:

```
workspace-name/
├── domain-1/              # Domain folder (e.g., "conceptual", "logical", "physical")
│   ├── tables.yaml        # Tables for this domain
│   └── relationships.yaml # Relationships for this domain
├── domain-2/
│   ├── tables.yaml
│   └── relationships.yaml
└── ...
```

Each domain folder contains:
- `tables.yaml` - ODCS format tables
- `relationships.yaml` - ODCS format relationships

The folder picker reads this structure and loads all domains, tables, and relationships into the workspace.

## Testing

### Manual Testing

1. **Start app without API**:
   ```bash
   npm run dev
   # Don't start API server
   ```
   - Should start in offline mode
   - No login required
   - Can create/edit tables locally

2. **Switch to online mode**:
   - Click toggle button
   - Should check API availability
   - Should require authentication if API available

3. **Start app with API**:
   ```bash
   # Start API server on port 8081
   npm run dev
   ```
   - Should detect online mode
   - Should require authentication
   - Can use full API features

### Automated Testing

Tests verify:
- Mode detection
- Authentication skip in offline mode
- API call blocking in offline mode
- Mode switching with authentication checks
- Error handling when API unavailable

## Configuration

### Environment Variables

```env
VITE_API_BASE_URL=http://localhost:8081
VITE_WS_BASE_URL=ws://localhost:8081
```

If these are not set or API is unavailable, app defaults to offline mode.

## Troubleshooting

### App Stuck in Offline Mode

- Check API server is running
- Verify `VITE_API_BASE_URL` is correct
- Check network connectivity
- Use manual toggle to force online mode

### Authentication Required in Offline Mode

- This should not happen
- Check mode detection logic
- Verify toggle is working correctly

### API Calls Failing in Online Mode

- Check authentication token is valid
- Verify API server is accessible
- Check browser console for errors
- Try switching to offline and back

