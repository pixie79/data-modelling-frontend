/* tslint:disable */
/* eslint-disable */

/**
 * Add a CADS node to a domain in a DataModel.
 *
 * # Arguments
 *
 * * `workspace_json` - JSON string containing workspace/data model structure
 * * `domain_id` - Domain UUID as string
 * * `node_json` - JSON string containing CADSNode
 *
 * # Returns
 *
 * JSON string containing updated DataModel, or JsValue error
 */
export function add_cads_node_to_domain(workspace_json: string, domain_id: string, node_json: string): string;

/**
 * Add a domain reference to a workspace.
 *
 * # Arguments
 *
 * * `workspace_json` - JSON string containing Workspace
 * * `domain_id` - Domain UUID as string
 * * `domain_name` - Domain name
 *
 * # Returns
 *
 * JSON string containing updated Workspace, or JsValue error
 */
export function add_domain_to_workspace(workspace_json: string, domain_id: string, domain_name: string): string;

/**
 * Add an entity reference to a domain config.
 *
 * # Arguments
 *
 * * `config_json` - JSON string containing DomainConfig
 * * `entity_type` - Entity type: "system", "table", "product", "asset", "process", "decision"
 * * `entity_id` - Entity UUID as string
 *
 * # Returns
 *
 * JSON string containing updated DomainConfig, or JsValue error
 */
export function add_entity_to_domain_config(config_json: string, entity_type: string, entity_id: string): string;

/**
 * Add an ODCS node to a domain in a DataModel.
 *
 * # Arguments
 *
 * * `workspace_json` - JSON string containing workspace/data model structure
 * * `domain_id` - Domain UUID as string
 * * `node_json` - JSON string containing ODCSNode
 *
 * # Returns
 *
 * JSON string containing updated DataModel, or JsValue error
 */
export function add_odcs_node_to_domain(workspace_json: string, domain_id: string, node_json: string): string;

/**
 * Add a system to a domain in a DataModel.
 *
 * # Arguments
 *
 * * `workspace_json` - JSON string containing workspace/data model structure
 * * `domain_id` - Domain UUID as string
 * * `system_json` - JSON string containing System
 *
 * # Returns
 *
 * JSON string containing updated DataModel, or JsValue error
 */
export function add_system_to_domain(workspace_json: string, domain_id: string, system_json: string): string;

/**
 * Analyze an OpenAPI component for conversion feasibility.
 *
 * # Arguments
 *
 * * `openapi_content` - OpenAPI YAML or JSON content as a string
 * * `component_name` - Name of the schema component to analyze
 *
 * # Returns
 *
 * JSON string containing ConversionReport, or JsValue error
 */
export function analyze_openapi_conversion(openapi_content: string, component_name: string): string;

/**
 * Check for circular dependencies in relationships.
 *
 * # Arguments
 *
 * * `relationships_json` - JSON string containing array of existing relationships
 * * `source_table_id` - Source table ID (UUID string) of the new relationship
 * * `target_table_id` - Target table ID (UUID string) of the new relationship
 *
 * # Returns
 *
 * JSON string with result: `{"has_cycle": true/false, "cycle_path": [...]}` or error
 */
export function check_circular_dependency(relationships_json: string, source_table_id: string, target_table_id: string): string;

/**
 * Convert an OpenAPI schema component to an ODCS table.
 *
 * # Arguments
 *
 * * `openapi_content` - OpenAPI YAML or JSON content as a string
 * * `component_name` - Name of the schema component to convert
 * * `table_name` - Optional desired ODCS table name (uses component_name if None)
 *
 * # Returns
 *
 * JSON string containing ODCS Table, or JsValue error
 */
export function convert_openapi_to_odcs(openapi_content: string, component_name: string, table_name?: string | null): string;

/**
 * Convert any format to ODCS v3.1.0 YAML format.
 *
 * # Arguments
 *
 * * `input` - Format-specific content as a string
 * * `format` - Optional format identifier. If None, attempts auto-detection.
 *   Supported formats: "sql", "json_schema", "avro", "protobuf", "odcl", "odcs", "cads", "odps", "domain"
 *
 * # Returns
 *
 * ODCS v3.1.0 YAML string, or JsValue error
 */
