# Data Model

**Date**: 2025-12-31  
**Feature**: Data Modelling Web Application

## Overview

This document defines the data model for the data modelling web application. The model is derived from the feature specification and aligns with the existing SDK/API data structures.

## Core Entities

### Workspace

Represents a collection of data models and diagrams.

**Properties**:
- `id`: UUID (primary key)
- `name`: string (required, max 255 chars)
- `type`: enum (`personal` | `shared`) (required)
- `owner_id`: UUID (foreign key to user, required)
- `created_at`: timestamp (required)
- `last_modified_at`: timestamp (required)
- `domains`: array of Domain (one-to-many)
- `data_flow_diagrams`: array of DataFlowDiagram (one-to-many)

**Validation Rules**:
- Name must be non-empty and unique per owner
- Owner must exist
- Last modified timestamp updated on any change

**State Transitions**:
- `personal` → `shared`: Convert workspace to shared (adds collaborators)
- `shared` → `personal`: Convert to personal (removes all collaborators)

### Domain

Represents a model type (Conceptual, Logical, or Physical) within a workspace. Each domain has its own canvas tab.

**Properties**:
- `id`: UUID (primary key)
- `workspace_id`: UUID (foreign key to Workspace, required)
- `name`: string (required, max 255 chars)
- `model_type`: enum (`conceptual` | `logical` | `physical`) (required)
- `is_primary`: boolean (indicates if this is the primary domain for tables)
- `tables`: array of Table (one-to-many)
- `relationships`: array of Relationship (one-to-many)
- `created_at`: timestamp (required)
- `last_modified_at`: timestamp (required)

**Validation Rules**:
- Name must be unique within workspace
- At least one domain must exist per workspace
- Tables can appear on multiple domains but only editable on primary domain

**State Transitions**:
- Domain creation: Creates new canvas tab
- Domain deletion: Removes canvas tab (only if no tables reference it as primary)

### Table

Represents a data entity in a model. Can appear on multiple domain canvases but is only editable on its primary domain.

**Properties**:
- `id`: UUID (primary key)
- `workspace_id`: UUID (foreign key to Workspace, required)
- `primary_domain_id`: UUID (foreign key to Domain, required)
- `name`: string (required, max 255 chars, unique within workspace)
- `alias`: string (optional, max 255 chars)
- `model_type`: enum (`conceptual` | `logical` | `physical`) (required)
- `columns`: array of Column (one-to-many)
- `position_x`: number (canvas position, required)
- `position_y`: number (canvas position, required)
- `width`: number (canvas size, default 200)
- `height`: number (canvas size, default 150)
- `visible_domains`: array of UUID (domains where table is visible)
- `created_at`: timestamp (required)
- `last_modified_at`: timestamp (required)

**Validation Rules**:
- Name must be unique within workspace
- Primary domain must exist
- Position coordinates must be valid numbers
- At least one column required for physical model type

**State Transitions**:
- Table creation: Appears on primary domain canvas
- Table update: Updates propagate to all visible domains
- Table deletion: Removes from all domains, cascades to relationships

### Column

Represents an attribute of a table.

**Properties**:
- `id`: UUID (primary key)
- `table_id`: UUID (foreign key to Table, required)
- `name`: string (required, max 255 chars, unique within table)
- `data_type`: string (required, e.g., "VARCHAR", "INTEGER", "BIGINT")
- `nullable`: boolean (default false)
- `is_primary_key`: boolean (default false)
- `is_foreign_key`: boolean (default false)
- `foreign_key_reference`: UUID (foreign key to Column, optional)
- `default_value`: string (optional)
- `constraints`: object (optional, JSON object with constraint definitions)
- `order`: number (display order, required)
- `created_at`: timestamp (required)

**Validation Rules**:
- Name must be unique within table
- Foreign key reference must point to valid column
- Only one primary key per table (enforced at table level)
- Data type must be valid for model type

**State Transitions**:
- Column creation: Added to table's column list
- Column update: Updates propagate to relationships if foreign key
- Column deletion: Removed from table, cascades if referenced by foreign keys

### Relationship

Represents a connection between two tables. Displayed with crow's feet notation.

**Properties**:
- `id`: UUID (primary key)
- `workspace_id`: UUID (foreign key to Workspace, required)
- `source_table_id`: UUID (foreign key to Table, required)
- `target_table_id`: UUID (foreign key to Table, required)
- `cardinality`: enum (`one-to-one` | `one-to-many` | `many-to-many`) (required)
- `optionality`: enum (`required` | `optional`) (required)
- `name`: string (optional, max 255 chars)
- `source_column_id`: UUID (foreign key to Column, optional)
- `target_column_id`: UUID (foreign key to Column, optional)
- `is_circular`: boolean (computed, indicates circular reference)
- `created_at`: timestamp (required)

**Validation Rules**:
- Source and target tables must be different
- Source and target tables must exist in same workspace
- Circular relationships allowed but warned
- Column references must belong to respective tables

**State Transitions**:
- Relationship creation: Creates connection line on canvas
- Relationship update: Updates connection visualization
- Relationship deletion: Removes connection line

### DataFlowDiagram

Represents a data architecture flow diagram.

**Properties**:
- `id`: UUID (primary key)
- `workspace_id`: UUID (foreign key to Workspace, required)
- `name`: string (required, max 255 chars)
- `nodes`: array of DataFlowNode (one-to-many)
- `connections`: array of DataFlowConnection (one-to-many)
- `linked_tables`: array of UUID (references to conceptual tables)
- `created_at`: timestamp (required)
- `last_modified_at`: timestamp (required)

