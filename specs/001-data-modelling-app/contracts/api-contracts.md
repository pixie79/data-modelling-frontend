# API Contracts

**Date**: 2025-12-31  
**Feature**: Data Modelling Web Application

## Overview

This document defines the API contracts between the React frontend and the data-modelling-api backend. The API follows RESTful principles and uses JSON for request/response bodies.

## Base URL

- **Development**: `http://localhost:8081`
- **Production**: `[TBD]`

## Authentication

All authenticated endpoints require a JWT token in the `Authorization` header:

```
Authorization: Bearer <access_token>
```

## WebSocket Endpoint

- **URL**: `ws://localhost:8081/api/v1/ws/{workspace_id}`
- **Authentication**: JWT token passed as query parameter `?token=<access_token>`
- **Protocol**: Native WebSocket (no Socket.io)

## Endpoints

### Authentication

#### `GET /api/v1/auth/github/login`
Initiates GitHub OAuth flow (web).

**Query Parameters**:
- `redirect_uri` (string, optional): Frontend URL to redirect to after OAuth completion. If not provided, API will use a default. Should be the full URL including protocol and port (e.g., `http://localhost:5173/auth/complete`).

**Response**: `302 Redirect` to GitHub authorization page

**Note**: The `redirect_uri` parameter allows multiple frontend instances (on different ports) to use the same API. The frontend should dynamically determine its own URL using `window.location.origin` and pass it as `redirect_uri`.

---

#### `GET /api/v1/auth/github/login/desktop`
Initiates GitHub OAuth flow (desktop).

**Response**: `302 Redirect` to GitHub authorization page

---

#### `GET /api/v1/auth/github/callback`
Handles GitHub OAuth callback.

**Query Parameters**:
- `code` (string, required): Authorization code from GitHub
- `state` (string, required): CSRF state token

**Response**: `302 Redirect` to the `redirect_uri` specified during login initiation, with `code` and optional `select_email` query parameters. If no `redirect_uri` was provided, redirects to a default frontend URL.

**Example Redirect**: `{redirect_uri}?code={auth_code}&select_email=true`

---

#### `POST /api/v1/auth/refresh`
Refreshes an access token.

**Request Body**:
```json
{
  "refresh_token": "string"
}
```

**Response**: `200 OK`
```json
{
  "access_token": "string",
  "refresh_token": "string",
  "access_token_expires_at": 1234567890,
  "refresh_token_expires_at": 1234567890,
  "token_type": "Bearer"
}
```

---

#### `POST /api/v1/auth/logout`
Revokes the current session.

**Response**: `200 OK`

---

### Workspaces

#### `GET /api/v1/workspaces`
List all workspaces for the authenticated user.

**Response**: `200 OK`
```json
{
  "workspaces": [
    {
      "id": "uuid",
      "name": "string",
      "type": "personal" | "shared",
      "owner_id": "uuid",
      "created_at": "2025-12-31T00:00:00Z",
      "last_modified_at": "2025-12-31T00:00:00Z"
    }
  ]
}
```

---

#### `POST /api/v1/workspaces`
Create a new workspace.

**Request Body**:
```json
{
  "name": "string",
  "type": "personal" | "shared"
}
```

**Response**: `201 Created`
```json
{
  "id": "uuid",
  "name": "string",
  "type": "personal" | "shared",
  "owner_id": "uuid",
  "created_at": "2025-12-31T00:00:00Z",
  "last_modified_at": "2025-12-31T00:00:00Z"
}
```

---

#### `GET /api/v1/workspaces/{workspace_id}`
Get workspace details.

**Response**: `200 OK`
```json
{
  "id": "uuid",
  "name": "string",
  "type": "personal" | "shared",
  "owner_id": "uuid",
  "created_at": "2025-12-31T00:00:00Z",
  "last_modified_at": "2025-12-31T00:00:00Z"
}
```

---

#### `PUT /api/v1/workspaces/{workspace_id}`
Update workspace.

**Request Body**:
```json
{
  "name": "string",
  "type": "personal" | "shared"
}
```