export function convert_to_odcs(input: string, format?: string | null): string;

/**
 * Create a new business domain.
 *
 * # Arguments
 *
 * * `name` - Domain name
 *
 * # Returns
 *
 * JSON string containing Domain, or JsValue error
 */
export function create_domain(name: string): string;

/**
 * Create a new domain configuration.
 *
 * # Arguments
 *
 * * `name` - Domain name
 * * `workspace_id` - Workspace UUID as string
 *
 * # Returns
 *
 * JSON string containing DomainConfig, or JsValue error
 */
export function create_domain_config(name: string, workspace_id: string): string;

/**
 * Create a new workspace.
 *
 * # Arguments
 *
 * * `name` - Workspace name
 * * `owner_id` - Owner UUID as string
 *
 * # Returns
 *
 * JSON string containing Workspace, or JsValue error
 */
export function create_workspace(name: string, owner_id: string): string;

/**
 * Detect naming conflicts between existing and new tables.
 *
 * # Arguments
 *
 * * `existing_tables_json` - JSON string containing array of existing tables
 * * `new_tables_json` - JSON string containing array of new tables
 *
 * # Returns
 *
 * JSON string containing array of naming conflicts
 */
export function detect_naming_conflicts(existing_tables_json: string, new_tables_json: string): string;

/**
 * Export a domain config to YAML format.
 *
 * # Arguments
 *
 * * `config_json` - JSON string containing DomainConfig
 *
 * # Returns
 *
 * DomainConfig YAML format string, or JsValue error
 */
export function export_domain_config_to_yaml(config_json: string): string;

/**
 * Export an OpenAPI specification to YAML or JSON content.
 *
 * # Arguments
 *
 * * `content` - OpenAPI content as a string
 * * `source_format` - Source format ("yaml" or "json")
 * * `target_format` - Optional target format for conversion (None to keep original)
 *
 * # Returns
 *
 * OpenAPI content in requested format, or JsValue error
 */
export function export_openapi_spec(content: string, source_format: string, target_format?: string | null): string;

/**
 * Export a data model to AVRO schema.
 *
 * # Arguments
 *
 * * `workspace_json` - JSON string containing workspace/data model structure
 *
 * # Returns
 *
 * AVRO schema JSON string, or JsValue error
 */
export function export_to_avro(workspace_json: string): string;

/**
 * Export a CADS asset to YAML format.
 *
 * # Arguments
 *
 * * `asset_json` - JSON string containing CADS asset
 *
 * # Returns
 *
 * CADS YAML format string, or JsValue error
 */
export function export_to_cads(asset_json: string): string;

/**
 * Export a Domain to YAML format.
 *
 * # Arguments
 *
 * * `domain_json` - JSON string containing Domain
 *
 * # Returns
 *
 * Domain YAML format string, or JsValue error
 */
export function export_to_domain(domain_json: string): string;

/**
 * Export a data model to JSON Schema definition.
 *
 * # Arguments
 *
 * * `workspace_json` - JSON string containing workspace/data model structure
 *
 * # Returns
 *
 * JSON Schema definition string, or JsValue error
 */
export function export_to_json_schema(workspace_json: string): string;

/**
 * Export a workspace structure to ODCS YAML format.
 *
 * # Arguments
 *
 * * `workspace_json` - JSON string containing workspace/data model structure
 *
 * # Returns
 *
 * ODCS YAML format string, or JsValue error
 */
export function export_to_odcs_yaml(workspace_json: string): string;

/**
 * Export an ODPS data product to YAML format.
 *
 * # Arguments
 *
 * * `product_json` - JSON string containing ODPS data product
 *
 * # Returns
 *
 * ODPS YAML format string, or JsValue error
 */
export function export_to_odps(product_json: string): string;

/**
 * Export a data model to Protobuf schema.
 *
 * # Arguments
 *
 * * `workspace_json` - JSON string containing workspace/data model structure
 *
 * # Returns
 *
 * Protobuf schema text, or JsValue error
 */
