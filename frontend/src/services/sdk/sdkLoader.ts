/**
 * SDK/WASM Loader
 * Loads and initializes the data-modelling-sdk WASM module
 */

// SDK module type definition (SDK 1.13.1+)
interface SDKModule {
  init(): Promise<void>;

  // === ODCS methods ===
  parse_odcs_yaml?(yaml: string): string;
  export_to_odcs_yaml?(json: string): string;

  // === ODCL methods (SDK 1.8.4+) ===
  parse_odcl_yaml?(yaml: string): string;

  // === ODPS methods (SDK 1.5.0+) ===
  parse_odps_yaml?(yaml: string): string;
  export_to_odps_yaml?(json: string): string;
  import_from_odps?(yaml: string): string;
  export_to_odps?(json: string): string;

  // === CADS methods (SDK 1.5.0+) ===
  parse_cads_yaml?(yaml: string): string;
  export_to_cads_yaml?(json: string): string;
  import_from_cads?(yaml: string): string;
  export_to_cads?(json: string): string;

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

  // === Decision methods (SDK 1.13.1+) ===
  load_decisions?(workspace_path: string): string;
  load_decision?(decision_path: string): string;
  load_decision_index?(workspace_path: string): string;
  load_decisions_by_domain?(workspace_path: string, domain_id: string): string;
  save_decision?(decision_json: string, workspace_path: string): string;
  save_decision_index?(index_json: string, workspace_path: string): string;
  export_decision_markdown?(decision_json: string): string;

  // === Knowledge methods (SDK 1.13.1+) ===
  load_knowledge?(workspace_path: string): string;
  load_knowledge_article?(article_path: string): string;
  load_knowledge_index?(workspace_path: string): string;
  load_knowledge_by_domain?(workspace_path: string, domain_id: string): string;
  save_knowledge?(article_json: string, workspace_path: string): string;
  save_knowledge_index?(index_json: string, workspace_path: string): string;
  export_knowledge_markdown?(article_json: string): string;
  search_knowledge?(workspace_path: string, query: string): string;

  // === Database methods (SDK 1.13.1+) ===
  db_init?(workspace_path: string, config_json: string): string;
  db_sync?(workspace_path: string): string;
  db_status?(workspace_path: string): string;
  db_export?(workspace_path: string): string;
  db_query?(workspace_path: string, sql: string): string;

  // === Workspace methods (SDK 1.13.1+) ===
  parse_workspace_yaml?(yaml: string): string;
  export_workspace_yaml?(json: string): string;
  scan_workspace_files?(workspace_path: string): string;

  // === Domain methods (SDK 1.13.1+) ===
  load_domains?(workspace_path: string): string;
  load_domain?(workspace_path: string, domain_id: string): string;
  save_domain?(domain_json: string, workspace_path: string): string;
}

class SDKLoader {
  private module: SDKModule | null = null;
  private loadingPromise: Promise<SDKModule> | null = null;

