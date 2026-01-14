/**
 * SDK/WASM Loader
 * Loads and initializes the data-modelling-sdk WASM module from NPM package
 * Requires SDK 2.0.6+ - will throw error if not available
 */

// Import from NPM package - WASM is bundled with the package
import init, * as sdkModule from '@offenedatenmodellierung/data-modelling-sdk';

// Minimum required SDK version
const MIN_SDK_VERSION = '2.0.6';

// Required SDK 2.0.6+ methods - only the essential ODCS V2 methods
// Other methods (ODPS, CADS, etc.) are optional and checked at runtime
const REQUIRED_METHODS = [
  // Core ODCS methods
  'parse_odcs_yaml',
  // ODCS V2 methods (native ODCSContract with lossless round-trip) - required for SDK 2.0.6+
  'parse_odcs_yaml_v2',
];

// SDK module type definition (SDK 2.0.6+)
export interface SDKModule {
  init(): Promise<void>;

  // === ODCS methods ===
  parse_odcs_yaml(yaml: string): string;
  export_to_odcs_yaml(json: string): string;

  // === ODCS V2 methods (SDK 2.0.6+) ===
  // Native ODCSContract support with lossless round-trip
  parse_odcs_yaml_v2(yaml: string): string;
  export_odcs_yaml_v2(contract_json: string): string;
  odcs_contract_to_tables(contract_json: string): string;
  tables_to_odcs_contract(tables_json: string, contract_metadata_json?: string | null): string;
  odcs_contract_to_table_data(contract_json: string): string;
  export_contract_validated(contract_json: string): string;

  // === ODCS Markdown/PDF export ===
  export_table_to_markdown(table_json: string): string;
  export_table_to_pdf(table_json: string, branding_json?: string | null): string;

  // === ODCL methods ===
  parse_odcl_yaml(yaml: string): string;
  is_odcl_format(yaml: string): boolean;

  // === ODPS methods ===
  parse_odps_yaml(yaml: string): string;
  export_to_odps_yaml(json: string): string;
  import_from_odps(yaml: string): string;
  export_to_odps(json: string): string;

  // === ODPS Markdown/PDF export ===
  export_odps_to_markdown(product_json: string): string;
  export_odps_to_pdf(product_json: string, branding_json?: string | null): string;

  // === CADS methods ===
  parse_cads_yaml(yaml: string): string;
  export_to_cads_yaml(json: string): string;
  import_from_cads(yaml: string): string;
  export_to_cads(json: string): string;

  // === CADS Markdown/PDF export ===
  export_cads_to_markdown(asset_json: string): string;
  export_cads_to_pdf(asset_json: string, branding_json?: string | null): string;

  // === Domain methods ===
  import_from_domain(yaml: string): string;
  export_to_domain(json: string): string;

  // === BPMN methods ===
  parse_bpmn_xml(xml: string): string;
  export_to_bpmn_xml(json: string): string;
  validate_bpmn_xml(xml: string): string;

  // === DMN methods ===
  parse_dmn_xml(xml: string): string;
  export_to_dmn_xml(json: string): string;
  validate_dmn_xml(xml: string): string;

  // === OpenAPI methods ===
  parse_openapi(content: string, format: 'yaml' | 'json'): string;
  export_openapi(json: string, format: 'yaml' | 'json'): string;
  openapi_to_odcs(json: string): string;
  import_openapi_spec(domainId: string, content: string, apiName?: string | null): string;
  export_openapi_spec(content: string, sourceFormat: string, targetFormat?: string | null): string;
  analyze_openapi_conversion(content: string, componentName: string): string;
  convert_openapi_to_odcs(
    content: string,
    componentName: string,
    tableName?: string | null
  ): string;

  // === SQL Import/Export methods ===
  import_from_sql(sql: string, dialect: string): string;
  export_to_sql(json: string, dialect: string): string;

  // === AVRO/Protobuf/JSON Schema methods ===
  import_from_avro(avro: string): string;
  export_to_avro(json: string): string;
  import_from_protobuf(protobuf: string): string;
  export_to_protobuf(json: string): string;
  import_from_json_schema(jsonSchema: string): string;
  export_to_json_schema(json: string): string;

  // === Filtering methods ===
  filter_by_tags(workspace_json: string, tag: string): string;
  filter_nodes_by_infrastructure_type(workspace_json: string, infrastructureType: string): string;
  filter_nodes_by_owner(workspace_json: string, owner: string): string;
  filter_relationships_by_infrastructure_type(
    workspace_json: string,
    infrastructureType: string
  ): string;
  filter_relationships_by_owner(workspace_json: string, owner: string): string;

