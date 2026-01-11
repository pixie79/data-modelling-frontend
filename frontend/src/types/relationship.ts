/**
 * Type definitions for Relationship entity
 * SDK 1.14.0+
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

/**
 * SDK 1.14.0+ Cardinality values (camelCase)
 * Used when communicating with the SDK
 */
export enum SDKCardinality {
  ZeroOrOne = 'zeroOrOne',
  ExactlyOne = 'exactlyOne',
  ZeroOrMany = 'zeroOrMany',
  OneOrMany = 'oneOrMany',
}

/**
 * SDK 1.14.0+ Flow direction
 */
export enum FlowDirection {
  SourceToTarget = 'sourceToTarget',
  TargetToSource = 'targetToSource',
  Bidirectional = 'bidirectional',
}

/**
 * SDK 1.14.0+ Relationship type enum
 */
export enum SDKRelationshipType {
  ForeignKey = 'foreignKey',
  DataFlow = 'dataFlow',
  Dependency = 'dependency',
  ETL = 'etl',
}

/**
 * SDK 1.14.0+ Handle positions (12-point connection system)
 */
export enum HandlePosition {
  TopLeft = 'top-left',
  TopCenter = 'top-center',
  TopRight = 'top-right',
  RightTop = 'right-top',
  RightCenter = 'right-center',
  RightBottom = 'right-bottom',
  BottomRight = 'bottom-right',
  BottomCenter = 'bottom-center',
  BottomLeft = 'bottom-left',
  LeftBottom = 'left-bottom',
  LeftCenter = 'left-center',
  LeftTop = 'left-top',
}

/**
 * SDK 1.14.0+ Infrastructure type for data flow relationships
 */
export enum InfrastructureType {
  Kafka = 'kafka',
  Airflow = 'airflow',
  Spark = 'spark',
  Databricks = 'databricks',
  Snowflake = 'snowflake',
  Fivetran = 'fivetran',
  DBT = 'dbt',
  Custom = 'custom',
}

/**
 * Foreign key details for table relationships (SDK 1.14.0+)
 */
export interface ForeignKeyDetails {
  source_column?: string;
  target_column?: string;
}

/**
 * ETL job metadata (SDK 1.14.0+)
 */
export interface ETLJobMetadata {
  job_name?: string;
  notes?: string;
  frequency?: string;
}

/**
 * Visual metadata for relationship rendering (SDK 1.14.0+)
 */
export interface VisualMetadata {
  waypoints?: Array<{ x: number; y: number }>;
  label_position?: { x: number; y: number };
}

/**
 * Contact details for relationship owner (SDK 1.14.0+)
 */
export interface ContactDetails {
  email?: string;
  phone?: string;
  name?: string;
  role?: string;
  other?: string;
}

/**
 * SLA property (SDK 1.14.0+)
 */
export interface SLAProperty {
  name: string;
  value: string;
  unit?: string;
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
  // SDK 1.14.0+ cardinality fields (optional, for SDK compatibility)
  sdk_source_cardinality?: SDKCardinality;
  sdk_target_cardinality?: SDKCardinality;
  flow_direction?: FlowDirection; // SDK 1.14.0+
  relationship_type?: SDKRelationshipType; // SDK 1.14.0+
  source_key?: string; // UUID of source key (column ID for single column PK, compound key ID for compound keys) - only for table-to-table relationships
  target_key?: string; // UUID of target key (column ID for single column PK, compound key ID for compound keys) - only for table-to-table relationships
  source_handle?: HandlePosition | string; // ReactFlow handle ID for source connection point
  target_handle?: HandlePosition | string; // ReactFlow handle ID for target connection point
  label?: string; // optional relationship label
  description?: string; // optional description or notes about the relationship
  notes?: string; // SDK 1.14.0+ notes field
  color?: string; // optional color for the relationship line (hex color, e.g., "#ff0000")
  owner?: string; // SDK 1.14.0+ owner field
  infrastructure_type?: InfrastructureType; // SDK 1.14.0+
  foreign_key_details?: ForeignKeyDetails; // SDK 1.14.0+
  etl_job_metadata?: ETLJobMetadata; // SDK 1.14.0+
  visual_metadata?: VisualMetadata; // SDK 1.14.0+
  contact_details?: ContactDetails; // SDK 1.14.0+
  sla?: SLAProperty[]; // SDK 1.14.0+
  drawio_edge_id?: string; // optional DrawIO edge ID for diagram integration (SDK 1.13.1+)
  model_type: ModelType;
  is_circular: boolean; // indicates if relationship creates a cycle
  created_at: string; // ISO timestamp
  last_modified_at: string; // ISO timestamp
}

