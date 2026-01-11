/**
 * SDK/WASM Loader
 * Loads and initializes the data-modelling-sdk WASM module from NPM package
 */

// Import from NPM package - WASM is bundled with the package
import init, * as sdkModule from '@offenedatenmodellierung/data-modelling-sdk';

// SDK module type definition (SDK 1.14.1+)
export interface SDKModule {
  init(): Promise<void>;

  // === ODCS methods ===
  parse_odcs_yaml?(yaml: string): string;
  export_to_odcs_yaml?(json: string): string;

  // === ODCS Markdown/PDF export (SDK 1.14.1+) ===
  export_table_to_markdown?(table_json: string): string;
  export_table_to_pdf?(table_json: string, branding_json?: string | null): string;

  // === ODCL methods (SDK 1.8.4+) ===
  parse_odcl_yaml?(yaml: string): string;
  is_odcl_format?(yaml: string): boolean;

  // === ODPS methods (SDK 1.5.0+) ===
  parse_odps_yaml?(yaml: string): string;
  export_to_odps_yaml?(json: string): string;
  import_from_odps?(yaml: string): string;
  export_to_odps?(json: string): string;

  // === ODPS Markdown/PDF export (SDK 1.14.1+) ===
  export_odps_to_markdown?(product_json: string): string;
  export_odps_to_pdf?(product_json: string, branding_json?: string | null): string;

  // === CADS methods (SDK 1.5.0+) ===
  parse_cads_yaml?(yaml: string): string;
  export_to_cads_yaml?(json: string): string;
  import_from_cads?(yaml: string): string;
  export_to_cads?(json: string): string;

  // === CADS Markdown/PDF export (SDK 1.14.1+) ===
  export_cads_to_markdown?(asset_json: string): string;
  export_cads_to_pdf?(asset_json: string, branding_json?: string | null): string;

  // === Domain methods (SDK 1.14.0+) ===
  import_from_domain?(yaml: string): string;
  export_to_domain?(json: string): string;

  // === BPMN methods (SDK 1.5.0+) ===
  parse_bpmn_xml?(xml: string): string;
  export_to_bpmn_xml?(json: string): string;
  validate_bpmn_xml?(xml: string): string;

  // === DMN methods (SDK 1.5.0+) ===
  parse_dmn_xml?(xml: string): string;
  export_to_dmn_xml?(json: string): string;
  validate_dmn_xml?(xml: string): string;

  // === OpenAPI methods (SDK 1.5.0+) ===
  parse_openapi?(content: string, format: 'yaml' | 'json'): string;
  export_openapi?(json: string, format: 'yaml' | 'json'): string;
  openapi_to_odcs?(json: string): string;
  import_openapi_spec?(domainId: string, content: string, apiName?: string | null): string;
  export_openapi_spec?(content: string, sourceFormat: string, targetFormat?: string | null): string;
  analyze_openapi_conversion?(content: string, componentName: string): string;
  convert_openapi_to_odcs?(
    content: string,
    componentName: string,
    tableName?: string | null
  ): string;

  // === SQL Import/Export methods (SDK 1.6.1+) ===
  import_from_sql?(sql: string, dialect: string): string;
  export_to_sql?(json: string, dialect: string): string;

  // === AVRO/Protobuf/JSON Schema methods (SDK 1.8.1+) ===
  import_from_avro?(avro: string): string;
  export_to_avro?(json: string): string;
  import_from_protobuf?(protobuf: string): string;
  export_to_protobuf?(json: string): string;
  import_from_json_schema?(jsonSchema: string): string;
  export_to_json_schema?(json: string): string;

  // === Filtering methods (SDK 1.9.0+) ===
  filter_by_tags?(workspace_json: string, tag: string): string;
  filter_nodes_by_infrastructure_type?(workspace_json: string, infrastructureType: string): string;
  filter_nodes_by_owner?(workspace_json: string, owner: string): string;
  filter_relationships_by_infrastructure_type?(
    workspace_json: string,
    infrastructureType: string
  ): string;
  filter_relationships_by_owner?(workspace_json: string, owner: string): string;

  // === Decision methods (SDK 1.14.0+) ===
  parse_decision_yaml?(yaml: string): string;
  parse_decision_index_yaml?(yaml: string): string;
  export_decision_to_yaml?(decision_json: string): string;
  export_decision_index_to_yaml?(index_json: string): string;
  export_decision_to_markdown?(decision_json: string): string;
  export_decision_to_branded_markdown?(
    decision_json: string,
    branding_json?: string | null
  ): string;
  export_decision_to_pdf?(decision_json: string, branding_json?: string | null): string;
  create_decision?(number: number, title: string, context: string, decision: string): string;
  create_decision_index?(): string;
  add_decision_to_index?(index_json: string, decision_json: string, filename: string): string;

