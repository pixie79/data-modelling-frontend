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

export interface Relationship {
  id: string; // UUID
  workspace_id: string; // UUID
  domain_id: string; // UUID
  source_table_id: string; // UUID
  target_table_id: string; // UUID
  type: RelationshipType;
  source_cardinality: Cardinality; // '0', '1', or 'N'
  target_cardinality: Cardinality; // '0', '1', or 'N'
  label?: string; // optional relationship label
  model_type: ModelType;
  is_circular: boolean; // indicates if relationship creates a cycle
  created_at: string; // ISO timestamp
  last_modified_at: string; // ISO timestamp
}