export function export_to_protobuf(workspace_json: string): string;

/**
 * Export a data model to SQL CREATE TABLE statements.
 *
 * # Arguments
 *
 * * `workspace_json` - JSON string containing workspace/data model structure
 * * `dialect` - SQL dialect ("postgresql", "mysql", "sqlserver", "databricks")
 *
 * # Returns
 *
 * SQL CREATE TABLE statements, or JsValue error
 */
export function export_to_sql(workspace_json: string, dialect: string): string;

/**
 * Export a workspace to YAML format.
 *
 * # Arguments
 *
 * * `workspace_json` - JSON string containing Workspace
 *
 * # Returns
 *
 * Workspace YAML format string, or JsValue error
 */
export function export_workspace_to_yaml(workspace_json: string): string;

/**
 * Filter Data Flow nodes and relationships by tag.
 *
 * # Arguments
 *
 * * `workspace_json` - JSON string containing workspace/data model structure
 * * `tag` - Tag to filter by
 *
 * # Returns
 *
 * JSON string containing object with `nodes` and `relationships` arrays, or JsValue error
 */
export function filter_by_tags(workspace_json: string, tag: string): string;

/**
 * Filter Data Flow nodes (tables) by infrastructure type.
 *
 * # Arguments
 *
 * * `workspace_json` - JSON string containing workspace/data model structure
 * * `infrastructure_type` - Infrastructure type string (e.g., "Kafka", "PostgreSQL")
 *
 * # Returns
 *
 * JSON string containing array of matching tables, or JsValue error
 */
export function filter_nodes_by_infrastructure_type(workspace_json: string, infrastructure_type: string): string;

/**
 * Filter Data Flow nodes (tables) by owner.
 *
 * # Arguments
 *
 * * `workspace_json` - JSON string containing workspace/data model structure
 * * `owner` - Owner name to filter by (case-sensitive exact match)
 *
 * # Returns
 *
 * JSON string containing array of matching tables, or JsValue error
 */
export function filter_nodes_by_owner(workspace_json: string, owner: string): string;

/**
 * Filter Data Flow relationships by infrastructure type.
 *
 * # Arguments
 *
 * * `workspace_json` - JSON string containing workspace/data model structure
 * * `infrastructure_type` - Infrastructure type string (e.g., "Kafka", "PostgreSQL")
 *
 * # Returns
 *
 * JSON string containing array of matching relationships, or JsValue error
 */
export function filter_relationships_by_infrastructure_type(workspace_json: string, infrastructure_type: string): string;

/**
 * Filter Data Flow relationships by owner.
 *
 * # Arguments
 *
 * * `workspace_json` - JSON string containing workspace/data model structure
 * * `owner` - Owner name to filter by (case-sensitive exact match)
 *
 * # Returns
 *
 * JSON string containing array of matching relationships, or JsValue error
 */
export function filter_relationships_by_owner(workspace_json: string, owner: string): string;

/**
 * Get the domain ID from a domain config JSON.
 *
 * # Arguments
 *
 * * `config_json` - JSON string containing DomainConfig
 *
 * # Returns
 *
 * Domain UUID as string, or JsValue error
 */
export function get_domain_config_id(config_json: string): string;

/**
 * Import data model from AVRO schema.
 *
 * # Arguments
 *
 * * `avro_content` - AVRO schema JSON as a string
 *
 * # Returns
 *
 * JSON string containing ImportResult object, or JsValue error
 */
export function import_from_avro(avro_content: string): string;

/**
 * Import CADS YAML content and return a structured representation.
 *
 * # Arguments
 *
 * * `yaml_content` - CADS YAML content as a string
 *
 * # Returns
 *
 * JSON string containing CADS asset, or JsValue error
 */
export function import_from_cads(yaml_content: string): string;

/**
 * Import Domain YAML content and return a structured representation.
 *
 * # Arguments
 *
 * * `yaml_content` - Domain YAML content as a string
 *
 * # Returns
 *
 * JSON string containing Domain, or JsValue error
 */
