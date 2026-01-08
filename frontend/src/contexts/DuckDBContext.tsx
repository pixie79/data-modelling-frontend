/**
 * DuckDB Context Provider
 * Provides DuckDB-WASM services to the entire React application
 *
 * @module contexts/DuckDBContext
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import {
  getDuckDBService,
  DuckDBService,
  getOPFSManager,
  OPFSManager,
  getDuckDBStorageAdapter,
  DuckDBStorageAdapter,
  getSyncEngine,
  SyncEngine,
  createSchemaManager,
  SchemaManager,
} from '@/services/database';
import { StorageMode, checkBrowserCapabilities } from '@/types/duckdb';
import type {
  BrowserCapabilities,
  OPFSStatus,
  DuckDBConfig,
  DuckDBQueryResult,
  DuckDBParams,
} from '@/types/duckdb';
import type { OPFSQuotaInfo } from '@/services/database/opfsManager';

/**
 * DuckDB context value interface
 */
export interface DuckDBContextValue {
  /** Whether DuckDB is initialized and ready */
  isReady: boolean;
  /** Whether initialization is in progress */
  isInitializing: boolean;
  /** Current storage mode */
  storageMode: StorageMode | null;
  /** Browser capabilities */
  capabilities: BrowserCapabilities | null;
  /** OPFS status */
  opfsStatus: OPFSStatus | null;
  /** Storage quota info */
  quotaInfo: OPFSQuotaInfo | null;
  /** Initialization error */
  error: Error | null;
  /** DuckDB service instance */
  duckdb: DuckDBService | null;
  /** OPFS manager instance */
  opfsManager: OPFSManager | null;
  /** Storage adapter instance */
  storageAdapter: DuckDBStorageAdapter | null;
  /** Sync engine instance */
  syncEngine: SyncEngine | null;
  /** Schema manager instance */
  schemaManager: SchemaManager | null;
  /** Reinitialize DuckDB */
  reinitialize: () => Promise<void>;
  /** Terminate DuckDB connection */
  terminate: () => Promise<void>;
  /** Execute a query */
  query: <T>(sql: string, params?: DuckDBParams) => Promise<DuckDBQueryResult<T>>;
  /** Execute a mutation */
  execute: (sql: string, params?: DuckDBParams) => Promise<{ success: boolean; error?: string }>;
}

const DuckDBContext = createContext<DuckDBContextValue | null>(null);

/**
 * Props for DuckDBProvider component
 */
export interface DuckDBProviderProps {
  children: React.ReactNode;
  /** Custom DuckDB configuration */
  config?: Partial<DuckDBConfig>;
  /** Whether to initialize on mount (default: true) */
  autoInitialize?: boolean;
  /** Callback when initialization completes */
  onInitialized?: () => void;
  /** Callback when initialization fails */
  onError?: (error: Error) => void;
  /** Fallback component to show while initializing */
  fallback?: React.ReactNode;
  /** Error component to show on initialization failure */
  errorFallback?: React.ReactNode | ((error: Error) => React.ReactNode);
}

/**
 * DuckDB Context Provider Component
 *
 * Wraps the application and provides DuckDB services to all child components.
 *
 * @example
 * ```tsx
 * function App() {
 *   return (
 *     <DuckDBProvider
 *       fallback={<LoadingScreen />}
 *       errorFallback={(error) => <ErrorScreen error={error} />}
 *       onInitialized={() => console.log('DuckDB ready!')}
 *     >
 *       <MainApp />
 *     </DuckDBProvider>
 *   );
 * }
 * ```
 */