**Response**: `200 OK` (same as GET)

---

#### `DELETE /api/v1/workspaces/{workspace_id}`
Delete workspace.

**Response**: `204 No Content`

---

### Domains

#### `GET /api/v1/workspaces/{workspace_id}/domains`
List all domains in a workspace.

**Response**: `200 OK`
```json
{
  "domains": [
    {
      "id": "uuid",
      "workspace_id": "uuid",
      "name": "string",
      "model_type": "conceptual" | "logical" | "physical",
      "is_primary": false,
      "created_at": "2025-12-31T00:00:00Z",
      "last_modified_at": "2025-12-31T00:00:00Z"
    }
  ]
}
```

---

#### `POST /api/v1/workspaces/{workspace_id}/domains`
Create a new domain.

**Request Body**:
```json
{
  "name": "string",
  "model_type": "conceptual" | "logical" | "physical"
}
```

**Response**: `201 Created` (same structure as GET item)

---

#### `GET /api/v1/workspaces/{workspace_id}/domains/{domain_id}`
Get domain details.

**Response**: `200 OK` (same structure as GET item)

---

#### `PUT /api/v1/workspaces/{workspace_id}/domains/{domain_id}`
Update domain.

**Request Body**:
```json
{
  "name": "string",
  "model_type": "conceptual" | "logical" | "physical"
}
```

**Response**: `200 OK` (same structure as GET item)

---

#### `DELETE /api/v1/workspaces/{workspace_id}/domains/{domain_id}`
Delete domain.

**Response**: `204 No Content`

---

### Tables

#### `GET /api/v1/workspaces/{workspace_id}/tables`
List all tables in a workspace.

**Query Parameters**:
- `domain_id` (uuid, optional): Filter by domain

**Response**: `200 OK`
```json
{
  "tables": [
    {
      "id": "uuid",
      "workspace_id": "uuid",
      "primary_domain_id": "uuid",
      "name": "string",
      "alias": "string",
      "model_type": "conceptual" | "logical" | "physical",
      "position_x": 0,
      "position_y": 0,
      "width": 200,
      "height": 150,
      "visible_domains": ["uuid"],
      "columns": [
        {
          "id": "uuid",
          "table_id": "uuid",
          "name": "string",
          "data_type": "string",
          "nullable": false,
          "is_primary_key": false,
          "is_foreign_key": false,
          "foreign_key_reference": "uuid",
          "default_value": "string",
          "constraints": {},
          "order": 0
        }
      ],
      "created_at": "2025-12-31T00:00:00Z",
      "last_modified_at": "2025-12-31T00:00:00Z"
    }
  ]
}
```

---

#### `POST /api/v1/workspaces/{workspace_id}/tables`
Create a new table.

**Request Body**:
```json
{
  "primary_domain_id": "uuid",
  "name": "string",
  "alias": "string",
  "model_type": "conceptual" | "logical" | "physical",
  "position_x": 0,
  "position_y": 0,
  "width": 200,
  "height": 150,
  "columns": [
    {
      "name": "string",
      "data_type": "string",
      "nullable": false,
      "is_primary_key": false,
      "order": 0
    }
  ]
}
```

**Response**: `201 Created` (same structure as GET item)

---

#### `GET /api/v1/workspaces/{workspace_id}/tables/{table_id}`
Get table details.

**Response**: `200 OK` (same structure as GET item)

---

#### `PUT /api/v1/workspaces/{workspace_id}/tables/{table_id}`
Update table.

**Request Body**: (same as POST, all fields optional)

**Response**: `200 OK` (same structure as GET item)

---

#### `DELETE /api/v1/workspaces/{workspace_id}/tables/{table_id}`
Delete table.

**Response**: `204 No Content`

---

### Relationships

#### `GET /api/v1/workspaces/{workspace_id}/relationships`
List all relationships in a workspace.

