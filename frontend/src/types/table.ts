/**
 * Type definitions for Table entity
 */

import type { ModelType } from './workspace';

export interface Table {
  id: string; // UUID
  workspace_id: string; // UUID
  primary_domain_id: string; // UUID
  name: string; // max 255 chars, unique within workspace
  alias?: string; // max 255 chars
  description?: string; // optional table description
  tags?: string[]; // optional tags for categorization
  model_type: ModelType;
  columns: Column[];
  position_x: number; // canvas position
  position_y: number; // canvas position
  width: number; // canvas size, default 200
  height: number; // canvas size, default 150
  visible_domains: string[]; // array of domain UUIDs
  created_at: string; // ISO timestamp
  last_modified_at: string; // ISO timestamp
}

export interface Column {
  id: string; // UUID
  table_id: string; // UUID
  name: string; // max 255 chars, unique within table
  data_type: string; // e.g., "VARCHAR", "INTEGER", "BIGINT"
  nullable: boolean; // default false
  is_primary_key: boolean; // default false
  is_foreign_key: boolean; // default false
  foreign_key_reference?: string; // UUID of referenced Column
  default_value?: string;
  constraints?: Record<string, unknown>; // JSON object with constraint definitions
  order: number; // display order
  created_at: string; // ISO timestamp
}