  // === Knowledge methods (SDK 1.14.0+) ===
  parse_knowledge_yaml?(yaml: string): string;
  parse_knowledge_index_yaml?(yaml: string): string;
  export_knowledge_to_yaml?(article_json: string): string;
  export_knowledge_index_to_yaml?(index_json: string): string;
  export_knowledge_to_markdown?(article_json: string): string;
  export_knowledge_to_branded_markdown?(
    article_json: string,
    branding_json?: string | null
  ): string;
  export_knowledge_to_pdf?(article_json: string, branding_json?: string | null): string;
  search_knowledge_articles?(articles_json: string, query: string): string;
  create_knowledge_article?(
    number: number,
    title: string,
    summary: string,
    content: string,
    author: string
  ): string;
  create_knowledge_index?(): string;
  add_article_to_knowledge_index?(
    index_json: string,
    article_json: string,
    filename: string
  ): string;

  // === Markdown/PDF export methods (SDK 1.14.0+) ===
  export_markdown_to_pdf?(
    title: string,
    content: string,
    filename: string,
    branding_json?: string | null
  ): string;
  get_default_markdown_branding?(): string;
  get_default_pdf_branding?(): string;

  // === Workspace methods (SDK 1.14.0+) ===
  parse_workspace_yaml?(yaml: string): string;
  export_workspace_to_yaml?(workspace_json: string): string;
  create_workspace?(name: string, owner_id: string): string;
  add_domain_to_workspace?(workspace_json: string, domain_id: string, domain_name: string): string;
  remove_domain_from_workspace?(workspace_json: string, domain_id: string): string;
  add_relationship_to_workspace?(workspace_json: string, relationship_json: string): string;
  remove_relationship_from_workspace?(workspace_json: string, relationship_id: string): string;
  get_workspace_relationships_for_source?(workspace_json: string, source_table_id: string): string;
  get_workspace_relationships_for_target?(workspace_json: string, target_table_id: string): string;

  // === Domain Config methods (SDK 1.14.0+) ===
  parse_domain_config_yaml?(yaml: string): string;
  export_domain_config_to_yaml?(config_json: string): string;
  create_domain?(name: string): string;
  create_domain_config?(name: string, workspace_id: string): string;
  get_domain_config_id?(config_json: string): string;
  add_entity_to_domain_config?(config_json: string, entity_type: string, entity_id: string): string;
  remove_entity_from_domain_config?(
    config_json: string,
    entity_type: string,
    entity_id: string
  ): string;
  update_domain_view_positions?(config_json: string, positions_json: string): string;
  add_odcs_node_to_domain?(workspace_json: string, domain_id: string, node_json: string): string;
  add_cads_node_to_domain?(workspace_json: string, domain_id: string, node_json: string): string;
  add_system_to_domain?(workspace_json: string, domain_id: string, system_json: string): string;

  // === Validation methods (SDK 1.14.0+) ===
  validate_table_name?(name: string): string;
  validate_column_name?(name: string): string;
  validate_data_type?(data_type: string): string;
  validate_description?(desc: string): string;
  validate_uuid?(id: string): string;
  validate_odps?(yaml: string): void;
  validate_no_self_reference?(source_table_id: string, target_table_id: string): string;
  validate_pattern_exclusivity?(table_json: string): string;
  check_circular_dependency?(
    relationships_json: string,
    source_table_id: string,
    target_table_id: string
  ): string;
  detect_naming_conflicts?(existing_tables_json: string, new_tables_json: string): string;

  // === Utility methods (SDK 1.14.0+) ===
  sanitize_description?(desc: string): string;
  sanitize_sql_identifier?(name: string, dialect: string): string;
  parse_tag?(tag_str: string): string;
  serialize_tag?(tag_json: string): string;
  convert_to_odcs?(input: string, format?: string | null): string;
  migrate_dataflow_to_domain?(dataflow_yaml: string, domain_name?: string | null): string;

  // === Browser storage methods (SDK 1.14.0+) ===
  save_model?(
    db_name: string,
    store_name: string,
    workspace_path: string,
    model_json: string
  ): Promise<unknown>;
  load_model?(db_name: string, store_name: string, workspace_path: string): Promise<unknown>;
}

class SDKLoader {
  private module: SDKModule | null = null;
  private loadingPromise: Promise<SDKModule> | null = null;
  private initialized = false;

  /**
   * Load the SDK WASM module
   */
  async load(): Promise<SDKModule> {
    if (this.module && this.initialized) {
      return this.module;
    }

    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    this.loadingPromise = this._loadModule();
    this.module = await this.loadingPromise;
    return this.module;
  }

