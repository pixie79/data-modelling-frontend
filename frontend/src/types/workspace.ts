/**
 * Type definitions for Workspace entity
 */

export type WorkspaceType = 'personal' | 'shared';

export interface Workspace {
  id: string; // UUID
  name: string; // max 255 chars
  type: WorkspaceType;
  owner_id: string; // UUID
  created_at: string; // ISO timestamp
  last_modified_at: string; // ISO timestamp
  domains?: Domain[];
  data_flow_diagrams?: DataFlowDiagram[];
}

export type ModelType = 'conceptual' | 'logical' | 'physical';

export interface Domain {
  id: string; // UUID
  workspace_id: string; // UUID
  name: string; // max 255 chars
  model_type: ModelType;
  is_primary: boolean;
  tables?: Array<{ id: string; name: string }>; // Simplified to avoid circular dependency
  relationships?: Array<{ id: string; source_table_id: string; target_table_id: string }>; // Simplified
  created_at: string; // ISO timestamp
  last_modified_at: string; // ISO timestamp
}

export interface DataFlowDiagram {
  id: string; // UUID
  workspace_id: string; // UUID
  name: string; // max 255 chars
  nodes: DataFlowNode[];
  connections: DataFlowConnection[];
  linked_tables?: string[]; // Array of table UUIDs that this flow relates to
  created_at: string; // ISO timestamp
  last_modified_at: string; // ISO timestamp
}

export interface DataFlowNode {
  id: string; // UUID
  diagram_id: string; // UUID
  type: 'source' | 'target' | 'processor' | 'storage';
  label: string;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  metadata?: Record<string, unknown>;
}

export interface DataFlowConnection {
  id: string; // UUID
  diagram_id: string; // UUID
  source_node_id: string; // UUID
  target_node_id: string; // UUID
  label?: string;
  metadata?: Record<string, unknown>;
}

// Note: Table and Relationship types are defined in separate files
// Import them when needed: import type { Table } from './table';