  // === Decision methods ===
  parse_decision_yaml(yaml: string): string;
  parse_decision_index_yaml(yaml: string): string;
  export_decision_to_yaml(decision_json: string): string;
  export_decision_index_to_yaml(index_json: string): string;
  export_decision_to_markdown(decision_json: string): string;
  export_decision_to_branded_markdown(decision_json: string, branding_json?: string | null): string;
  export_decision_to_pdf(decision_json: string, branding_json?: string | null): string;
  create_decision(number: number, title: string, context: string, decision: string): string;
  create_decision_index(): string;
  add_decision_to_index(index_json: string, decision_json: string, filename: string): string;

  // === Knowledge methods ===
  parse_knowledge_yaml(yaml: string): string;
  parse_knowledge_index_yaml(yaml: string): string;
  export_knowledge_to_yaml(article_json: string): string;
  export_knowledge_index_to_yaml(index_json: string): string;
  export_knowledge_to_markdown(article_json: string): string;
  export_knowledge_to_branded_markdown(article_json: string, branding_json?: string | null): string;
  export_knowledge_to_pdf(article_json: string, branding_json?: string | null): string;
  search_knowledge_articles(articles_json: string, query: string): string;
  create_knowledge_article(
    number: number,
    title: string,
    summary: string,
    content: string,
    author: string
  ): string;
  create_knowledge_index(): string;
  add_article_to_knowledge_index(
    index_json: string,
    article_json: string,
    filename: string
  ): string;

  // === Markdown/PDF export methods ===
  export_markdown_to_pdf(
    title: string,
    content: string,
    filename: string,
    branding_json?: string | null
  ): string;
  get_default_markdown_branding(): string;
  get_default_pdf_branding(): string;

  // === Workspace methods ===
  parse_workspace_yaml(yaml: string): string;
  export_workspace_to_yaml(workspace_json: string): string;
  create_workspace(name: string, owner_id: string): string;
  add_domain_to_workspace(workspace_json: string, domain_id: string, domain_name: string): string;
  remove_domain_from_workspace(workspace_json: string, domain_id: string): string;
  add_relationship_to_workspace(workspace_json: string, relationship_json: string): string;
  remove_relationship_from_workspace(workspace_json: string, relationship_id: string): string;
  get_workspace_relationships_for_source(workspace_json: string, source_table_id: string): string;
  get_workspace_relationships_for_target(workspace_json: string, target_table_id: string): string;

  // === Domain Config methods ===
  parse_domain_config_yaml(yaml: string): string;
  export_domain_config_to_yaml(config_json: string): string;
  create_domain(name: string): string;
  create_domain_config(name: string, workspace_id: string): string;
  get_domain_config_id(config_json: string): string;
  add_entity_to_domain_config(config_json: string, entity_type: string, entity_id: string): string;
  remove_entity_from_domain_config(
    config_json: string,
    entity_type: string,
    entity_id: string
  ): string;
  update_domain_view_positions(config_json: string, positions_json: string): string;
  add_odcs_node_to_domain(workspace_json: string, domain_id: string, node_json: string): string;
  add_cads_node_to_domain(workspace_json: string, domain_id: string, node_json: string): string;
  add_system_to_domain(workspace_json: string, domain_id: string, system_json: string): string;

  // === Validation methods ===
  validate_table_name(name: string): string;
  validate_column_name(name: string): string;
  validate_data_type(data_type: string): string;
  validate_description(desc: string): string;
  validate_uuid(id: string): string;
  validate_odps(yaml: string): void;
  validate_no_self_reference(source_table_id: string, target_table_id: string): string;
  validate_pattern_exclusivity(table_json: string): string;
  check_circular_dependency(
    relationships_json: string,
    source_table_id: string,
    target_table_id: string
  ): string;
  detect_naming_conflicts(existing_tables_json: string, new_tables_json: string): string;

  // === Utility methods ===
  sanitize_description(desc: string): string;
  sanitize_sql_identifier(name: string, dialect: string): string;
  parse_tag(tag_str: string): string;
  serialize_tag(tag_json: string): string;
  convert_to_odcs(input: string, format?: string | null): string;
  migrate_dataflow_to_domain(dataflow_yaml: string, domain_name?: string | null): string;

  // === Browser storage methods ===
  save_model(
    db_name: string,
    store_name: string,
    workspace_path: string,
    model_json: string
  ): Promise<unknown>;
  load_model(db_name: string, store_name: string, workspace_path: string): Promise<unknown>;
}

/**
 * Error thrown when SDK fails to load or is incompatible
 */
export class SDKLoadError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'SDKLoadError';
  }
}

class SDKLoader {
  private module: SDKModule | null = null;
  private loadingPromise: Promise<SDKModule> | null = null;
  private initialized = false;
  private loadError: SDKLoadError | null = null;

  /**
   * Load the SDK WASM module
   * @throws SDKLoadError if WASM fails to load or is incompatible
   */
  async load(): Promise<SDKModule> {
    // If we've already failed, throw the cached error
    if (this.loadError) {
      throw this.loadError;
    }

    if (this.module && this.initialized) {
      return this.module;
    }

    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    this.loadingPromise = this._loadModule();

    try {
      this.module = await this.loadingPromise;
      return this.module;
    } catch (error) {
      // Cache the error for future calls
      this.loadError =
        error instanceof SDKLoadError
          ? error
          : new SDKLoadError(
              error instanceof Error ? error.message : 'Unknown SDK loading error',
              error instanceof Error ? error : undefined
            );
      throw this.loadError;
    }
  }

