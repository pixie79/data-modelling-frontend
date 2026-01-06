/**
 * Type definitions for CADS (Compute Asset Definition Standard) Compute Asset entity
 */

import type { Owner } from './table';

// Re-export Owner for convenience
export type { Owner };

export type ComputeAssetType = 'ai' | 'ml' | 'app';
export type ComputeAssetStatus = 'development' | 'production' | 'deprecated';

export interface ComputeAsset {
  id: string; // UUID
  domain_id: string; // UUID
  name: string; // max 255 chars, unique within domain
  type: ComputeAssetType;
  description?: string;
  owner?: Owner;
  engineering_team?: string;
  source_repo?: string; // Source code repository URL
  bpmn_link?: string; // UUID reference to BPMN process
  dmn_link?: string; // UUID reference to DMN decision
  bpmn_models?: CADSBPMNModel[];
  dmn_models?: CADSDMNModel[];
  openapi_specs?: CADSOpenAPISpec[];
  status?: ComputeAssetStatus;
  kind?: CADSKind;
  tags?: string[]; // optional tags for categorization (supports Simple, Pair, and List formats)
  custom_properties?: Record<string, unknown>;
  position_x?: number; // canvas position
  position_y?: number; // canvas position
  width?: number; // canvas size, default 200
  height?: number; // canvas size, default 150
  created_at: string; // ISO timestamp
  last_modified_at: string; // ISO timestamp
}

export type CADSKind = 'AIModel' | 'MLPipeline' | 'Application' | 'DataPipeline' | 'ETLProcess';

export interface CADSBPMNModel {
  name: string;
  reference: string; // File path or URL
  format: 'bpmn';
  description?: string;
}

export interface CADSDMNModel {
  name: string;
  reference: string; // File path or URL
  format: 'dmn';
  description?: string;
}

export interface CADSOpenAPISpec {
  name: string;
  reference: string; // File path or URL
  format: 'openapi';
  description?: string;
}