  /**
   * Load the SDK WASM module
   */
  async load(): Promise<SDKModule> {
    if (this.module) {
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
   * Load WASM module via script tag (for dev mode)
   */
  private async _loadViaScriptTag(scriptPath: string): Promise<SDKModule> {
    console.log('[SDKLoader] Loading WASM module from:', scriptPath);

    // In dev mode, use full URL for import
    const fullUrl = new URL(scriptPath, window.location.origin).href;
    console.log('[SDKLoader] Full URL:', fullUrl);

    const wasmModule = await import(/* @vite-ignore */ fullUrl);
    console.log('[SDKLoader] Module imported, available exports:', Object.keys(wasmModule));

    // Call the default export (init function) to initialize WASM
    if (wasmModule.default) {
      await wasmModule.default();
      console.log('[SDKLoader] WASM initialized');
    }

    // The module exports all the WASM functions directly
    console.log(
      '[SDKLoader] Available methods:',
      Object.keys(wasmModule).filter((k) => typeof (wasmModule as any)[k] === 'function')
    );

    return wasmModule as SDKModule;
  }

  /**
   * Internal method to load the WASM module
   */
  private async _loadModule(): Promise<SDKModule> {
    try {
      // Load WASM module from SDK pkg directory
      // In dev mode (Vite), files in /public are served at root but cannot be imported
      // In production, Vite copies public/wasm/ to dist/wasm/
      // In Electron, use relative paths for file:// protocol

      const isElectron = typeof window !== 'undefined' && window.location.protocol === 'file:';
      const isDev = import.meta.env.DEV;

      // In dev mode, load via script tag since we can't import from /public
      if (isDev && !isElectron) {
        return await this._loadViaScriptTag('/wasm/data_modelling_sdk.js');
      }

      // In production or Electron, use dynamic import
      const possiblePaths = isElectron
        ? [
            './wasm/data_modelling_sdk.js',
            './assets/wasm/data_modelling_sdk.js',
            '../wasm/data_modelling_sdk.js',
            '../public/wasm/data_modelling_sdk.js',
          ]
        : ['/wasm/data_modelling_sdk.js'];

      let wasmModule: any = null;
      let lastError: Error | null = null;

      for (const wasmPath of possiblePaths) {
        try {
          console.log('[SDKLoader] Attempting to load WASM module from:', wasmPath);
          wasmModule = await import(/* @vite-ignore */ wasmPath);
          if (wasmModule.default) {
            await wasmModule.default();
          }
          console.log('[SDKLoader] WASM module loaded successfully from:', wasmPath);
          break;
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));
          console.warn(`[SDKLoader] Failed to load from ${wasmPath}:`, lastError.message);
        }
      }

      if (!wasmModule) {
        throw lastError || new Error('Failed to load WASM module from any path');
      }

      const module = wasmModule as SDKModule;

      // Log all available methods for debugging
      const allMethods = Object.keys(module).filter(
        (key) => typeof (module as any)[key] === 'function'
      );
      console.log('[SDKLoader] Available WASM module methods:', allMethods);
      console.log('[SDKLoader] Module keys:', Object.keys(module));

      // Verify SDK 1.8.1+ bindings
      this.verifySDKBindings(module);

      return module;
    } catch {
      // Fallback: Try relative path (for development)
      try {
        const wasmPath = '../../../../data-modelling-sdk/pkg/data_modelling_sdk.js';
        const wasmModule = await import(/* @vite-ignore */ wasmPath);
        if (wasmModule.default) {
          await wasmModule.default();
        }
        return wasmModule as SDKModule;
      } catch {
        console.warn('SDK WASM module not available - offline mode will use placeholders');
        console.warn(
          'Build the SDK with: cd ../data-modelling-sdk && wasm-pack build --target web --out-dir pkg --features wasm'
        );
        console.warn('Then copy pkg/ to frontend/public/wasm/');
        // Return placeholder for now - actual SDK methods will be called when available
        return {
          init: async () => {
            console.log('SDK placeholder initialized - WASM module not loaded');
          },
        } as SDKModule;
      }
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
    return this.module !== null;
  }

  /**
   * Check if SDK is actually loaded (not just a placeholder)
   */
  isActuallyLoaded(): boolean {
    if (!this.module) {
      return false;
    }
    // Check if it's a real SDK module by verifying it has actual methods
    // Placeholder only has init() method
    return typeof (this.module as any).parse_odcs_yaml === 'function';
  }

  /**
   * Verify SDK bindings are available
   */
  private verifySDKBindings(module: SDKModule): void {
    // Core methods from SDK 1.5.0+ (using actual exported method names)
    const coreMethods = [
      'import_from_odps', // ODPS import (was: parse_odps_yaml)
      'export_to_odps', // ODPS export (was: export_to_odps_yaml)
      'import_from_cads', // CADS import (was: parse_cads_yaml)
      'export_to_cads', // CADS export (was: export_to_cads_yaml)
      'parse_odcs_yaml', // ODCS parse (still uses this name)
      'export_to_odcs_yaml', // ODCS export (still uses this name)
    ];

    // SDK 1.6.1+ specific methods (enhanced SQL support, especially Databricks)
    const v161Methods = ['import_from_sql', 'export_to_sql'];

    // SDK 1.8.1+ specific methods (enhanced AVRO/Protobuf/JSON Schema/ODPS support)
    const v181Methods = [
      'import_from_avro',
      'export_to_avro',
      'import_from_protobuf',
      'export_to_protobuf',
      'import_from_json_schema',
      'export_to_json_schema',
    ];

    // SDK 1.8.4+ specific methods (separate ODCL parser, improved validations)
    const v184Methods = [
      'parse_odcl_yaml', // ODCL import (separate from ODCS)
    ];

    // SDK 1.13.1+ specific methods (Decision logs, Knowledge base, DuckDB)
    const v1131Methods = [
      // Decision methods
      'load_decisions',
      'load_decision_index',
      'save_decision',
      'export_decision_markdown',
      // Knowledge methods
      'load_knowledge',
      'load_knowledge_index',
      'save_knowledge',
      'search_knowledge',
      'export_knowledge_markdown',
      // Database methods
      'db_init',
      'db_sync',
      'db_status',
      'db_export',
      'db_query',
      // Workspace/Domain methods
      'parse_workspace_yaml',
      'export_workspace_yaml',
      'load_domains',
    ];

    const checkMethods = (methods: string[]): string[] => {
      return methods.filter((method) => typeof (module as any)[method] !== 'function');
    };

    const missingCoreMethods = checkMethods(coreMethods);
    const missingV161Methods = checkMethods(v161Methods);
    const missingV181Methods = checkMethods(v181Methods);
    const missingV184Methods = checkMethods(v184Methods);
    const missingV1131Methods = checkMethods(v1131Methods);

    // Log warnings for missing methods
    if (missingCoreMethods.length > 0) {
      console.warn('[SDKLoader] SDK 1.5.0+ core methods not available:', missingCoreMethods);
      console.warn('[SDKLoader] Some features may not work. Ensure SDK version >= 1.5.0');
    }

    if (missingV161Methods.length > 0) {
      console.warn('[SDKLoader] SDK 1.6.1+ methods not available:', missingV161Methods);
      console.warn('[SDKLoader] Enhanced SQL import/export requires SDK version >= 1.6.1');
    }

    if (missingV181Methods.length > 0) {
      console.warn('[SDKLoader] SDK 1.8.1+ methods not available:', missingV181Methods);
      console.warn('[SDKLoader] Enhanced schema export/import requires SDK version >= 1.8.1');
    }

    if (missingV184Methods.length > 0) {
      console.warn('[SDKLoader] SDK 1.8.4+ methods not available:', missingV184Methods);
      console.warn('[SDKLoader] ODCL import with separate parser requires SDK version >= 1.8.4');
    }

    if (missingV1131Methods.length > 0) {
      console.warn('[SDKLoader] SDK 1.13.1+ methods not available:', missingV1131Methods);
      console.warn(
        '[SDKLoader] Decision logs, Knowledge base, and DuckDB features require SDK version >= 1.13.1'
      );
    }

    // Determine detected SDK version
    const detectedVersion = this.detectSDKVersion(
      missingCoreMethods,
      missingV161Methods,
      missingV181Methods,
      missingV184Methods,
      missingV1131Methods
    );

    console.log(`[SDKLoader] Detected SDK version: ${detectedVersion}`);
    console.log(
      '[SDKLoader] Available methods:',
      Object.keys(module).filter((key) => typeof (module as any)[key] === 'function')
    );
  }

  /**
   * Detect the SDK version based on available methods
   */
  private detectSDKVersion(
    missingCore: string[],
    missing161: string[],
    missing181: string[],
    missing184: string[],
    missing1131: string[]
  ): string {
    if (missing1131.length === 0) {
      return '1.13.1+';
    } else if (missing184.length === 0) {
      return '1.8.4+ (Decision/Knowledge/DuckDB features unavailable)';
    } else if (missing181.length === 0) {
      return '1.8.1+ (ODCL/Decision/Knowledge/DuckDB features unavailable)';
    } else if (missing161.length === 0) {
      return '1.6.1+ (Schema/ODCL/Decision/Knowledge/DuckDB features unavailable)';
    } else if (missingCore.length === 0) {
      return '1.5.0+ (SQL/Schema/ODCL/Decision/Knowledge/DuckDB features unavailable)';
    } else {
      return '<1.5.0 (Many features unavailable)';
    }
  }

  /**
   * Check if SDK 1.13.1+ features are available
   */
  hasDecisionSupport(): boolean {
    return this.module !== null && typeof (this.module as any).load_decisions === 'function';
  }

  /**
   * Check if SDK 1.13.1+ knowledge features are available
   */
  hasKnowledgeSupport(): boolean {
    return this.module !== null && typeof (this.module as any).load_knowledge === 'function';
  }

  /**
   * Check if SDK 1.13.1+ database features are available
   */
  hasDatabaseSupport(): boolean {
    return this.module !== null && typeof (this.module as any).db_init === 'function';
  }

  /**
   * Reset the loader (for testing)
   */
  reset(): void {
    this.module = null;
    this.loadingPromise = null;
  }
}

// Export singleton instance
export const sdkLoader = new SDKLoader();