**Response**: `200 OK`
```json
{
  "relationships": [
    {
      "id": "uuid",
      "workspace_id": "uuid",
      "source_table_id": "uuid",
      "target_table_id": "uuid",
      "cardinality": "one-to-one" | "one-to-many" | "many-to-many",
      "optionality": "required" | "optional",
      "name": "string",
      "source_column_id": "uuid",
      "target_column_id": "uuid",
      "is_circular": false,
      "created_at": "2025-12-31T00:00:00Z"
    }
  ]
}
```

---

#### `POST /api/v1/workspaces/{workspace_id}/relationships`
Create a new relationship.

**Request Body**:
```json
{
  "source_table_id": "uuid",
  "target_table_id": "uuid",
  "cardinality": "one-to-one" | "one-to-many" | "many-to-many",
  "optionality": "required" | "optional",
  "name": "string",
  "source_column_id": "uuid",
  "target_column_id": "uuid"
}
```

**Response**: `201 Created` (same structure as GET item)

---

#### `GET /api/v1/workspaces/{workspace_id}/relationships/{relationship_id}`
Get relationship details.

**Response**: `200 OK` (same structure as GET item)

---

#### `PUT /api/v1/workspaces/{workspace_id}/relationships/{relationship_id}`
Update relationship.

**Request Body**: (same as POST, all fields optional)

**Response**: `200 OK` (same structure as GET item)

---

#### `DELETE /api/v1/workspaces/{workspace_id}/relationships/{relationship_id}`
Delete relationship.

**Response**: `204 No Content`

---

### Data Flow Diagrams

#### `GET /api/v1/workspaces/{workspace_id}/data-flow-diagrams`
List all data flow diagrams in a workspace.

**Response**: `200 OK`
```json
{
  "diagrams": [
    {
      "id": "uuid",
      "workspace_id": "uuid",
      "name": "string",
      "nodes": [
        {
          "id": "uuid",
          "diagram_id": "uuid",
          "type": "database" | "kafka_topic" | "api" | "processor" | "target",
          "name": "string",
          "position_x": 0,
          "position_y": 0,
          "icon": "string",
          "metadata": {}
        }
      ],
      "connections": [
        {
          "id": "uuid",
          "diagram_id": "uuid",
          "source_node_id": "uuid",
          "target_node_id": "uuid",
          "label": "string",
          "direction": "forward" | "bidirectional"
        }
      ],
      "linked_tables": ["uuid"],
      "created_at": "2025-12-31T00:00:00Z",
      "last_modified_at": "2025-12-31T00:00:00Z"
    }
  ]
}
```

---

#### `POST /api/v1/workspaces/{workspace_id}/data-flow-diagrams`
Create a new data flow diagram.

**Request Body**:
```json
{
  "name": "string",
  "nodes": [],
  "connections": [],
  "linked_tables": []
}
```

**Response**: `201 Created` (same structure as GET item)

---

#### `GET /api/v1/workspaces/{workspace_id}/data-flow-diagrams/{diagram_id}`
Get data flow diagram details.

**Response**: `200 OK` (same structure as GET item)

---

#### `PUT /api/v1/workspaces/{workspace_id}/data-flow-diagrams/{diagram_id}`
Update data flow diagram.

**Request Body**: (same as POST, all fields optional)

**Response**: `200 OK` (same structure as GET item)

---

#### `DELETE /api/v1/workspaces/{workspace_id}/data-flow-diagrams/{diagram_id}`
Delete data flow diagram.

**Response**: `204 No Content`

---

### Collaboration

#### `GET /api/v1/workspaces/{workspace_id}/collaboration`
Get collaboration session details.

**Response**: `200 OK`
```json
{
  "session_id": "uuid",
  "workspace_id": "uuid",
  "primary_owner_id": "uuid",
  "participants": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "access_level": "read" | "edit",
      "canvas_ownership": ["uuid"],
      "joined_at": "2025-12-31T00:00:00Z",
      "last_seen_at": "2025-12-31T00:00:00Z"
    }
  ],
  "websocket_connection_status": "connected" | "disconnected" | "reconnecting"
}
```

---

#### `POST /api/v1/workspaces/{workspace_id}/collaboration/invite`
Invite a user to collaborate.