// =============================================================================
// Cardinality Conversion Utilities
// =============================================================================

/**
 * Convert SDK cardinality to legacy cardinality value
 */
export function sdkCardinalityToLegacy(sdk: SDKCardinality): Cardinality {
  switch (sdk) {
    case SDKCardinality.ZeroOrOne:
      return '0';
    case SDKCardinality.ExactlyOne:
      return '1';
    case SDKCardinality.ZeroOrMany:
      return '0';
    case SDKCardinality.OneOrMany:
      return 'N';
    default:
      return '1';
  }
}

/**
 * Convert legacy cardinality to SDK cardinality
 * Note: This is a best-effort conversion since legacy format loses information
 */
export function legacyCardinalityToSDK(
  legacy: Cardinality,
  optional: boolean = false
): SDKCardinality {
  switch (legacy) {
    case '0':
      return optional ? SDKCardinality.ZeroOrOne : SDKCardinality.ZeroOrMany;
    case '1':
      return optional ? SDKCardinality.ZeroOrOne : SDKCardinality.ExactlyOne;
    case 'N':
      return optional ? SDKCardinality.ZeroOrMany : SDKCardinality.OneOrMany;
    default:
      return SDKCardinality.ExactlyOne;
  }
}

/**
 * Convert SDK cardinalities to relationship type
 */
export function sdkCardinalitiesToType(
  source: SDKCardinality,
  target: SDKCardinality
): RelationshipType {
  const sourceIsMany = source === SDKCardinality.ZeroOrMany || source === SDKCardinality.OneOrMany;
  const targetIsMany = target === SDKCardinality.ZeroOrMany || target === SDKCardinality.OneOrMany;

  if (sourceIsMany && targetIsMany) {
    return 'many-to-many';
  } else if (targetIsMany) {
    return 'one-to-many';
  } else {
    return 'one-to-one';
  }
}

/**
 * Get display label for SDK cardinality
 */
export function getSDKCardinalityLabel(cardinality: SDKCardinality): string {
  const labels: Record<SDKCardinality, string> = {
    [SDKCardinality.ZeroOrOne]: '0..1',
    [SDKCardinality.ExactlyOne]: '1',
    [SDKCardinality.ZeroOrMany]: '0..*',
    [SDKCardinality.OneOrMany]: '1..*',
  };
  return labels[cardinality];
}

/**
 * Get display label for handle position
 */
export function getHandlePositionLabel(position: HandlePosition): string {
  const labels: Record<HandlePosition, string> = {
    [HandlePosition.TopLeft]: 'Top Left',
    [HandlePosition.TopCenter]: 'Top Center',
    [HandlePosition.TopRight]: 'Top Right',
    [HandlePosition.RightTop]: 'Right Top',
    [HandlePosition.RightCenter]: 'Right Center',
    [HandlePosition.RightBottom]: 'Right Bottom',
    [HandlePosition.BottomRight]: 'Bottom Right',
    [HandlePosition.BottomCenter]: 'Bottom Center',
    [HandlePosition.BottomLeft]: 'Bottom Left',
    [HandlePosition.LeftBottom]: 'Left Bottom',
    [HandlePosition.LeftCenter]: 'Left Center',
    [HandlePosition.LeftTop]: 'Left Top',
  };
  return labels[position];
}
