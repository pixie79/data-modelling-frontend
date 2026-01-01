# API and SDK Integration Guide

This document describes how the frontend integrates with the Data Modelling API and SDK.

## API Endpoints

The API is available at `/api/v1` (configurable via `VITE_API_BASE_URL`).

### Base Structure

All endpoints require JWT authentication via `Authorization: Bearer <token>` header.

### Workspace Endpoints

- `GET /api/v1/workspace/info` - Get current workspace information
- `GET /api/v1/workspace/profiles` - List user profiles
- `POST /api/v1/workspace/create` - Create a new workspace

### Domain Endpoints

- `GET /api/v1/workspace/domains` - List all domains
- `POST /api/v1/workspace/domains` - Create a new domain
- `GET /api/v1/workspace/domains/{domain}` - Get domain information
- `PUT /api/v1/workspace/domains/{domain}` - Update domain
- `DELETE /api/v1/workspace/domains/{domain}` - Delete domain
- `POST /api/v1/workspace/load-domain` - Load a domain into the model service

### Table Endpoints (Domain-scoped)

- `GET /api/v1/workspace/domains/{domain}/tables` - List all tables in domain
- `POST /api/v1/workspace/domains/{domain}/tables` - Create a table
- `GET /api/v1/workspace/domains/{domain}/tables/{table_id}` - Get a table
- `PUT /api/v1/workspace/domains/{domain}/tables/{table_id}` - Update a table
- `DELETE /api/v1/workspace/domains/{domain}/tables/{table_id}` - Delete a table
- `PUT /api/v1/workspace/domains/{domain}/tables/{table_id}/position` - Update table position

### Relationship Endpoints (Domain-scoped)

- `GET /api/v1/workspace/domains/{domain}/relationships` - List all relationships in domain
- `POST /api/v1/workspace/domains/{domain}/relationships` - Create a relationship
- `GET /api/v1/workspace/domains/{domain}/relationships/{relationship_id}` - Get a relationship
- `PUT /api/v1/workspace/domains/{domain}/relationships/{relationship_id}` - Update a relationship
- `DELETE /api/v1/workspace/domains/{domain}/relationships/{relationship_id}` - Delete a relationship
- `POST /api/v1/workspace/domains/{domain}/relationships/check-circular` - Check for circular dependencies

### Import/Export Endpoints

- `POST /api/v1/import/sql` - Import from SQL
- `POST /api/v1/import/odcs` - Import from ODCS
- `POST /api/v1/import/json-schema` - Import from JSON Schema
- `POST /api/v1/import/avro` - Import from AVRO
- `POST /api/v1/import/protobuf` - Import from Protobuf
- `GET /api/v1/export/drawio/{domain}` - Export to Draw.io format
- `GET /api/v1/export/odcs/{domain}` - Export to ODCS format

### Authentication Endpoints

- `POST /api/v1/auth/login` - Login with credentials
- `POST /api/v1/auth/refresh` - Refresh JWT token
- `GET /api/v1/auth/github` - Initiate GitHub OAuth
- `GET /api/v1/auth/github/callback` - GitHub OAuth callback
- `POST /api/v1/auth/logout` - Logout

### OpenAPI Documentation

- `GET /api/v1/openapi.json` - OpenAPI 3.0 specification

## SDK Integration

The SDK is a Rust library compiled to WASM for browser use. It provides:

### Storage Backends

1. **BrowserStorageBackend** (WASM feature)
   - Uses IndexedDB/localStorage
   - For offline mode in browser

2. **ApiStorageBackend** (api-backend feature, default)
   - HTTP API client
   - For online mode

3. **FileSystemStorageBackend** (native-fs feature)
   - File system operations
   - For Electron desktop app

### Importers

- `ODCSImporter` - Primary format (ODCS v3.1.0)
- `SQLImporter` - SQL DDL parsing
- `JSONSchemaImporter` - JSON Schema conversion
- `AvroImporter` - AVRO schema conversion
- `ProtobufImporter` - Protobuf .proto conversion

### Exporters

- `ODCSExporter` - Export to ODCS v3.1.0
- `SQLExporter` - Generate SQL DDL
- `JSONSchemaExporter` - Export to JSON Schema
- `AvroExporter` - Export to AVRO schema
- `ProtobufExporter` - Export to Protobuf .proto

### Validation

- `TableValidator` - Table name validation, naming conflicts
- `RelationshipValidator` - Relationship validation, circular dependency detection
- `InputValidator` - Input validation (names, UUIDs, SQL identifiers)

### Model Management

- `ModelLoader` - Load models from storage backends
- `ModelSaver` - Save models to storage backends
- `ApiModelLoader` - Load models via HTTP API

## Frontend Integration Points

### API Client (`src/services/api/apiClient.ts`)

- Base URL: `VITE_API_BASE_URL` (default: `http://localhost:8081/api/v1`)
- JWT token management with automatic refresh
- Request/response interceptors for error handling

### SDK Loader (`src/services/sdk/sdkLoader.ts`)

- WASM module loading
- SDK initialization
- Feature detection (browser vs Electron)

### Platform Abstraction (`src/services/platform/`)

- `BrowserPlatformService` - Browser-specific operations
- `ElectronPlatformService` - Electron-specific operations
- File system access abstraction

## Usage Examples

### Loading a Model via API

```typescript
import { workspaceService } from '@/services/api/workspaceService';
import { tableService } from '@/services/api/tableService';

// Load domain
await workspaceService.loadDomain('domain-1');

// Fetch tables
const tables = await tableService.listTables('domain-1');
```

### Importing via SDK

```typescript
import { sdkLoader } from '@/services/sdk/sdkLoader';
import { importExportService } from '@/services/sdk/importExportService';

// Import SQL
const workspace = await importExportService.importFromSQL(sqlContent, 'postgresql');
```

### Offline Mode with Browser Storage

```typescript
import { sdkLoader } from '@/services/sdk/sdkLoader';

const sdk = await sdkLoader.load();
// Use BrowserStorageBackend for offline operations
```

## Error Handling

- API errors return HTTP status codes with error messages
- SDK errors throw exceptions with descriptive messages
- Network errors trigger offline mode fallback
- Validation errors provide field-level feedback

## Authentication Flow

1. User authenticates via GitHub OAuth or credentials
2. API returns JWT access token and refresh token
3. Frontend stores tokens securely (httpOnly cookies or secure storage)
4. API client automatically includes token in requests
5. Token refresh happens automatically before expiration
6. On refresh failure, user is logged out and redirected to login

## Offline Mode

1. Detect network unavailability
2. Switch to BrowserStorageBackend
3. Queue operations for sync when online
4. Use IndexedDB for local storage
5. Sync changes when connection restored

