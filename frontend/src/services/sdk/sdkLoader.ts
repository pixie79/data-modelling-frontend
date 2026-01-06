/**
 * SDK/WASM Loader
 * Loads and initializes the data-modelling-sdk WASM module
 */

// SDK module type definition (SDK 1.8.4+)
interface SDKModule {
  init(): Promise<void>;
  // ODCS methods
  parse_odcs_yaml?(yaml: string): string;
  export_to_odcs_yaml?(json: string): string;
  // ODCL methods (SDK 1.8.4+)
  parse_odcl_yaml?(yaml: string): string;
  // ODPS methods (SDK 1.5.0+)
  parse_odps_yaml?(yaml: string): string;
  export_to_odps_yaml?(json: string): string;
  // CADS methods (SDK 1.5.0+)
  parse_cads_yaml?(yaml: string): string;
  export_to_cads_yaml?(json: string): string;
  // BPMN methods (SDK 1.5.0+)
  parse_bpmn_xml?(xml: string): string;
  export_to_bpmn_xml?(json: string): string;
  validate_bpmn_xml?(xml: string): string;
  // DMN methods (SDK 1.5.0+)
  parse_dmn_xml?(xml: string): string;
  export_to_dmn_xml?(json: string): string;
  validate_dmn_xml?(xml: string): string;
  // OpenAPI methods (SDK 1.5.0+)
  parse_openapi?(content: string, format: 'yaml' | 'json'): string;
  export_openapi?(json: string, format: 'yaml' | 'json'): string;
  openapi_to_odcs?(json: string): string;
  // SQL Import/Export methods (SDK 1.6.1+)
  import_from_sql?(sql: string, dialect: string): string;
  export_to_sql?(json: string, dialect: string): string;
  // AVRO/Protobuf/JSON Schema methods (SDK 1.8.1+)
  import_from_avro?(avro: string): string;
  export_to_avro?(json: string): string;
  import_from_protobuf?(protobuf: string): string;
  export_to_protobuf?(json: string): string;
  import_from_json_schema?(jsonSchema: string): string;
  export_to_json_schema?(json: string): string;
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
   * Internal method to load the WASM module
   */
  private async _loadModule(): Promise<SDKModule> {
    try {
      // Load WASM module from SDK pkg directory
      // The pkg directory should be copied to frontend/public/wasm/ during build
      // Using dynamic import with string literal to avoid TypeScript errors
      // Note: The WASM file will be loaded by the JS file, and we need to ensure
      // the correct MIME type is set for the .wasm file itself

      // In Electron, use relative path for file:// protocol
      const isElectron = typeof window !== 'undefined' && window.location.protocol === 'file:';

      // Determine the correct path based on where we're running from
      // In Electron with file:// protocol, we need to resolve relative to the HTML file location
      // The HTML file is at dist/index.html, so ./wasm/ should resolve to dist/wasm/
      // Vite copies public/wasm/ to dist/wasm/ during build
      // However, Vite might also put files in dist/assets/wasm/, so we try multiple paths
      const possiblePaths = isElectron
        ? [
            './wasm/data_modelling_sdk.js', // Primary: dist/wasm/ (Vite copies public/wasm/ here)
            './assets/wasm/data_modelling_sdk.js', // Alternative: dist/assets/wasm/ (Vite might put it here)
            '../wasm/data_modelling_sdk.js', // Fallback: parent directory wasm/ (dist-electron/wasm/)
            '../public/wasm/data_modelling_sdk.js', // Fallback: public/wasm/ (source)
          ]
        : ['/wasm/data_modelling_sdk.js'];

      let wasmModule: any = null;
      let lastError: Error | null = null;

      for (const wasmPath of possiblePaths) {
        try {
          console.log('[SDKLoader] Attempting to load WASM module from:', wasmPath);
          wasmModule = await import(/* @vite-ignore */ wasmPath);
          if (wasmModule.default) {
            // The default export is the init function which loads the WASM file
            // It will use WebAssembly.instantiateStreaming which requires correct MIME type
            await wasmModule.default();
          }
          console.log('[SDKLoader] WASM module loaded successfully from:', wasmPath);
          break;
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));
          console.warn(`[SDKLoader] Failed to load from ${wasmPath}:`, lastError.message);
          // Try next path
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
      // Fallback: Try relative path (for development)
      try {
        const wasmPath = '../../../../data-modelling-sdk/pkg/data_modelling_sdk.js';
        const wasmModule = await import(/* @vite-ignore */ wasmPath);
        if (wasmModule.default) {
          await wasmModule.default();
        }
        return wasmModule as SDKModule;
      } catch (fallbackError) {
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
   * Verify SDK 1.8.1+ bindings are available
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
    const v182Methods = [
      'parse_odcl_yaml', // ODCL import (separate from ODCS)
    ];

    const missingCoreMethods: string[] = [];
    const missingV161Methods: string[] = [];
    const missingV181Methods: string[] = [];
    const missingV182Methods: string[] = [];

    for (const method of coreMethods) {
      if (typeof (module as any)[method] !== 'function') {
        missingCoreMethods.push(method);
      }
    }

    for (const method of v161Methods) {
      if (typeof (module as any)[method] !== 'function') {
        missingV161Methods.push(method);
      }
    }

    for (const method of v181Methods) {
      if (typeof (module as any)[method] !== 'function') {
        missingV181Methods.push(method);
      }
    }

    for (const method of v182Methods) {
      if (typeof (module as any)[method] !== 'function') {
        missingV182Methods.push(method);
      }
    }

    if (missingCoreMethods.length > 0) {
      console.warn('[SDKLoader] SDK 1.5.0+ core methods not available:', missingCoreMethods);
      console.warn('[SDKLoader] Some features may not work. Ensure SDK version >= 1.5.0');
    }

    if (missingV161Methods.length > 0) {
      console.warn('[SDKLoader] SDK 1.6.1+ methods not available:', missingV161Methods);
      console.warn(
        '[SDKLoader] Enhanced SQL import/export (including Databricks support) requires SDK version >= 1.6.1'
      );
      console.warn('[SDKLoader] Current SDK may not support Databricks SQL syntax natively');
    }

    if (missingV181Methods.length > 0) {
      console.warn('[SDKLoader] SDK 1.8.1+ methods not available:', missingV181Methods);
      console.warn(
        '[SDKLoader] Enhanced AVRO/Protobuf/JSON Schema/ODPS export/import requires SDK version >= 1.8.1'
      );
      console.warn('[SDKLoader] Current SDK may not have enhanced schema export/import support');
    }

    if (missingV182Methods.length > 0) {
      console.warn('[SDKLoader] SDK 1.8.4+ methods not available:', missingV182Methods);
      console.warn('[SDKLoader] ODCL import with separate parser requires SDK version >= 1.8.4');
      console.warn('[SDKLoader] ODCL files may need to be imported as ODCS (with limitations)');
    }

    if (
      missingCoreMethods.length === 0 &&
      missingV161Methods.length === 0 &&
      missingV181Methods.length === 0 &&
      missingV182Methods.length === 0
    ) {
      console.log('[SDKLoader] SDK 1.8.4+ bindings verified successfully');
    } else if (
      missingCoreMethods.length === 0 &&
      missingV161Methods.length === 0 &&
      missingV181Methods.length === 0 &&
      missingV182Methods.length > 0
    ) {
      console.log('[SDKLoader] SDK 1.8.1+ core bindings verified, but 1.8.4+ features are missing');
      console.log(
        '[SDKLoader] Available methods:',
        Object.keys(module).filter((key) => typeof (module as any)[key] === 'function')
      );
      console.log('[SDKLoader] Missing 1.8.4+ methods:', missingV182Methods);
    } else if (
      missingCoreMethods.length === 0 &&
      missingV161Methods.length === 0 &&
      missingV181Methods.length > 0
    ) {
      console.log('[SDKLoader] SDK 1.6.1+ core bindings verified, but 1.8.1+ features are missing');
      console.log(
        '[SDKLoader] Available methods:',
        Object.keys(module).filter((key) => typeof (module as any)[key] === 'function')
      );
      console.log('[SDKLoader] Missing 1.8.1+ methods:', missingV181Methods);
    } else if (missingCoreMethods.length === 0 && missingV161Methods.length > 0) {
      console.log('[SDKLoader] SDK 1.5.0+ core bindings verified, but 1.6.1+ features are missing');
      console.log(
        '[SDKLoader] Available methods:',
        Object.keys(module).filter((key) => typeof (module as any)[key] === 'function')
      );
      console.log('[SDKLoader] Missing 1.6.1+ methods:', missingV161Methods);
    } else {
      console.log(
        '[SDKLoader] Available methods:',
        Object.keys(module).filter((key) => typeof (module as any)[key] === 'function')
      );
    }
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