export function DuckDBProvider({
  children,
  config,
  autoInitialize = true,
  onInitialized,
  onError,
  fallback,
  errorFallback,
}: DuckDBProviderProps): React.ReactElement {
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
  const [syncEngine, setSyncEngine] = useState<SyncEngine | null>(null);
  const [schemaManager, setSchemaManager] = useState<SchemaManager | null>(null);

  const initializingRef = useRef(false);
  const mountedRef = useRef(true);

  const initialize = useCallback(async () => {
    if (initializingRef.current) return;

    initializingRef.current = true;
    setIsInitializing(true);
    setError(null);

    try {
      // Check browser capabilities
      const caps = checkBrowserCapabilities();
      if (mountedRef.current) {
        setCapabilities(caps);
      }

      if (!caps.webAssembly) {
        throw new Error(
          'Browser does not support WebAssembly. Please use a modern browser like Chrome, Firefox, or Edge.'
        );
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

      // Log storage mode warning
      if (initResult.storageMode === StorageMode.Memory) {
        console.warn(
          '[DuckDB] OPFS not available, using in-memory storage. Data will not persist.'
        );
      }

      // Initialize schema
      const schema = createSchemaManager(duckdbService);
      await schema.initializeSchema();

      if (!mountedRef.current) return;

      setSchemaManager(schema);

      // Initialize OPFS manager if using OPFS
      if (initResult.storageMode === StorageMode.OPFS) {
        const opfs = getOPFSManager();
        await opfs.initialize();

        if (!mountedRef.current) return;

        setOpfsManager(opfs);

        const status = await duckdbService.getOPFSStatus();
        if (mountedRef.current) setOpfsStatus(status);

        const quota = await opfs.getQuotaInfo();
        if (mountedRef.current) setQuotaInfo(quota);
      }

      // Initialize storage adapter
      const adapter = getDuckDBStorageAdapter();
      await adapter.initialize();

      if (!mountedRef.current) return;

      setStorageAdapter(adapter);

      // Initialize sync engine (it's already a singleton, just get reference)
      const sync = getSyncEngine();
      if (!mountedRef.current) return;

      setSyncEngine(sync);

      // All initialized
      setIsReady(true);
      onInitialized?.();

      console.log(`[DuckDB] Initialized successfully with ${initResult.storageMode} storage`);
    } catch (err) {
      const initError = err instanceof Error ? err : new Error('Failed to initialize DuckDB');
      console.error('[DuckDB] Initialization failed:', initError);

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
      setSyncEngine(null);
      setSchemaManager(null);
    }
  }, [duckdb]);

  const reinitialize = useCallback(async () => {
    await terminate();
    await initialize();
  }, [terminate, initialize]);

  const query = useCallback(
    async <T,>(sql: string, params?: DuckDBParams): Promise<DuckDBQueryResult<T>> => {
      if (!duckdb || !isReady) {
        return {
          success: false,
          rows: [],
          rowCount: 0,
          columnNames: [],
          columnTypes: [],
          executionTimeMs: 0,
          error: 'DuckDB is not initialized',
        };
      }
      return duckdb.query<T>(sql, params);
    },
    [duckdb, isReady]
  );

  const execute = useCallback(
    async (sql: string, params?: DuckDBParams): Promise<{ success: boolean; error?: string }> => {
      if (!duckdb || !isReady) {
        return { success: false, error: 'DuckDB is not initialized' };
      }
      return duckdb.execute(sql, params);
    },
    [duckdb, isReady]
  );

  // Initialize on mount
  useEffect(() => {
    mountedRef.current = true;

    if (autoInitialize) {
      initialize();
    }

    return () => {
      mountedRef.current = false;
    };
  }, [autoInitialize, initialize]);

  // Create context value
  const contextValue: DuckDBContextValue = {
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
    syncEngine,
    schemaManager,
    reinitialize,
    terminate,
    query,
    execute,
  };

  // Handle loading state
  if (isInitializing && fallback) {
    return <>{fallback}</>;
  }

  // Handle error state
  if (error && errorFallback) {
    const errorContent = typeof errorFallback === 'function' ? errorFallback(error) : errorFallback;
    return <>{errorContent}</>;
  }

  return <DuckDBContext.Provider value={contextValue}>{children}</DuckDBContext.Provider>;
}

/**
 * Hook to access DuckDB context
 *
 * @throws Error if used outside of DuckDBProvider
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { isReady, query, storageMode } = useDuckDBContext();
 *
 *   if (!isReady) return <Loading />;
 *
 *   const handleClick = async () => {
 *     const result = await query<Table>('SELECT * FROM tables');
 *     console.log(result.rows);
 *   };
 *
 *   return (
 *     <button onClick={handleClick}>
 *       Load Tables ({storageMode} storage)
 *     </button>
 *   );
 * }
 * ```
 */
export function useDuckDBContext(): DuckDBContextValue {
  const context = useContext(DuckDBContext);

  if (!context) {
    throw new Error('useDuckDBContext must be used within a DuckDBProvider');
  }

  return context;
}

/**
 * Hook to safely access DuckDB context (returns null if not in provider)
 */
export function useDuckDBContextSafe(): DuckDBContextValue | null {
  return useContext(DuckDBContext);
}

/**
 * Higher-order component to require DuckDB to be ready
 */
export function withDuckDB<P extends object>(
  Component: React.ComponentType<P>,
  LoadingComponent?: React.ComponentType,
  ErrorComponent?: React.ComponentType<{ error: Error }>
): React.FC<P> {
  return function WrappedComponent(props: P) {
    const { isReady, isInitializing, error } = useDuckDBContext();

    if (isInitializing) {
      return LoadingComponent ? <LoadingComponent /> : null;
    }

    if (error) {
      return ErrorComponent ? <ErrorComponent error={error} /> : null;
    }

    if (!isReady) {
      return null;
    }

    return <Component {...props} />;
  };
}

export default DuckDBContext;