export function import_from_domain(yaml_content: string): string;

/**
 * Import data model from JSON Schema definition.
 *
 * # Arguments
 *
 * * `json_schema_content` - JSON Schema definition as a string
 *
 * # Returns
 *
 * JSON string containing ImportResult object, or JsValue error
 */
export function import_from_json_schema(json_schema_content: string): string;

/**
 * Import ODPS YAML content and return a structured representation.
 *
 * # Arguments
 *
 * * `yaml_content` - ODPS YAML content as a string
 *
 * # Returns
 *
 * JSON string containing ODPS data product, or JsValue error
 */
export function import_from_odps(yaml_content: string): string;

/**
 * Import data model from Protobuf schema.
 *
 * # Arguments
 *
 * * `protobuf_content` - Protobuf schema text
 *
 * # Returns
 *
 * JSON string containing ImportResult object, or JsValue error
 */
export function import_from_protobuf(protobuf_content: string): string;

/**
 * Import data model from SQL CREATE TABLE statements.
 *
 * # Arguments
 *
 * * `sql_content` - SQL CREATE TABLE statements
 * * `dialect` - SQL dialect ("postgresql", "mysql", "sqlserver", "databricks")
 *
 * # Returns
 *
 * JSON string containing ImportResult object, or JsValue error
 */
export function import_from_sql(sql_content: string, dialect: string): string;

/**
 * Import an OpenAPI specification from YAML or JSON content.
 *
 * # Arguments
 *
 * * `domain_id` - Domain UUID as string
 * * `content` - OpenAPI YAML or JSON content as a string
 * * `api_name` - Optional API name (extracted from info.title if not provided)
 *
 * # Returns
 *
 * JSON string containing OpenAPIModel, or JsValue error
 */
export function import_openapi_spec(domain_id: string, content: string, api_name?: string | null): string;

/**
 * Check if the given YAML content is in legacy ODCL format.
 *
 * Returns true if the content is in ODCL format (Data Contract Specification
 * or simple ODCL format), false if it's in ODCS v3.x format or invalid.
 *
 * # Arguments
 *
 * * `yaml_content` - YAML content to check
 *
 * # Returns
 *
 * Boolean indicating if the content is ODCL format
 */
export function is_odcl_format(yaml_content: string): boolean;

/**
 * Load a model from browser storage (IndexedDB/localStorage).
 *
 * # Arguments
 *
 * * `db_name` - IndexedDB database name
 * * `store_name` - Object store name
 * * `workspace_path` - Workspace path to load from
 *
 * # Returns
 *
 * Promise that resolves to JSON string containing ModelLoadResult, or rejects with error
 */
export function load_model(db_name: string, store_name: string, workspace_path: string): Promise<any>;

/**
 * Migrate DataFlow YAML to Domain schema format.
 *
 * # Arguments
 *
 * * `dataflow_yaml` - DataFlow YAML content as a string
 * * `domain_name` - Optional domain name (defaults to "MigratedDomain")
 *
 * # Returns
 *
 * JSON string containing Domain, or JsValue error
 */
export function migrate_dataflow_to_domain(dataflow_yaml: string, domain_name?: string | null): string;

/**
 * Parse domain config YAML content and return a structured representation.
 *
 * # Arguments
 *
 * * `yaml_content` - Domain config YAML content as a string
 *
 * # Returns
 *
 * JSON string containing DomainConfig, or JsValue error
 */
export function parse_domain_config_yaml(yaml_content: string): string;

/**
 * Import data model from legacy ODCL (Open Data Contract Language) YAML format.
 *
 * This function parses legacy ODCL formats including:
 * - Data Contract Specification format (dataContractSpecification, models, definitions)
 * - Simple ODCL format (name, columns)
 *
 * For ODCS v3.1.0/v3.0.x format, use `parse_odcs_yaml` instead.
 *
 * # Arguments
 *
 * * `yaml_content` - ODCL YAML content as a string
 *
 * # Returns
 *
 * JSON string containing ImportResult object, or JsValue error
 */