**Validation Rules**:
- Name must be unique within workspace
- Linked tables must exist in workspace

### DataFlowNode

Represents an element in a data flow (source, processor, target).

**Properties**:
- `id`: UUID (primary key)
- `diagram_id`: UUID (foreign key to DataFlowDiagram, required)
- `type`: enum (`database` | `kafka_topic` | `api` | `processor` | `target`) (required)
- `name`: string (required, max 255 chars)
- `position_x`: number (canvas position, required)
- `position_y`: number (canvas position, required)
- `icon`: string (icon identifier, optional)
- `metadata`: object (optional, JSON object with type-specific data)
- `created_at`: timestamp (required)

**Validation Rules**:
- Name must be unique within diagram
- Position coordinates must be valid numbers
- Type-specific metadata must be valid JSON

### DataFlowConnection

Represents a data movement between nodes.

**Properties**:
- `id`: UUID (primary key)
- `diagram_id`: UUID (foreign key to DataFlowDiagram, required)
- `source_node_id`: UUID (foreign key to DataFlowNode, required)
- `target_node_id`: UUID (foreign key to DataFlowNode, required)
- `label`: string (optional, max 255 chars)
- `direction`: enum (`forward` | `bidirectional`) (default `forward`)
- `created_at`: timestamp (required)

**Validation Rules**:
- Source and target nodes must be different
- Source and target nodes must belong to same diagram

### UserSession

Represents a user's active editing session.

**Properties**:
- `id`: UUID (primary key)
- `user_id`: UUID (foreign key to user, required)
- `workspace_id`: UUID (foreign key to Workspace, required)
- `current_selection`: array of UUID (selected elements)
- `cursor_position_x`: number (optional)
- `cursor_position_y`: number (optional)
- `presence_status`: enum (`active` | `idle` | `away`) (default `active`)
- `last_activity_at`: timestamp (required)
- `created_at`: timestamp (required)

**Validation Rules**:
- User must exist
- Workspace must exist
- Last activity updated on any interaction

### CollaborationSession

Represents a shared editing session.

**Properties**:
- `id`: UUID (primary key)
- `workspace_id`: UUID (foreign key to Workspace, required)
- `primary_owner_id`: UUID (foreign key to user, required)
- `participants`: array of CollaborationParticipant (one-to-many)
- `websocket_connection_status`: enum (`connected` | `disconnected` | `reconnecting`)
- `created_at`: timestamp (required)
- `expires_at`: timestamp (optional)

**Validation Rules**:
- Primary owner must exist
- Workspace must be shared type
- Expiration must be in future if set

### CollaborationParticipant

Represents a participant in a collaboration session.

**Properties**:
- `id`: UUID (primary key)
- `session_id`: UUID (foreign key to CollaborationSession, required)
- `user_id`: UUID (foreign key to user, required)
- `access_level`: enum (`read` | `edit`) (required)
- `canvas_ownership`: array of UUID (canvas IDs where user is primary owner)
- `joined_at`: timestamp (required)
- `last_seen_at`: timestamp (required)

**Validation Rules**:
- User must exist
- Access level must be valid
- Canvas ownership must reference valid domains

## Relationships

- **Workspace** → **Domain**: One-to-many (workspace contains multiple domains)
- **Workspace** → **Table**: One-to-many (workspace contains multiple tables)
- **Workspace** → **DataFlowDiagram**: One-to-many (workspace contains multiple diagrams)
- **Domain** → **Table**: Many-to-many (tables can appear on multiple domains)
- **Table** → **Column**: One-to-many (table contains multiple columns)
- **Table** → **Relationship**: Many-to-many (tables participate in multiple relationships)
- **DataFlowDiagram** → **DataFlowNode**: One-to-many (diagram contains multiple nodes)
- **DataFlowDiagram** → **DataFlowConnection**: One-to-many (diagram contains multiple connections)
- **DataFlowDiagram** → **Table**: Many-to-many (diagrams can link to multiple tables)
- **Workspace** → **UserSession**: One-to-many (workspace has multiple active sessions)
- **Workspace** → **CollaborationSession**: One-to-one (workspace has one active collaboration session)

## Data Integrity Rules

1. **Orphaned Relationships**: Relationships must reference valid source and target tables
2. **Circular Dependencies**: Circular relationships allowed but must be detected and warned
3. **Primary Domain**: Each table must have exactly one primary domain
4. **Column References**: Foreign key columns must reference valid columns
5. **Workspace Isolation**: Tables, relationships, and diagrams are isolated per workspace
6. **Domain Consistency**: Tables visible on multiple domains must maintain consistency

## Storage Format

### Online Storage (PostgreSQL)

- All entities stored in PostgreSQL via data-modelling-api
- JSON columns for complex nested data (constraints, metadata)
- Timestamps stored as UTC
- UUIDs for all primary keys

### Offline Storage (ODCS 3.1.0)

- Tables exported as ODCS YAML format
- Relationships exported using SDK relationship format
- Workspace metadata stored in separate YAML file
- Data flow diagrams stored in separate YAML file

## Migration Considerations

- Schema migrations handled by API (sqlx migrations)
- Frontend handles format conversion (ODCS ↔ API format)
- Version compatibility checked on workspace load
- Backward compatibility maintained for ODCS 3.1.0 format

