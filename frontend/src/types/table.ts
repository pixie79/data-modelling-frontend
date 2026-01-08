/**
 * Type definitions for Table entity
 */

import type { ModelType } from './workspace';

export type QualityTier = 'operational' | 'bronze' | 'silver' | 'gold';

export interface SLA {
  latency?: number; // milliseconds
  uptime?: number; // percentage (0-100)
  response_time?: number; // milliseconds
  error_rate?: number; // percentage (0-100)
  update_frequency?: string; // e.g., "daily", "hourly", "real-time"
}

export interface Owner {
  name?: string;
  email?: string;
  team?: string;
  role?: string; // e.g., "Data Owner", "Data Steward"
}

export interface Role {
  role: string; // Required: Name of the IAM role that provides access to the dataset
  description?: string; // Description of the IAM role and its permissions
  access?: string; // The type of access provided by the IAM role
  firstLevelApprovers?: string | string[]; // The name(s) of the first-level approver(s) of the role
  secondLevelApprovers?: string | string[]; // The name(s) of the second-level approver(s) of the role
  customProperties?: Record<string, unknown>; // Any custom properties
}

// ODCS v3.0.2 Support and Communication Channels
export interface SupportChannel {
  channel: string; // Required: Channel name or identifier
  url: string; // Required: Access URL using normal URL scheme (https, mailto, etc.)
  description?: string; // Description of the channel, free text
  tool?: 'email' | 'slack' | 'teams' | 'discord' | 'ticket' | string; // Name of the tool
  scope?: 'interactive' | 'announcements' | 'issues'; // Scope of the channel
  invitationUrl?: string; // Invitation URL for requesting or subscribing
}

// ODCS v3.0.2 Pricing
export interface Pricing {
  priceAmount?: number; // Subscription price per unit of measure in priceUnit
  priceCurrency?: string; // Currency of the subscription price (e.g., USD, EUR)
  priceUnit?: string; // Unit of measure for calculating cost (e.g., megabyte, gigabyte)
}

// ODCS v3.0.2 Team (formerly stakeholders in v2.x)
export interface TeamMember {
  username?: string; // The user's username or email
  role?: string; // The user's job role (e.g., owner, data steward)
  dateIn?: string; // The date when the user joined the team (ISO date format: YYYY-MM-DD)
  dateOut?: string; // The date when the user ceased to be part of the team (ISO date format: YYYY-MM-DD)
  replacedByUsername?: string; // The username of the user who replaced the previous user
  comment?: string; // Free text comment
  name?: string; // User's name
}

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
  compoundKeys?: CompoundKey[]; // Array of compound keys (primary or unique)
  position_x: number; // canvas position (default/operational view)
  position_y: number; // canvas position (default/operational view)
  width: number; // canvas size, default 200
  height: number; // canvas size, default 150
  // Per-view positions: allows tables to have different positions on different canvas views
  view_positions?: {
    [viewName: string]: { x: number; y: number };
  };
  visible_domains: string[]; // array of domain UUIDs
  data_level?: 'operational' | 'bronze' | 'silver' | 'gold'; // Data quality tier (derived from dm_level tag)
  is_owned_by_domain: boolean; // True if owned by current domain (for cross-domain viewing)
  created_at: string; // ISO timestamp
  last_modified_at: string; // ISO timestamp

  // ODCS 3.0.2+ fields
  owner?: Owner;
  roles?: Role[]; // Array of roles that provide user access to the dataset
  support?: SupportChannel[]; // Support and communication channels
  pricing?: Pricing; // Pricing information when billing customers
  team?: TeamMember[]; // Team members and their history (formerly stakeholders in v2.x)
  sla?: SLA;
  metadata?: Record<string, unknown>; // Custom metadata including quality_tier, data_modeling_method, and indexes
  quality_rules?: Record<string, unknown>; // Table-level quality rules
}