  /**
   * Internal method to load the WASM module from NPM package
   * @throws SDKLoadError if loading fails or SDK version is incompatible
   */
  private async _loadModule(): Promise<SDKModule> {
    console.log('[SDKLoader] Starting SDK initialization...');

    try {
      // Initialize the WASM module - this loads the bundled .wasm file
      await init();
      this.initialized = true;
      console.log('[SDKLoader] WASM module initialized successfully');

      // Create the module wrapper
      // Cast through unknown since the SDK module may have more/fewer methods than our interface
      const module = {
        init: async () => {
          // Already initialized
        },
        ...sdkModule,
      } as unknown as SDKModule;

      // Verify all required methods are available
      this.verifyRequiredMethods(module);

      // Log available methods count
      const methodCount = Object.keys(module).filter(
        (key) => typeof (module as unknown as Record<string, unknown>)[key] === 'function'
      ).length;
      console.log(
        `[SDKLoader] SDK ${MIN_SDK_VERSION}+ loaded successfully (${methodCount} methods available)`
      );

      return module;
    } catch (error) {
      console.error('[SDKLoader] Failed to load SDK WASM module:', error);

      // Provide helpful error message
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to initialize WASM module';

      throw new SDKLoadError(
        `Failed to load data-modelling-sdk WASM module (requires v${MIN_SDK_VERSION}+). ` +
          `Please ensure the SDK package is properly installed. Error: ${errorMessage}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Verify all required SDK methods are available
   * @throws SDKLoadError if any required methods are missing
   */
  private verifyRequiredMethods(module: SDKModule): void {
    const missingMethods = REQUIRED_METHODS.filter(
      (method) => typeof (module as unknown as Record<string, unknown>)[method] !== 'function'
    );

    if (missingMethods.length > 0) {
      throw new SDKLoadError(
        `SDK version is incompatible (requires v${MIN_SDK_VERSION}+). ` +
          `Missing methods: ${missingMethods.join(', ')}. ` +
          `Please update @offenedatenmodellierung/data-modelling-sdk to v${MIN_SDK_VERSION} or later.`
      );
    }
  }

  /**
   * Get the loaded SDK module
   * @throws SDKLoadError if SDK failed to load
   */
  getModule(): SDKModule {
    if (this.loadError) {
      throw this.loadError;
    }
    if (!this.module || !this.initialized) {
      throw new SDKLoadError('SDK not loaded. Call load() first.');
    }
    return this.module;
  }

  /**
   * Check if SDK is loaded successfully
   */
  isLoaded(): boolean {
    return this.module !== null && this.initialized && this.loadError === null;
  }

  /**
   * Check if ODCS export is available (SDK 2.0.6+ always has this)
   * Kept for backwards compatibility with existing code
   */
  hasODCSExport(): boolean {
    return this.isLoaded();
  }

  /**
   * Check if ODPS export is available (SDK 2.0.6+ always has this)
   * Kept for backwards compatibility with existing code
   */
  hasODPSExport(): boolean {
    return this.isLoaded();
  }

  /**
   * Check if CADS export is available (SDK 2.0.6+ always has this)
   * Kept for backwards compatibility with existing code
   */
  hasCADSExport(): boolean {
    return this.isLoaded();
  }

  /**
   * Check if Decision support is available (SDK 2.0.6+ always has this)
   * Kept for backwards compatibility with existing code
   */
  hasDecisionSupport(): boolean {
    return this.isLoaded();
  }

  /**
   * Check if Knowledge support is available (SDK 2.0.6+ always has this)
   * Kept for backwards compatibility with existing code
   */
  hasKnowledgeSupport(): boolean {
    return this.isLoaded();
  }

  /**
   * Check if PDF export is available (SDK 2.0.6+ always has this)
   * Kept for backwards compatibility with existing code
   */
  hasPDFExport(): boolean {
    return this.isLoaded();
  }

  /**
   * Check if Markdown export is available (SDK 2.0.6+ always has this)
   * Kept for backwards compatibility with existing code
   */
  hasMarkdownExport(): boolean {
    return this.isLoaded();
  }

  /**
   * Get the minimum required SDK version
   */
  getSDKVersion(): string {
    return MIN_SDK_VERSION;
  }

  /**
   * Get any load error that occurred
   */
  getLoadError(): SDKLoadError | null {
    return this.loadError;
  }

  /**
   * Reset the loader (for testing)
   */
  reset(): void {
    this.module = null;
    this.loadingPromise = null;
    this.initialized = false;
    this.loadError = null;
  }
}

// Export singleton instance
export const sdkLoader = new SDKLoader();
