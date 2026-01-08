/**
 * useDuckDB Hook
 * React hook for accessing DuckDB-WASM service in components
 *
 * @module hooks/useDuckDB
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  getDuckDBService,
  DuckDBService,
  getOPFSManager,
  OPFSManager,
  getDuckDBStorageAdapter,
  DuckDBStorageAdapter,
} from '@/services/database';
import { StorageMode, checkBrowserCapabilities } from '@/types/duckdb';
import type { BrowserCapabilities, OPFSStatus, DuckDBConfig } from '@/types/duckdb';
import type { OPFSQuotaInfo } from '@/services/database/opfsManager';

export interface UseDuckDBOptions {
  /** Whether to auto-initialize on mount (default: true) */
  autoInitialize?: boolean;
  /** Custom DuckDB configuration */
  config?: Partial<DuckDBConfig>;
  /** Callback when initialization completes */
  onInitialized?: () => void;
  /** Callback when initialization fails */
  onError?: (error: Error) => void;
}

export interface UseDuckDBResult {
  /** Whether DuckDB is initialized and ready */
  isReady: boolean;
  /** Whether initialization is in progress */
  isInitializing: boolean;
  /** Current storage mode (opfs, memory, or indexeddb) */
  storageMode: StorageMode | null;
  /** Browser capabilities for WASM/OPFS support */
  capabilities: BrowserCapabilities | null;
  /** OPFS status information */
  opfsStatus: OPFSStatus | null;
  /** Storage quota information */
  quotaInfo: OPFSQuotaInfo | null;
  /** Any initialization error */
  error: Error | null;
  /** DuckDB service instance (null if not initialized) */
  duckdb: DuckDBService | null;
  /** OPFS manager instance (null if not initialized) */
  opfsManager: OPFSManager | null;
  /** Storage adapter instance (null if not initialized) */
  storageAdapter: DuckDBStorageAdapter | null;
  /** Manually trigger initialization */
  initialize: () => Promise<void>;
  /** Terminate DuckDB connection */
  terminate: () => Promise<void>;
  /** Check if a specific feature is available */
  hasFeature: (feature: 'opfs' | 'sharedArrayBuffer' | 'webWorkers') => boolean;
}

/**
 * React hook for accessing DuckDB-WASM service
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { isReady, duckdb, storageMode, error } = useDuckDB();
 *
 *   if (!isReady) return <Loading />;
 *   if (error) return <Error message={error.message} />;
 *
 *   return <div>Using {storageMode} storage</div>;
 * }
 * ```
 */
export function useDuckDB(options: UseDuckDBOptions = {}): UseDuckDBResult {
  const { autoInitialize = true, config, onInitialized, onError } = options;

  const [isReady, setIsReady] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [storageMode, setStorageMode] = useState<StorageMode | null>(null);
  const [capabilities, setCapabilities] = useState<BrowserCapabilities | null>(null);
  const [opfsStatus, setOpfsStatus] = useState<OPFSStatus | null>(null);
  const [quotaInfo, setQuotaInfo] = useState<OPFSQuotaInfo | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [duckdb, setDuckdb] = useState<DuckDBService | null>(null);
  const [opfsManager, setOpfsManager] = useState<OPFSManager | null>(null);
  const [storageAdapter, setStorageAdapter] = useState<DuckDBStorageAdapter | null>(null);

  const initializingRef = useRef(false);
  const mountedRef = useRef(true);

  const initialize = useCallback(async () => {
    // Prevent concurrent initialization
    if (initializingRef.current) {
      return;
    }

    initializingRef.current = true;
    setIsInitializing(true);
    setError(null);

    try {
      // Check browser capabilities first
      const caps = checkBrowserCapabilities();
      if (mountedRef.current) {
        setCapabilities(caps);
      }

      // Initialize DuckDB service
      const duckdbService = getDuckDBService();
      const initResult = await duckdbService.initialize(config);

      if (!initResult.success) {
        throw new Error(initResult.error || 'DuckDB initialization failed');
      }

      if (!mountedRef.current) return;

      setDuckdb(duckdbService);
      setStorageMode(initResult.storageMode);

      // Initialize OPFS manager if using OPFS
      if (initResult.storageMode === StorageMode.OPFS) {
        const opfs = getOPFSManager();
        await opfs.initialize();

        if (!mountedRef.current) return;

        setOpfsManager(opfs);

        // Get OPFS status
        const status = await duckdbService.getOPFSStatus();
        if (mountedRef.current) {
          setOpfsStatus(status);
        }

        // Get quota info
        const quota = await opfs.getQuotaInfo();
        if (mountedRef.current) {
          setQuotaInfo(quota);
        }
      }

      // Initialize storage adapter
      const adapter = getDuckDBStorageAdapter();
      await adapter.initialize();

      if (!mountedRef.current) return;

      setStorageAdapter(adapter);
      setIsReady(true);
      onInitialized?.();
    } catch (err) {
      const initError = err instanceof Error ? err : new Error('Failed to initialize DuckDB');
      if (mountedRef.current) {
        setError(initError);
        onError?.(initError);
      }
    } finally {
      initializingRef.current = false;
      if (mountedRef.current) {
        setIsInitializing(false);
      }
    }
  }, [config, onInitialized, onError]);

  const terminate = useCallback(async () => {
    if (duckdb) {
      await duckdb.terminate();
      setIsReady(false);
      setDuckdb(null);
      setStorageAdapter(null);
    }
  }, [duckdb]);

  const hasFeature = useCallback(
    (feature: 'opfs' | 'sharedArrayBuffer' | 'webWorkers'): boolean => {
      if (!capabilities) return false;

      switch (feature) {
        case 'opfs':
          return capabilities.opfs && capabilities.crossOriginIsolated;
        case 'sharedArrayBuffer':
          return capabilities.sharedArrayBuffer;
        case 'webWorkers':
          return capabilities.webWorkers;
        default:
          return false;
      }
    },
    [capabilities]
  );

  // Auto-initialize on mount
  useEffect(() => {
    mountedRef.current = true;

    if (autoInitialize) {
      initialize();
    }

    return () => {
      mountedRef.current = false;
    };
  }, [autoInitialize, initialize]);

  return {
    isReady,
    isInitializing,
    storageMode,
    capabilities,
    opfsStatus,
    quotaInfo,
    error,
    duckdb,
    opfsManager,
    storageAdapter,
    initialize,
    terminate,
    hasFeature,
  };
}

/**
 * Lightweight hook to just check if DuckDB is ready
 * Useful for components that just need to know status without full hook
 */
export function useDuckDBStatus(): {
  isReady: boolean;
  storageMode: StorageMode | null;
} {
  const [isReady, setIsReady] = useState(false);
  const [storageMode, setStorageMode] = useState<StorageMode | null>(null);

  useEffect(() => {
    const duckdbService = getDuckDBService();

    // Check current status
    const checkStatus = () => {
      const ready = duckdbService.isInitialized();
      setIsReady(ready);
      if (ready) {
        setStorageMode(duckdbService.getStorageMode());
      }
    };

    checkStatus();

    // Poll for changes (simple approach without event system)
    const interval = setInterval(checkStatus, 1000);

    return () => clearInterval(interval);
  }, []);

  return { isReady, storageMode };
}