export interface TableIndex {
  id: string; // UUID
  name: string; // Index name
  column_ids: string[]; // Array of column IDs in order
  is_unique: boolean; // Whether the index enforces uniqueness
  is_clustered?: boolean; // Whether the index is clustered (database-specific)
  description?: string; // Optional description
}

/**
 * Authoritative Definition reference (ODCS v3.1.0)
 * Links to external authoritative sources for data definitions
 */
export interface AuthoritativeDefinition {
  type: string; // Type of definition source (e.g., "business-glossary", "data-dictionary")
  url: string; // URL to the authoritative definition
}

/**
 * Logical Type Options (ODCS v3.1.0)
 * Additional validation and metadata for logical data types
 */
export interface LogicalTypeOptions {
  minLength?: number; // Minimum string length
  maxLength?: number; // Maximum string length
  pattern?: string; // Regex pattern for validation
  format?: string; // Format specifier (e.g., "email", "date", "uuid")
  minimum?: number; // Minimum numeric value
  maximum?: number; // Maximum numeric value
  precision?: number; // Numeric precision (total digits)
  scale?: number; // Numeric scale (decimal places)
}

export interface Column {
  id: string; // UUID
  table_id: string; // UUID
  name: string; // max 255 chars, unique within table
  data_type: string; // e.g., "VARCHAR", "INTEGER", "BIGINT"
  nullable: boolean; // default false
  is_primary_key: boolean; // default false (single column primary key)
  is_foreign_key: boolean; // default false
  foreign_key_reference?: string; // UUID of referenced Column
  compound_key_id?: string; // UUID of compound key this column belongs to (for compound primary/unique keys)
  compound_key_order?: number; // Order within compound key (for compound primary/unique keys)
  compound_key_tag?: string; // Tag/name to identify which compound key this column belongs to (for display)
  default_value?: string;
  constraints?: Record<string, unknown>; // JSON object with constraint definitions and quality rules
  description?: string; // Column description
  quality_rules?: Record<string, unknown> | unknown[]; // Column-level quality rules (ODCS object or ODCL array)
  quality?: unknown[]; // Raw quality array from SDK (ODCL format with great-expectations rules)
  order: number; // display order
  created_at: string; // ISO timestamp
  parent_column_id?: string; // UUID of parent column (for nested columns in STRUCT/ARRAY types)
  nested_columns?: Column[]; // Child columns (for STRUCT/ARRAY types) - used for display hierarchy

  // ODCS v3.1.0 fields (SDK 1.11.0+)
  businessName?: string; // Business-friendly name for the column
  physicalName?: string; // Physical storage name (may differ from logical name)
  logicalTypeOptions?: LogicalTypeOptions; // Validation and metadata for logical types
  primaryKeyPosition?: number; // Position in composite primary key (1-indexed)
  unique?: boolean; // Whether column values must be unique
  partitioned?: boolean; // Whether column is used for table partitioning
  partitionKeyPosition?: number; // Position in partition key (1-indexed)
  clustered?: boolean; // Whether column is used for clustering
  classification?: string; // Data classification level (e.g., "PII", "confidential")
  criticalDataElement?: boolean; // Whether this is a critical data element requiring special handling
  encryptedName?: string; // Name of the encrypted version of this column (if applicable)
  transformSourceObjects?: string[]; // Source objects used in transformation logic
  transformLogic?: string; // Transformation logic or formula applied to this column
  transformDescription?: string; // Description of the transformation logic
  examples?: string[]; // Example values for documentation and testing
  authoritativeDefinitions?: AuthoritativeDefinition[]; // Links to authoritative definitions
  tags?: Array<{ key?: string; value: string }>; // Column-level tags
  customProperties?: Record<string, unknown>; // Custom metadata properties
}

export interface CompoundKey {
  id: string; // UUID
  table_id: string; // UUID
  name?: string; // Optional name for the compound key
  column_ids: string[]; // Array of column IDs in order
  is_primary: boolean; // true for compound primary key, false for compound unique key
  created_at: string; // ISO timestamp
}