export function parse_odcl_yaml(yaml_content: string): string;

/**
 * Parse ODCS YAML content and return a structured workspace representation.
 *
 * # Arguments
 *
 * * `yaml_content` - ODCS YAML content as a string
 *
 * # Returns
 *
 * JSON string containing ImportResult object, or JsValue error
 */
export function parse_odcs_yaml(yaml_content: string): string;

/**
 * Parse a tag string into a Tag enum.
 *
 * # Arguments
 *
 * * `tag_str` - Tag string (Simple, Pair, or List format)
 *
 * # Returns
 *
 * JSON string containing Tag, or JsValue error
 */
export function parse_tag(tag_str: string): string;

/**
 * Parse workspace YAML content and return a structured representation.
 *
 * # Arguments
 *
 * * `yaml_content` - Workspace YAML content as a string
 *
 * # Returns
 *
 * JSON string containing Workspace, or JsValue error
 */
export function parse_workspace_yaml(yaml_content: string): string;

/**
 * Remove a domain reference from a workspace.
 *
 * # Arguments
 *
 * * `workspace_json` - JSON string containing Workspace
 * * `domain_id` - Domain UUID as string to remove
 *
 * # Returns
 *
 * JSON string containing updated Workspace, or JsValue error
 */
export function remove_domain_from_workspace(workspace_json: string, domain_id: string): string;

/**
 * Remove an entity reference from a domain config.
 *
 * # Arguments
 *
 * * `config_json` - JSON string containing DomainConfig
 * * `entity_type` - Entity type: "system", "table", "product", "asset", "process", "decision"
 * * `entity_id` - Entity UUID as string to remove
 *
 * # Returns
 *
 * JSON string containing updated DomainConfig, or JsValue error
 */
export function remove_entity_from_domain_config(config_json: string, entity_type: string, entity_id: string): string;

/**
 * Sanitize a description string.
 *
 * # Arguments
 *
 * * `desc` - Description string to sanitize
 *
 * # Returns
 *
 * Sanitized description string
 */
export function sanitize_description(desc: string): string;

/**
 * Sanitize a SQL identifier by quoting it.
 *
 * # Arguments
 *
 * * `name` - SQL identifier to sanitize
 * * `dialect` - SQL dialect ("postgresql", "mysql", "sqlserver", etc.)
 *
 * # Returns
 *
 * Sanitized SQL identifier string
 */
export function sanitize_sql_identifier(name: string, dialect: string): string;

/**
 * Save a model to browser storage (IndexedDB/localStorage).
 *
 * # Arguments
 *
 * * `db_name` - IndexedDB database name
 * * `store_name` - Object store name
 * * `workspace_path` - Workspace path to save to
 * * `model_json` - JSON string containing DataModel to save
 *
 * # Returns
 *
 * Promise that resolves to success message, or rejects with error
 */
export function save_model(db_name: string, store_name: string, workspace_path: string, model_json: string): Promise<any>;

/**
 * Serialize a Tag enum to string format.
 *
 * # Arguments
 *
 * * `tag_json` - JSON string containing Tag
 *
 * # Returns
 *
 * Tag string (Simple, Pair, or List format), or JsValue error
 */
export function serialize_tag(tag_json: string): string;

/**
 * Update domain config with new view positions.
 *
 * # Arguments
 *
 * * `config_json` - JSON string containing DomainConfig
 * * `positions_json` - JSON string containing view positions map
 *
 * # Returns
 *
 * JSON string containing updated DomainConfig, or JsValue error
 */
export function update_domain_view_positions(config_json: string, positions_json: string): string;

/**
 * Validate a column name.
 *
 * # Arguments
 *
 * * `name` - Column name to validate
 *
 * # Returns
 *
 * JSON string with validation result: `{"valid": true}` or `{"valid": false, "error": "error message"}`
 */
export function validate_column_name(name: string): string;

