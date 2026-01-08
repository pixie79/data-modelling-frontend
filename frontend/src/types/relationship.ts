/**
 * Type definitions for Relationship entity
 */

import type { ModelType } from './workspace';

export type RelationshipType = 'one-to-one' | 'one-to-many' | 'many-to-many';

export type Cardinality = '0' | '1' | 'N';

// Enum for relationship cardinality types (used by CardinalityEdge component)
export enum RelationshipCardinality {
  ONE_TO_ONE = 'One-to-One',
  ONE_TO_MANY = 'One-to-Many',
  MANY_TO_ONE = 'Many-to-One',
  MANY_TO_MANY = 'Many-to-Many',
}

export type RelationshipSourceType = 'table' | 'system' | 'compute-asset';
export type RelationshipTargetType = 'table' | 'system' | 'compute-asset';

export interface Relationship {
  id: string; // UUID
  workspace_id: string; // UUID
  domain_id: string; // UUID
  source_id: string; // UUID - can be table, system, or compute asset ID
  target_id: string; // UUID - can be table, system, or compute asset ID
  source_type: RelationshipSourceType; // Type of source entity
  target_type: RelationshipTargetType; // Type of target entity
  // Legacy fields for backward compatibility (deprecated, use source_id/target_id)
  source_table_id?: string; // UUID - deprecated, use source_id
  target_table_id?: string; // UUID - deprecated, use target_id
  type: RelationshipType;
  source_cardinality: Cardinality; // '0', '1', or 'N' (only for table-to-table relationships)
  target_cardinality: Cardinality; // '0', '1', or 'N' (only for table-to-table relationships)
  source_key?: string; // UUID of source key (column ID for single column PK, compound key ID for compound keys) - only for table-to-table relationships
  target_key?: string; // UUID of target key (column ID for single column PK, compound key ID for compound keys) - only for table-to-table relationships
  source_handle?: string; // ReactFlow handle ID for source connection point (e.g., 'right-center', 'top-left')
  target_handle?: string; // ReactFlow handle ID for target connection point (e.g., 'left-center', 'bottom-right')
  label?: string; // optional relationship label
  description?: string; // optional description or notes about the relationship
  color?: string; // optional color for the relationship line (hex color, e.g., "#ff0000")
  drawio_edge_id?: string; // optional DrawIO edge ID for diagram integration (SDK 1.13.1+)
  model_type: ModelType;
  is_circular: boolean; // indicates if relationship creates a cycle
  created_at: string; // ISO timestamp
  last_modified_at: string; // ISO timestamp
}
