/**
 * Type definitions for Workspace entity
 */

import type { Domain, ViewPositions } from './domain';
import type { System } from './system';
import type { Owner } from './table';

export interface Workspace {
  id: string; // UUID
  name: string; // max 255 chars
  description?: string; // Workspace description (from README.md)
  owner_id: string; // UUID
  created_at: string; // ISO timestamp
  last_modified_at: string; // ISO timestamp
  domains?: Domain[];
}

/**
 * Workspace metadata stored in workspace.yaml (v1 format - folder-based)
 * Contains domain IDs to avoid regenerating them on each load
 */
export interface WorkspaceMetadata {
  id: string; // UUID
  name: string;
  created_at: string; // ISO timestamp
  last_modified_at: string; // ISO timestamp
  domains: Array<{
    id: string; // UUID
    name: string;
  }>;
}

/**
 * WorkspaceV2 - Flat file format matching SDK workspace-schema.json
 * Single {workspace}.workspace.yaml file containing all workspace structure
 */
export interface WorkspaceV2 {
  // Required fields (per SDK schema)
  id: string; // UUID - unique workspace identifier
  name: string; // Alphanumeric with hyphens/underscores, max 255 chars
  owner_id: string; // UUID - creator's user identifier
  created_at: string; // ISO 8601 timestamp
  last_modified_at: string; // ISO 8601 timestamp

  // Optional fields
  description?: string;
  domains?: DomainV2[]; // Domain references with nested systems
  assets?: AssetReference[]; // Asset references belonging to workspace
  relationships?: RelationshipV2[]; // Connections between assets
}

/**
 * AssetReference - Reference to an asset file in the workspace
 * Matches SDK schema AssetReference definition
 */
export interface AssetReference {
  id: string; // UUID
  name: string; // Asset title
  domain: string; // Parent domain name
  system?: string; // Parent system name (optional)
  asset_type: 'odcs' | 'odps' | 'cads' | 'bpmn' | 'dmn' | 'openapi';
  file_path?: string; // Generated filename following convention
}

/**
 * RelationshipV2 - Relationship definition matching SDK schema
 */
export interface RelationshipV2 {
  id: string; // UUID
  source_table_id: string; // UUID - origin asset
  target_table_id: string; // UUID - destination asset
  cardinality?: 'one_to_one' | 'one_to_many' | 'many_to_many';
  source_optional?: boolean;
  target_optional?: boolean;
  relationship_type?: 'foreign_key' | 'data_flow' | 'dependency' | 'etl';
  notes?: string;
  owner?: string;
  color?: string; // Hex or named color for visualization
}

/**
 * DomainV2 - Domain definition matching SDK schema DomainReference
 */
export interface DomainV2 {
  // Required fields (per SDK schema)
  id: string; // UUID
  name: string; // Filename-compatible name

  // Optional fields
  description?: string;
  systems?: SystemV2[]; // Nested system references
  view_positions?: ViewPositions; // Canvas positions for nodes per view mode
}

/**
 * SystemV2 - System definition matching SDK schema SystemReference
 */
export interface SystemV2 {
  // Required fields (per SDK schema)
  id: string; // UUID
  name: string; // Filename-compatible name

  // Optional fields
  description?: string;
  table_ids?: string[]; // UUIDs of tables belonging to this system
  asset_ids?: string[]; // UUIDs of compute assets belonging to this system
}

/**
 * @deprecated Use DomainV2 instead - kept for backward compatibility during migration
 */
export interface DomainV2Legacy {
  id: string; // UUID
  name: string;
  description?: string;
  owner?: Owner;
  view_positions?: ViewPositions;
  created_at?: string;
  last_modified_at?: string;
  systems: System[];
  tables?: string[];
  products?: string[];
  assets?: string[];
  processes?: string[];
  decisions?: string[];
  tags?: Array<{ key?: string; value: string }>;
}

/**
 * Parsed filename structure for flat file naming convention
 */
export interface ParsedFileName {
  workspace: string;
  domain?: string;
  system?: string;
  resource?: string;
  type: 'workspace' | 'odcs' | 'odps' | 'cads' | 'bpmn' | 'dmn';
}

/**
 * Categorized workspace files by type
 */
export interface CategorizedFiles {
  workspace?: string;
  odcs: string[];
  odps: string[];
  cads: string[];
  bpmn: string[];
  dmn: string[];
  kb: string[]; // Knowledge base articles (.kb.yaml)
  adr: string[]; // Architecture decision records (.adr.yaml)
}

/**
 * Files filtered by domain
 */
export interface DomainFiles {
  odcs: File[];
  odps: File[];
  cads: File[];
  bpmn: File[];
  dmn: File[];
  kb: File[]; // Knowledge base articles (.kb.yaml)
  adr: File[]; // Architecture decision records (.adr.yaml)
}

// Legacy ModelType - deprecated, kept for backward compatibility
// New architecture uses business domains, not model-type domains
export type ModelType = 'conceptual' | 'logical' | 'physical';

// Note: Table and Relationship types are defined in separate files
// Import them when needed: import type { Table } from './table';
