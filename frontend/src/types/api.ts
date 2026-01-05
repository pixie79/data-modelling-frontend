/**
 * Type definitions for API requests and responses
 */

import type { Workspace } from './workspace';
import type { Domain } from './domain';
// Legacy data flow types - deprecated, replaced by BPMN processes
export interface DataFlowDiagram {
  id: string;
  workspace_id: string;
  domain_id: string;
  name: string;
  description?: string;
  created_at: string;
  last_modified_at: string;
}
import type { Table } from './table';
import type { Relationship } from './relationship';

// Authentication
export interface RefreshTokenRequest {
  refresh_token: string;
}

export interface RefreshTokenResponse {
  access_token: string;
  refresh_token: string;
  access_token_expires_at: number;
  refresh_token_expires_at: number;
  token_type: 'Bearer';
}

// Workspaces
export interface ListWorkspacesResponse {
  workspaces: Workspace[];
}

export interface GetWorkspaceResponse {
  workspace: Workspace;
}

export interface CreateWorkspaceRequest {
  name: string;
}

export interface CreateWorkspaceResponse {
  workspace: Workspace;
}

export interface UpdateWorkspaceRequest {
  name?: string;
}

export interface UpdateWorkspaceResponse {
  workspace: Workspace;
}

// Domains
export interface ListDomainsResponse {
  domains: Domain[];
}

export interface GetDomainResponse {
  domain: Domain;
}

export interface CreateDomainRequest {
  name: string;
  model_type: 'conceptual' | 'logical' | 'physical';
  is_primary?: boolean;
}

export interface CreateDomainResponse {
  domain: Domain;
}

export interface UpdateDomainRequest {
  name?: string;
  is_primary?: boolean;
}

export interface UpdateDomainResponse {
  domain: Domain;
}

// Tables
export interface ListTablesResponse {
  tables: Table[];
}

export interface GetTableResponse {
  table: Table;
}

export interface CreateTableRequest {
  name: string;
  alias?: string;
  model_type: 'conceptual' | 'logical' | 'physical';
  primary_domain_id: string;
  position_x: number;
  position_y: number;
  width?: number;
  height?: number;
  columns?: Array<{
    name: string;
    data_type: string;
    nullable?: boolean;
    is_primary_key?: boolean;
    is_foreign_key?: boolean;
    foreign_key_reference?: string;
    default_value?: string;
    constraints?: Record<string, unknown>;
    order: number;
  }>;
}

export interface CreateTableResponse {
  table: Table;
}

export interface UpdateTableRequest {
  name?: string;
  alias?: string;
  position_x?: number;
  position_y?: number;
  width?: number;
  height?: number;
  visible_domains?: string[];
}

export interface UpdateTableResponse {
  table: Table;
}

// Relationships
export interface ListRelationshipsResponse {
  relationships: Relationship[];
}

export interface GetRelationshipResponse {
  relationship: Relationship;
}

export interface CreateRelationshipRequest {
  source_table_id: string;
  target_table_id: string;
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
  source_cardinality: '0' | '1' | 'N';
  target_cardinality: '0' | '1' | 'N';
  label?: string;
}

export interface CreateRelationshipResponse {
  relationship: Relationship;
}

export interface UpdateRelationshipRequest {
  type?: 'one-to-one' | 'one-to-many' | 'many-to-many';
  source_cardinality?: '0' | '1' | 'N';
  target_cardinality?: '0' | '1' | 'N';
  label?: string;
}

export interface UpdateRelationshipResponse {
  relationship: Relationship;
}

// Data Flow Diagrams
export interface ListDataFlowDiagramsResponse {
  diagrams: DataFlowDiagram[];
}

export interface GetDataFlowDiagramResponse {
  diagram: DataFlowDiagram;
}

export interface CreateDataFlowDiagramRequest {
  name: string;
  nodes?: Array<{
    type: 'source' | 'target' | 'processor' | 'storage';
    label: string;
    position_x: number;
    position_y: number;
    width?: number;
    height?: number;
    metadata?: Record<string, unknown>;
  }>;
  connections?: Array<{
    source_node_id: string;
    target_node_id: string;
    label?: string;
    metadata?: Record<string, unknown>;
  }>;
}

export interface CreateDataFlowDiagramResponse {
  diagram: DataFlowDiagram;
}

export interface UpdateDataFlowDiagramRequest {
  name?: string;
  nodes?: Array<{
    id?: string;
    type?: 'source' | 'target' | 'processor' | 'storage';
    label?: string;
    position_x?: number;
    position_y?: number;
    width?: number;
    height?: number;
    metadata?: Record<string, unknown>;
  }>;
  connections?: Array<{
    id?: string;
    source_node_id?: string;
    target_node_id?: string;
    label?: string;
    metadata?: Record<string, unknown>;
  }>;
}

export interface UpdateDataFlowDiagramResponse {
  diagram: DataFlowDiagram;
}

// Error responses
export interface ApiError {
  error: string;
  message: string;
  details?: Record<string, unknown>;
}

// WebSocket messages
export interface WebSocketMessage {
  type: 'table_updated' | 'table_deleted' | 'relationship_updated' | 'relationship_deleted' | 'presence' | 'conflict';
  workspace_id: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface PresenceMessage {
  user_id: string;
  user_name: string;
  workspace_id: string;
  active_domain_id?: string;
  timestamp: string;
}