/**
 * Validate a data type string.
 *
 * # Arguments
 *
 * * `data_type` - Data type string to validate
 *
 * # Returns
 *
 * JSON string with validation result: `{"valid": true}` or `{"valid": false, "error": "error message"}`
 */
export function validate_data_type(data_type: string): string;

/**
 * Validate a description string.
 *
 * # Arguments
 *
 * * `desc` - Description string to validate
 *
 * # Returns
 *
 * JSON string with validation result: `{"valid": true}` or `{"valid": false, "error": "error message"}`
 */
export function validate_description(desc: string): string;

/**
 * Validate that source and target tables are different (no self-reference).
 *
 * # Arguments
 *
 * * `source_table_id` - Source table ID (UUID string)
 * * `target_table_id` - Target table ID (UUID string)
 *
 * # Returns
 *
 * JSON string with validation result: `{"valid": true}` or `{"valid": false, "self_reference": {...}}`
 */
export function validate_no_self_reference(source_table_id: string, target_table_id: string): string;

/**
 * Validate ODPS YAML content against the ODPS JSON Schema.
 *
 * # Arguments
 *
 * * `yaml_content` - ODPS YAML content as a string
 *
 * # Returns
 *
 * Empty string on success, or error message string
 */
export function validate_odps(yaml_content: string): void;

/**
 * Validate pattern exclusivity for a table (SCD pattern and Data Vault classification are mutually exclusive).
 *
 * # Arguments
 *
 * * `table_json` - JSON string containing table to validate
 *
 * # Returns
 *
 * JSON string with validation result: `{"valid": true}` or `{"valid": false, "violation": {...}}`
 */
export function validate_pattern_exclusivity(table_json: string): string;

/**
 * Validate a table name.
 *
 * # Arguments
 *
 * * `name` - Table name to validate
 *
 * # Returns
 *
 * JSON string with validation result: `{"valid": true}` or `{"valid": false, "error": "error message"}`
 */
export function validate_table_name(name: string): string;

/**
 * Validate a UUID string.
 *
 * # Arguments
 *
 * * `id` - UUID string to validate
 *
 * # Returns
 *
 * JSON string with validation result: `{"valid": true, "uuid": "..."}` or `{"valid": false, "error": "error message"}`
 */
