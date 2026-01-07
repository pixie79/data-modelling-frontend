/**
 * Type definitions for Workspace entity
 */

import type { Domain, ViewPositions } from './domain';
import type { System } from './system';
import type { Relationship } from './relationship';
import type { Owner } from './table';

export interface Workspace {
  id: string; // UUID
  name: string; // max 255 chars
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
 * WorkspaceV2 - New flat file format
 * Single {workspace}.workspace.yaml file containing all workspace structure
 */
export interface WorkspaceV2 {
  apiVersion: 'workspace/v2';
  kind: 'Workspace';
  metadata: WorkspaceV2Metadata;
  spec: WorkspaceV2Spec;
}

export interface WorkspaceV2Metadata {
  id: string; // UUID
  name: string; // Used as filename prefix
  description?: string;
  version: string; // Schema version (e.g., "2.0.0")
  created_at: string; // ISO 8601 timestamp
  last_modified_at: string; // ISO 8601 timestamp
  owner?: Owner;
  tags?: Array<{ key?: string; value: string }>;
}

export interface WorkspaceV2Spec {
  domains: DomainV2[];
  relationships: Relationship[];
}

/**
 * DomainV2 - Domain definition in workspace/v2 format
 * Contains full system objects, not just IDs
 */
export interface DomainV2 {
  id: string; // UUID
  name: string;
  description?: string;
  owner?: Owner;
  view_positions?: ViewPositions;
  created_at?: string;
  last_modified_at?: string;

  // Systems nested under domain (full objects)
  systems: System[];

  // Asset references (IDs only - actual data in separate files)
  tables?: string[];
  products?: string[];
  assets?: string[];
  processes?: string[];
  decisions?: string[];

  // Tags
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
}

// Legacy ModelType - deprecated, kept for backward compatibility
// New architecture uses business domains, not model-type domains
export type ModelType = 'conceptual' | 'logical' | 'physical';

// Note: Table and Relationship types are defined in separate files
// Import them when needed: import type { Table } from './table';