  /**
   * Internal method to load the WASM module from NPM package
   */
  private async _loadModule(): Promise<SDKModule> {
    try {
      console.log('[SDKLoader] Initializing SDK from NPM package...');

      // Initialize the WASM module - this loads the bundled .wasm file
      await init();
      this.initialized = true;

      console.log('[SDKLoader] WASM module initialized successfully');

      // Create the module wrapper with init method
      const module: SDKModule = {
        init: async () => {
          // Already initialized
        },
        // Spread all SDK functions
        ...sdkModule,
      };

      // Log available methods for debugging
      const allMethods = Object.keys(module).filter(
        (key) => typeof (module as unknown as Record<string, unknown>)[key] === 'function'
      );
      console.log('[SDKLoader] Available WASM module methods:', allMethods.length, 'methods');

      // Verify SDK 1.14.0+ bindings
      this.verifySDKBindings(module);

      return module;
    } catch (error) {
      console.error('[SDKLoader] Failed to load SDK WASM module:', error);
      console.warn(
        '[SDKLoader] SDK WASM module not available - offline mode will use placeholders'
      );

      // Return placeholder - actual SDK methods will fail gracefully when called
      return {
        init: async () => {
          console.log('[SDKLoader] SDK placeholder initialized - WASM module not loaded');
        },
      } as SDKModule;
    }
  }

  /**
   * Get the loaded SDK module
   */
  getModule(): SDKModule | null {
    return this.module;
  }

  /**
   * Check if SDK is loaded
   */
  isLoaded(): boolean {
    return this.module !== null && this.initialized;
  }

  /**
   * Check if SDK is actually loaded (not just a placeholder)
   */
  isActuallyLoaded(): boolean {
    if (!this.module || !this.initialized) {
      return false;
    }
    // Check if it's a real SDK module by verifying it has actual methods
    return (
      typeof (this.module as unknown as Record<string, unknown>).parse_odcs_yaml === 'function'
    );
  }

  /**
   * Verify SDK bindings are available
   */
  private verifySDKBindings(module: SDKModule): void {
    // Core methods from SDK 1.5.0+
    const coreMethods = [
      'import_from_odps',
      'export_to_odps',
      'import_from_cads',
      'export_to_cads',
      'parse_odcs_yaml',
      'export_to_odcs_yaml',
    ];

    // SDK 1.6.1+ specific methods
    const v161Methods = ['import_from_sql', 'export_to_sql'];

    // SDK 1.8.1+ specific methods
    const v181Methods = [
      'import_from_avro',
      'export_to_avro',
      'import_from_protobuf',
      'export_to_protobuf',
      'import_from_json_schema',
      'export_to_json_schema',
    ];

    // SDK 1.8.4+ specific methods
    const v184Methods = ['parse_odcl_yaml', 'is_odcl_format'];

    // SDK 1.14.0+ specific methods (Decision/Knowledge with PDF export)
    const v1140Methods = [
      'parse_decision_yaml',
      'parse_decision_index_yaml',
      'export_decision_to_yaml',
      'export_decision_to_markdown',
      'export_decision_to_pdf',
      'parse_knowledge_yaml',
      'parse_knowledge_index_yaml',
      'export_knowledge_to_yaml',
      'export_knowledge_to_markdown',
      'export_knowledge_to_pdf',
      'export_markdown_to_pdf',
      'get_default_pdf_branding',
      'get_default_markdown_branding',
      'parse_workspace_yaml',
      'export_workspace_to_yaml',
      'parse_domain_config_yaml',
      'export_domain_config_to_yaml',
      'import_from_domain',
      'export_to_domain',
    ];

    // SDK 1.14.1+ specific methods (ODCS/ODPS/CADS markdown/PDF export)
    const v1141Methods = [
      'export_table_to_markdown',
      'export_table_to_pdf',
      'export_odps_to_markdown',
      'export_odps_to_pdf',
      'export_cads_to_markdown',
      'export_cads_to_pdf',
    ];

    const checkMethods = (methods: string[]): string[] => {
      return methods.filter(
        (method) => typeof (module as unknown as Record<string, unknown>)[method] !== 'function'
      );
    };

    const missingCoreMethods = checkMethods(coreMethods);
    const missingV161Methods = checkMethods(v161Methods);
    const missingV181Methods = checkMethods(v181Methods);
    const missingV184Methods = checkMethods(v184Methods);
    const missingV1140Methods = checkMethods(v1140Methods);
    const missingV1141Methods = checkMethods(v1141Methods);

    // Log warnings for missing methods
    if (missingCoreMethods.length > 0) {
      console.warn('[SDKLoader] SDK 1.5.0+ core methods not available:', missingCoreMethods);
    }

    if (missingV161Methods.length > 0) {
      console.warn('[SDKLoader] SDK 1.6.1+ methods not available:', missingV161Methods);
    }

    if (missingV181Methods.length > 0) {
      console.warn('[SDKLoader] SDK 1.8.1+ methods not available:', missingV181Methods);
    }

    if (missingV184Methods.length > 0) {
      console.warn('[SDKLoader] SDK 1.8.4+ methods not available:', missingV184Methods);
    }

    if (missingV1140Methods.length > 0) {
      console.warn('[SDKLoader] SDK 1.14.0+ methods not available:', missingV1140Methods);
    }

    if (missingV1141Methods.length > 0) {
      console.warn('[SDKLoader] SDK 1.14.1+ methods not available:', missingV1141Methods);
    }

    // Determine detected SDK version
    const detectedVersion = this.detectSDKVersion(
      missingCoreMethods,
      missingV161Methods,
      missingV181Methods,
      missingV184Methods,
      missingV1140Methods,
      missingV1141Methods
    );

    console.log(`[SDKLoader] Detected SDK version: ${detectedVersion}`);
  }