**Request Body**:
```json
{
  "user_id": "uuid",
  "access_level": "read" | "edit"
}
```

**Response**: `201 Created`

---

#### `DELETE /api/v1/workspaces/{workspace_id}/collaboration/participants/{user_id}`
Remove a collaborator.

**Response**: `204 No Content`

---

### Export/Import

#### `POST /api/v1/workspaces/{workspace_id}/export/odcs`
Export workspace to ODCS 3.1.0 format.

**Response**: `200 OK`
- Content-Type: `application/yaml`
- Content-Disposition: `attachment; filename="workspace-{id}.yaml"`

---

#### `POST /api/v1/workspaces/{workspace_id}/import/odcs`
Import workspace from ODCS 3.1.0 format.

**Request Body**: Multipart form data
- `file`: ODCS YAML file

**Response**: `200 OK`
```json
{
  "workspace_id": "uuid",
  "tables_imported": 10,
  "relationships_imported": 5
}
```

---

## WebSocket Messages

### Client → Server

#### `update_table`
Update a table.

```json
{
  "type": "update_table",
  "workspace_id": "uuid",
  "table_id": "uuid",
  "data": {
    "name": "string",
    "position_x": 0,
    "position_y": 0
  }
}
```

#### `update_relationship`
Update a relationship.

```json
{
  "type": "update_relationship",
  "workspace_id": "uuid",
  "relationship_id": "uuid",
  "data": {
    "cardinality": "one-to-many"
  }
}
```

#### `presence_update`
Update user presence.

```json
{
  "type": "presence_update",
  "workspace_id": "uuid",
  "cursor_position": {
    "x": 0,
    "y": 0
  },
  "selected_elements": ["uuid"]
}
```

### Server → Client

#### `table_updated`
Table was updated by another user.

```json
{
  "type": "table_updated",
  "workspace_id": "uuid",
  "table_id": "uuid",
  "data": {
    "name": "string",
    "position_x": 0,
    "position_y": 0
  },
  "user_id": "uuid",
  "timestamp": "2025-12-31T00:00:00Z"
}
```

#### `relationship_updated`
Relationship was updated by another user.

```json
{
  "type": "relationship_updated",
  "workspace_id": "uuid",
  "relationship_id": "uuid",
  "data": {
    "cardinality": "one-to-many"
  },
  "user_id": "uuid",
  "timestamp": "2025-12-31T00:00:00Z"
}
```

#### `presence_update`
User presence updated.

```json
{
  "type": "presence_update",
  "workspace_id": "uuid",
  "user_id": "uuid",
  "cursor_position": {
    "x": 0,
    "y": 0
  },
  "selected_elements": ["uuid"],
  "timestamp": "2025-12-31T00:00:00Z"
}
```

#### `conflict_warning`
Conflict detected (e.g., table already deleted).

```json
{
  "type": "conflict_warning",
  "workspace_id": "uuid",
  "element_type": "table",
  "element_id": "uuid",
  "message": "Table has already been deleted",
  "timestamp": "2025-12-31T00:00:00Z"
}
```

## Error Responses

All endpoints may return the following error responses:

### `400 Bad Request`
Invalid request data.

```json
{
  "error": "validation_error",
  "message": "Invalid request data",
  "details": {
    "field": "name",
    "reason": "Name is required"
  }
}
```

### `401 Unauthorized`
Missing or invalid authentication token.

```json
{
  "error": "unauthorized",
  "message": "Invalid or expired token"
}
```

### `403 Forbidden`
User lacks permission for the operation.

```json
{
  "error": "forbidden",
  "message": "You do not have permission to perform this action"
}
```

### `404 Not Found`
Resource not found.

```json
{
  "error": "not_found",
  "message": "Workspace not found"
}
```

### `409 Conflict`
Conflict detected (e.g., concurrent edit).

```json
{
  "error": "conflict",
  "message": "Table has already been deleted",
  "element_id": "uuid"
}
```

### `500 Internal Server Error`
Server error.

```json
{
  "error": "internal_error",
  "message": "An internal error occurred"
}
```

