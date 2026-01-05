/**
 * Type definitions for Workspace entity
 */

import type { Domain } from './domain';

export interface Workspace {
  id: string; // UUID
  name: string; // max 255 chars
  owner_id: string; // UUID
  created_at: string; // ISO timestamp
  last_modified_at: string; // ISO timestamp
  domains?: Domain[];
}

/**
 * Workspace metadata stored in workspace.yaml
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

// Legacy ModelType - deprecated, kept for backward compatibility
// New architecture uses business domains, not model-type domains
export type ModelType = 'conceptual' | 'logical' | 'physical';

// Note: Table and Relationship types are defined in separate files
// Import them when needed: import type { Table } from './table';

