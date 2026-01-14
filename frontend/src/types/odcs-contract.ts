/**
 * ODCS Contract Types (Open Data Contract Standard v3.1.0)
 * Type definitions for native ODCSContract structure used by SDK 2.0.4+
 *
 * These types represent the ODCS YAML structure as parsed/exported by the SDK.
 * They are used for lossless round-trip import/export operations.
 */

import type {
  AuthoritativeDefinition,
  CustomProperty,
  LogicalTypeOptions,
  Owner,
  Pricing,
  Role,
  SLA,
  SupportChannel,
  TeamMember,
} from './table';

/**
 * Contract Description (ODCS v3.1.0)
 * Structured description with purpose and usage information
 */
export interface ContractDescription {
  purpose?: string; // Primary purpose of the data contract
  usage?: string; // How the data should be used
  limitations?: string; // Known limitations or caveats
}

/**
 * Server Definition (ODCS v3.1.0)
 * Defines server/environment information for the data contract
 */
export interface Server {
  environment?: string; // Environment name (e.g., "production", "staging")
  url?: string; // Server URL
  description?: string; // Server description
  type?: string; // Server type (e.g., "bigquery", "snowflake", "postgres")
  customProperties?: CustomProperty[]; // Custom server properties
}

/**
 * Property Tag (ODCS v3.1.0)
 * Tag for properties with optional key
 */
export interface PropertyTag {
  key?: string; // Optional tag key/category
  value: string; // Tag value
}

/**
 * Property/Column Definition (ODCS v3.1.0)
 * Represents a column/field in the schema
 */
export interface Property {
  id?: string; // UUID
  name: string; // Property name
  physicalName?: string; // Physical storage name
  physicalType?: string; // Physical data type (e.g., "VARCHAR(255)")
  logicalType?: string; // Logical data type (e.g., "string", "integer")
  businessName?: string; // Business-friendly name
  description?: string; // Property description
  required?: boolean; // Whether the property is required (not nullable)
  primaryKey?: boolean; // Whether this is a primary key
  primaryKeyPosition?: number; // Position in composite primary key (1-indexed)
  unique?: boolean; // Whether values must be unique
  partitioned?: boolean; // Whether used for partitioning
  partitionKeyPosition?: number; // Position in partition key (1-indexed)
  clustered?: boolean; // Whether used for clustering
  classification?: string; // Data classification (e.g., "PII", "confidential")
  criticalDataElement?: boolean; // Whether this is a critical data element
  encryptedName?: string; // Name of encrypted version
  tags?: PropertyTag[]; // Property-level tags
  examples?: string[]; // Example values
  logicalTypeOptions?: LogicalTypeOptions; // Validation options
  transformSourceObjects?: string[]; // Source objects for transformation
  transformLogic?: string; // Transformation logic
  transformDescription?: string; // Transformation description
  authoritativeDefinitions?: AuthoritativeDefinition[]; // Authoritative sources
  relationships?: PropertyRelationship[]; // Property-level relationships
  customProperties?: CustomProperty[]; // Custom metadata (ODCS v3.1.0 array format)
  quality?: unknown[]; // Quality rules (ODCL format)

  // Nested properties for STRUCT/ARRAY types
  properties?: Property[];
}

/**
 * Property Relationship (ODCS v3.1.0)
 * Defines relationships at the property level
 */
export interface PropertyRelationship {
  type?: string; // Relationship type
  to: string | string[]; // Target property - "schema.property" format
  description?: string; // Relationship description
  customProperties?: CustomProperty[]; // Custom properties including cardinality
}

/**
 * Schema Relationship (ODCS v3.1.0)
 * Defines relationships at the schema/table level
 */
export interface SchemaRelationship {
  type?: string; // Relationship type (e.g., "parent", "child", "references")
  to: string | string[]; // Target schema(s) - can be "schema.property" format
  description?: string; // Relationship description
  customProperties?: CustomProperty[]; // Custom properties including cardinality
}

/**
 * Schema Object (ODCS v3.1.0)
 * Represents a table/entity in the data contract
 */
export interface SchemaObject {
  id?: string; // UUID
  name: string; // Schema/table name
  physicalName?: string; // Physical storage name
  physicalType?: string; // Physical type (e.g., "table", "view")
  businessName?: string; // Business-friendly name
  description?: string | ContractDescription; // Schema description
  status?: string; // Status (e.g., "draft", "active", "deprecated")
  tags?: string[]; // Schema-level tags
  dataGranularityDescription?: string; // Data granularity description
  authoritativeDefinitions?: AuthoritativeDefinition[]; // Authoritative sources
  relationships?: SchemaRelationship[]; // Schema-level relationships
  properties: Property[]; // Columns/fields

  // Optional governance fields
  owner?: Owner;
  roles?: Role[];
  support?: SupportChannel[];
  pricing?: Pricing;
  team?: TeamMember[];
  sla?: SLA;
  quality?: unknown[]; // Table-level quality rules

  // Custom metadata
  customProperties?: CustomProperty[];
}

/**
 * ODCSContract (ODCS v3.1.0)
 * Root data contract structure
 */
export interface ODCSContract {
  // Required fields
  apiVersion: string; // ODCS version (e.g., "v3.1.0")
  kind: 'DataContract'; // Contract type
  id: string; // Contract ID (UUID or URN)
  version: string; // Contract version
  status: string; // Contract status (e.g., "draft", "active")

  // Optional identification
  name?: string; // Contract name
  domain?: string; // Domain name or ID
  dataProduct?: string; // Data product name or ID
  tenant?: string; // Tenant identifier

  // Description
  description?: ContractDescription | string;

  // Schema definition
  schema: SchemaObject[];

  // Server configuration
  servers?: Server[];

  // Governance
  owner?: Owner;
  roles?: Role[];
  support?: SupportChannel[];
  pricing?: Pricing;
  team?: TeamMember[];
  sla?: SLA;

  // Metadata
  tags?: string[];
  customProperties?: CustomProperty[];

  // Quality rules at contract level
  quality?: unknown[];
}

/**
 * Contract Metadata (for workspace storage)
 * Subset of ODCSContract fields preserved during import
 */
export interface ContractMetadata {
  apiVersion?: string;
  kind?: string;
  version?: string;
  status?: string;
  name?: string;
  domain?: string;
  dataProduct?: string;
  tenant?: string;
  description?: ContractDescription | string;
  servers?: Server[];
  customProperties?: CustomProperty[];
  tags?: string[];
}

/**
 * Import Result from SDK V2
 * Structure returned by parse_odcs_yaml_v2
 */
export interface ODCSImportResult {
  contract: ODCSContract;
  tables: unknown[]; // Tables in internal format
  relationships: unknown[]; // Extracted relationships
  errors?: Array<{
    error_type: string;
    field: string;
    message: string;
  }>;
}

/**
 * Export Options for SDK V2
 * Options for export_odcs_yaml_v2
 */
export interface ODCSExportOptions {
  includeMetadata?: boolean; // Include contract metadata
  includeQuality?: boolean; // Include quality rules
  includeRelationships?: boolean; // Include relationships in schema
  prettyPrint?: boolean; // Format output for readability
}