export function validate_uuid(id: string): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly add_cads_node_to_domain: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number, number];
  readonly add_domain_to_workspace: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number, number];
  readonly add_entity_to_domain_config: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number, number];
  readonly add_odcs_node_to_domain: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number, number];
  readonly add_system_to_domain: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number, number];
  readonly analyze_openapi_conversion: (a: number, b: number, c: number, d: number) => [number, number, number, number];
  readonly check_circular_dependency: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number, number];
  readonly convert_openapi_to_odcs: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number, number];
  readonly convert_to_odcs: (a: number, b: number, c: number, d: number) => [number, number, number, number];
  readonly create_domain: (a: number, b: number) => [number, number, number, number];
  readonly create_domain_config: (a: number, b: number, c: number, d: number) => [number, number, number, number];
  readonly create_workspace: (a: number, b: number, c: number, d: number) => [number, number, number, number];
  readonly detect_naming_conflicts: (a: number, b: number, c: number, d: number) => [number, number, number, number];
  readonly export_domain_config_to_yaml: (a: number, b: number) => [number, number, number, number];
  readonly export_openapi_spec: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number, number];
  readonly export_to_avro: (a: number, b: number) => [number, number, number, number];
  readonly export_to_cads: (a: number, b: number) => [number, number, number, number];
  readonly export_to_domain: (a: number, b: number) => [number, number, number, number];
  readonly export_to_json_schema: (a: number, b: number) => [number, number, number, number];
  readonly export_to_odcs_yaml: (a: number, b: number) => [number, number, number, number];
  readonly export_to_odps: (a: number, b: number) => [number, number, number, number];
  readonly export_to_protobuf: (a: number, b: number) => [number, number, number, number];
  readonly export_to_sql: (a: number, b: number, c: number, d: number) => [number, number, number, number];
  readonly export_workspace_to_yaml: (a: number, b: number) => [number, number, number, number];
  readonly filter_by_tags: (a: number, b: number, c: number, d: number) => [number, number, number, number];
  readonly filter_nodes_by_infrastructure_type: (a: number, b: number, c: number, d: number) => [number, number, number, number];
  readonly filter_nodes_by_owner: (a: number, b: number, c: number, d: number) => [number, number, number, number];
  readonly filter_relationships_by_infrastructure_type: (a: number, b: number, c: number, d: number) => [number, number, number, number];
  readonly filter_relationships_by_owner: (a: number, b: number, c: number, d: number) => [number, number, number, number];
  readonly get_domain_config_id: (a: number, b: number) => [number, number, number, number];
  readonly import_from_avro: (a: number, b: number) => [number, number, number, number];
  readonly import_from_cads: (a: number, b: number) => [number, number, number, number];
  readonly import_from_domain: (a: number, b: number) => [number, number, number, number];
  readonly import_from_json_schema: (a: number, b: number) => [number, number, number, number];
  readonly import_from_odps: (a: number, b: number) => [number, number, number, number];
  readonly import_from_protobuf: (a: number, b: number) => [number, number, number, number];
  readonly import_from_sql: (a: number, b: number, c: number, d: number) => [number, number, number, number];
  readonly import_openapi_spec: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number, number];
  readonly is_odcl_format: (a: number, b: number) => number;
  readonly load_model: (a: number, b: number, c: number, d: number, e: number, f: number) => any;
  readonly migrate_dataflow_to_domain: (a: number, b: number, c: number, d: number) => [number, number, number, number];
  readonly parse_domain_config_yaml: (a: number, b: number) => [number, number, number, number];
  readonly parse_odcl_yaml: (a: number, b: number) => [number, number, number, number];
  readonly parse_odcs_yaml: (a: number, b: number) => [number, number, number, number];
  readonly parse_tag: (a: number, b: number) => [number, number, number, number];
  readonly parse_workspace_yaml: (a: number, b: number) => [number, number, number, number];
  readonly remove_domain_from_workspace: (a: number, b: number, c: number, d: number) => [number, number, number, number];
  readonly remove_entity_from_domain_config: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number, number];
  readonly sanitize_description: (a: number, b: number) => [number, number];
  readonly sanitize_sql_identifier: (a: number, b: number, c: number, d: number) => [number, number];
  readonly save_model: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => any;
  readonly serialize_tag: (a: number, b: number) => [number, number, number, number];
  readonly update_domain_view_positions: (a: number, b: number, c: number, d: number) => [number, number, number, number];
  readonly validate_column_name: (a: number, b: number) => [number, number, number, number];
  readonly validate_data_type: (a: number, b: number) => [number, number, number, number];
  readonly validate_description: (a: number, b: number) => [number, number, number, number];
  readonly validate_no_self_reference: (a: number, b: number, c: number, d: number) => [number, number, number, number];
  readonly validate_odps: (a: number, b: number) => [number, number];
  readonly validate_pattern_exclusivity: (a: number, b: number) => [number, number, number, number];
  readonly validate_table_name: (a: number, b: number) => [number, number, number, number];
  readonly validate_uuid: (a: number, b: number) => [number, number, number, number];
  readonly wasm_bindgen__convert__closures________invoke__h45b2f24db2feab69: (a: number, b: number, c: any) => void;
  readonly wasm_bindgen__closure__destroy__hdae3aa893cc8b3d0: (a: number, b: number) => void;
  readonly wasm_bindgen__convert__closures_____invoke__h05ea8688cde0d495: (a: number, b: number, c: any) => void;
  readonly wasm_bindgen__closure__destroy__h90087f72df793db4: (a: number, b: number) => void;
  readonly wasm_bindgen__convert__closures_____invoke__h3f04f8768b5c65b3: (a: number, b: number, c: any, d: any) => void;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_exn_store: (a: number) => void;
  readonly __externref_table_alloc: () => number;
  readonly __wbindgen_externrefs: WebAssembly.Table;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __externref_table_dealloc: (a: number) => void;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
