/**
 * Type definitions for Domain entity (SDK 1.5.0 Domain-Centric Architecture)
 */

import type { Owner } from './table';

export interface ViewPositions {
  [viewMode: string]: {
    [entityId: string]: {
      x: number;
      y: number;
    };
  };
}

export interface SharedResourceReference {
  source_domain_id: string; // UUID of the domain that owns the resource
  resource_type: 'table' | 'system' | 'asset'; // Type of resource being shared
  resource_id: string; // UUID of the shared resource
  target_system_id?: string; // Optional: UUID of the system in current domain where this resource should appear (for foreign tables/assets)
  shared_at?: string; // ISO timestamp when shared (optional for backwards compatibility)
}

// Examples:
// 1. Share entire system: { source_domain_id: "domain1", resource_type: "system", resource_id: "system1" }
//    -> Shows system1 from domain1 as a separate system on domain2's canvas
//
// 2. Share table as foreign: { source_domain_id: "domain1", resource_type: "table", resource_id: "table1", target_system_id: "system2" }
//    -> Shows table1 from domain1 inside system2 on domain2's canvas (foreign table)
//
// 3. Share table standalone: { source_domain_id: "domain1", resource_type: "table", resource_id: "table1" }
//    -> Shows table1 from domain1 as a standalone table on domain2's canvas

export interface Domain {
  id: string; // UUID
  workspace_id: string; // UUID
  name: string; // max 255 chars, unique within workspace
  description?: string;
  owner?: Owner;
  created_at: string; // ISO timestamp
  last_modified_at: string; // ISO timestamp

  // Domain contains multiple asset types (loaded separately)
  systems?: string[]; // Array of system IDs
  tables?: string[]; // Array of table IDs (ODCS)
  products?: string[]; // Array of product IDs (ODPS)
  assets?: string[]; // Array of compute asset IDs (CADS)
  processes?: string[]; // Array of BPMN process IDs
  decisions?: string[]; // Array of DMN decision IDs

  // Cross-domain resource sharing (read-only references to resources from other domains)
  shared_resources?: SharedResourceReference[]; // Array of shared resource references

  // Canvas positions per view mode
  view_positions?: ViewPositions; // Positions for tables, systems, and assets per view (systems, process, operational, analytical, products)

  // Folder path tracking (for offline mode)
  folder_path?: string; // Path to domain folder (e.g., "/path/to/workspace/domain-name")
  workspace_path?: string; // Path to workspace root folder (e.g., "/path/to/workspace")
}

export interface DomainDefinition {
  id: string;
  workspace_id: string;
  name: string;
  description?: string;
  owner?: Owner;
  created_at: string;
  last_modified_at: string;
}