  /**
   * Detect the SDK version based on available methods
   */
  private detectSDKVersion(
    missingCore: string[],
    missing161: string[],
    missing181: string[],
    missing184: string[],
    missing1140: string[],
    missing1141: string[]
  ): string {
    if (missing1141.length === 0) {
      return '1.14.1+';
    } else if (missing1140.length === 0) {
      return '1.14.0+ (ODCS/ODPS/CADS PDF export unavailable)';
    } else if (missing184.length === 0) {
      return '1.8.4+ (PDF export unavailable)';
    } else if (missing181.length === 0) {
      return '1.8.1+ (ODCL/PDF features unavailable)';
    } else if (missing161.length === 0) {
      return '1.6.1+ (Schema/ODCL/PDF features unavailable)';
    } else if (missingCore.length === 0) {
      return '1.5.0+ (SQL/Schema/ODCL/PDF features unavailable)';
    } else {
      return '<1.5.0 (Many features unavailable)';
    }
  }

  /**
   * Check if SDK 1.14.0+ decision features are available
   */
  hasDecisionSupport(): boolean {
    return (
      this.module !== null &&
      this.initialized &&
      typeof (this.module as unknown as Record<string, unknown>).parse_decision_yaml === 'function'
    );
  }

  /**
   * Check if SDK 1.14.0+ knowledge features are available
   */
  hasKnowledgeSupport(): boolean {
    return (
      this.module !== null &&
      this.initialized &&
      typeof (this.module as unknown as Record<string, unknown>).parse_knowledge_yaml === 'function'
    );
  }

  /**
   * Check if SDK 1.14.0+ workspace features are available
   */
  hasWorkspaceSupport(): boolean {
    return (
      this.module !== null &&
      this.initialized &&
      typeof (this.module as unknown as Record<string, unknown>).parse_workspace_yaml === 'function'
    );
  }

  /**
   * Check if SDK 1.14.0+ PDF export is available
   */
  hasPDFExport(): boolean {
    return (
      this.module !== null &&
      this.initialized &&
      typeof (this.module as unknown as Record<string, unknown>).export_decision_to_pdf ===
        'function'
    );
  }

  /**
   * Check if SDK 1.14.0+ markdown export is available
   */
  hasMarkdownExport(): boolean {
    return (
      this.module !== null &&
      this.initialized &&
      typeof (this.module as unknown as Record<string, unknown>).export_decision_to_markdown ===
        'function'
    );
  }

  /**
   * Check if SDK 1.14.1+ ODCS (table) markdown/PDF export is available
   * SDK 1.14.2+ uses export_odcs_yaml_to_markdown/pdf
   * SDK 1.14.1 uses export_table_to_markdown/pdf
   */
  hasODCSExport(): boolean {
    if (!this.module || !this.initialized) return false;
    const sdk = this.module as unknown as Record<string, unknown>;
    // Check for SDK 1.14.2+ functions first, then fall back to SDK 1.14.1
    return (
      typeof sdk.export_odcs_yaml_to_markdown === 'function' ||
      typeof sdk.export_table_to_markdown === 'function'
    );
  }

  /**
   * Check if SDK 1.14.1+ ODPS markdown/PDF export is available
   */
  hasODPSExport(): boolean {
    return (
      this.module !== null &&
      this.initialized &&
      typeof (this.module as unknown as Record<string, unknown>).export_odps_to_markdown ===
        'function'
    );
  }

  /**
   * Check if SDK 1.14.1+ CADS markdown/PDF export is available
   */
  hasCADSExport(): boolean {
    return (
      this.module !== null &&
      this.initialized &&
      typeof (this.module as unknown as Record<string, unknown>).export_cads_to_markdown ===
        'function'
    );
  }

  /**
   * Reset the loader (for testing)
   */
  reset(): void {
    this.module = null;
    this.loadingPromise = null;
    this.initialized = false;
  }
}

// Export singleton instance
export const sdkLoader = new SDKLoader();
