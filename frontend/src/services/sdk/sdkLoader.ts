/**
 * SDK/WASM Loader
 * Loads and initializes the data-modelling-sdk WASM module
 */

// SDK module type definition (SDK 1.13.3+)
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

  // === Decision methods (SDK 1.13.3+) ===
  // Note: These are WASM-compatible methods that work with YAML strings, not file paths
  parse_decision_yaml?(yaml: string): string;
  parse_decision_index_yaml?(yaml: string): string;
  export_decision_to_yaml?(decision_json: string): string;
  export_decision_index_to_yaml?(index_json: string): string;
  export_decision_to_markdown?(decision_json: string): string;
  create_decision?(number: number, title: string, context: string, decision: string): string;
  create_decision_index?(): string;
  add_decision_to_index?(index_json: string, decision_json: string, filename: string): string;

  // === Knowledge methods (SDK 1.13.3+) ===
  // Note: These are WASM-compatible methods that work with YAML strings, not file paths
  parse_knowledge_yaml?(yaml: string): string;
  parse_knowledge_index_yaml?(yaml: string): string;
  export_knowledge_to_yaml?(article_json: string): string;
  export_knowledge_index_to_yaml?(index_json: string): string;
  export_knowledge_to_markdown?(article_json: string): string;
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

  // === Workspace methods (SDK 1.13.3+) ===
  parse_workspace_yaml?(yaml: string): string;
  export_workspace_to_yaml?(workspace_json: string): string;
  create_workspace?(name: string, owner_id: string): string;

  // === Domain methods (SDK 1.13.3+) ===
  parse_domain_config_yaml?(yaml: string): string;
  export_domain_config_to_yaml?(config_json: string): string;
  create_domain?(name: string): string;
  create_domain_config?(name: string, workspace_id: string): string;

  // Note: Database methods (db_init, db_sync, etc.) are CLI/Rust only, not available in WASM
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
   *
   * IMPORTANT: In production (Cloudflare Pages), SDK WASM is downloaded from GitHub Releases
   * during the build process and placed in /wasm/. We should ONLY load from that location.
   * Local development paths are only used in Electron or dev mode.
   */
  private async _loadModule(): Promise<SDKModule> {
    const isElectron = typeof window !== 'undefined' && window.location.protocol === 'file:';
    const isDev = import.meta.env.DEV;

    try {
      // In dev mode (Vite), load via script tag since we can't import from /public
      if (isDev && !isElectron) {
        console.log('[SDKLoader] Dev mode: Loading WASM via script tag');
        return await this._loadViaScriptTag('/wasm/data_modelling_sdk.js');
      }

      // Define possible paths based on environment
      // - Electron: Try multiple relative paths for file:// protocol
      // - Production web: ONLY load from /wasm/ (GitHub release files)
      const possiblePaths = isElectron
        ? [
            './wasm/data_modelling_sdk.js',
            './assets/wasm/data_modelling_sdk.js',
            '../wasm/data_modelling_sdk.js',
          ]
        : ['/wasm/data_modelling_sdk.js']; // Production: ONLY from /wasm/

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
    } catch (error) {
      // Log the actual error
      console.error('[SDKLoader] Failed to load SDK WASM module:', error);
      console.warn(
        '[SDKLoader] SDK WASM module not available - offline mode will use placeholders'
      );

      if (isElectron) {
        console.warn('[SDKLoader] For Electron: Ensure WASM files are in the app bundle');
      } else {
        console.warn(
          '[SDKLoader] For web deployment: SDK WASM should be downloaded from GitHub Releases during build'
        );
        console.warn(
          '[SDKLoader] Check that cloudflare-build.sh successfully downloaded the WASM SDK'
        );
      }

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

    // SDK 1.13.3+ specific methods (Decision logs, Knowledge base, Workspace)
    // Note: These are WASM-compatible methods that work with YAML strings
    // Database methods (db_*) are CLI/Rust only, not available in WASM
    const v1133Methods = [
      // Decision methods (WASM-compatible)
      'parse_decision_yaml',
      'parse_decision_index_yaml',
      'export_decision_to_yaml',
      'export_decision_to_markdown',
      'create_decision',
      'create_decision_index',
      // Knowledge methods (WASM-compatible)
      'parse_knowledge_yaml',
      'parse_knowledge_index_yaml',
      'export_knowledge_to_yaml',
      'export_knowledge_to_markdown',
      'search_knowledge_articles',
      'create_knowledge_article',
      'create_knowledge_index',
      // Workspace/Domain methods
      'parse_workspace_yaml',
      'export_workspace_to_yaml',
      'create_workspace',
      'parse_domain_config_yaml',
      'export_domain_config_to_yaml',
      'create_domain',
    ];

    const checkMethods = (methods: string[]): string[] => {
      return methods.filter((method) => typeof (module as any)[method] !== 'function');
    };

    const missingCoreMethods = checkMethods(coreMethods);
    const missingV161Methods = checkMethods(v161Methods);
    const missingV181Methods = checkMethods(v181Methods);
    const missingV184Methods = checkMethods(v184Methods);
    const missingV1133Methods = checkMethods(v1133Methods);

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

    if (missingV1133Methods.length > 0) {
      console.warn('[SDKLoader] SDK 1.13.3+ methods not available:', missingV1133Methods);
      console.warn(
        '[SDKLoader] Decision logs and Knowledge base features require SDK version >= 1.13.3'
      );
    }

    // Determine detected SDK version
    const detectedVersion = this.detectSDKVersion(
      missingCoreMethods,
      missingV161Methods,
      missingV181Methods,
      missingV184Methods,
      missingV1133Methods
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
    missing1133: string[]
  ): string {
    if (missing1133.length === 0) {
      return '1.13.3+';
    } else if (missing184.length === 0) {
      return '1.8.4+ (Decision/Knowledge features unavailable)';
    } else if (missing181.length === 0) {
      return '1.8.1+ (ODCL/Decision/Knowledge features unavailable)';
    } else if (missing161.length === 0) {
      return '1.6.1+ (Schema/ODCL/Decision/Knowledge features unavailable)';
    } else if (missingCore.length === 0) {
      return '1.5.0+ (SQL/Schema/ODCL/Decision/Knowledge features unavailable)';
    } else {
      return '<1.5.0 (Many features unavailable)';
    }
  }

  /**
   * Check if SDK 1.13.3+ decision features are available
   */
  hasDecisionSupport(): boolean {
    return this.module !== null && typeof (this.module as any).parse_decision_yaml === 'function';
  }

  /**
   * Check if SDK 1.13.3+ knowledge features are available
   */
  hasKnowledgeSupport(): boolean {
    return this.module !== null && typeof (this.module as any).parse_knowledge_yaml === 'function';
  }

  /**
   * Check if SDK 1.13.3+ workspace features are available
   */
  hasWorkspaceSupport(): boolean {
    return this.module !== null && typeof (this.module as any).parse_workspace_yaml === 'function';
  }

  // Note: Database features (db_init, db_sync, etc.) are CLI/Rust only, not available in WASM

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
