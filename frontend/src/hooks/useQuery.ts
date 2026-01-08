/**
 * useQuery Hook
 * React hook for executing SQL queries against DuckDB-WASM
 *
 * @module hooks/useQuery
 */

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { getDuckDBService } from '@/services/database';
import type { DuckDBParams } from '@/types/duckdb';

export interface UseQueryOptions<T> {
  /** Whether to execute immediately on mount (default: true) */
  immediate?: boolean;
  /** Dependencies that trigger re-fetch when changed */
  deps?: unknown[];
  /** Transform function to apply to results */
  transform?: (rows: T[]) => T[];
  /** Callback when query succeeds */
  onSuccess?: (data: T[]) => void;
  /** Callback when query fails */
  onError?: (error: Error) => void;
  /** Enable query caching (default: false) */
  cache?: boolean;
  /** Cache TTL in milliseconds (default: 30000) */
  cacheTTL?: number;
}

export interface UseQueryResult<T> {
  /** Query result data */
  data: T[] | null;
  /** Whether query is loading */
  isLoading: boolean;
  /** Whether query has been executed at least once */
  isExecuted: boolean;
  /** Query error if any */
  error: Error | null;
  /** Re-execute the query */
  refetch: () => Promise<T[]>;
  /** Reset state to initial */
  reset: () => void;
}

// Simple query cache
const queryCache = new Map<string, { data: unknown[]; timestamp: number }>();

/**
 * React hook for executing SQL queries against DuckDB
 *
 * @example
 * ```tsx
 * function TableList({ domainId }: { domainId: string }) {
 *   const { data, isLoading, error } = useQuery<Table>(
 *     'SELECT * FROM tables WHERE primary_domain_id = ?',
 *     [domainId],
 *     { deps: [domainId] }
 *   );
 *
 *   if (isLoading) return <Loading />;
 *   if (error) return <Error message={error.message} />;
 *
 *   return (
 *     <ul>
 *       {data?.map(table => <li key={table.id}>{table.name}</li>)}
 *     </ul>
 *   );
 * }
 * ```
 */
export function useQuery<T = Record<string, unknown>>(
  sql: string,
  params: DuckDBParams = [],
  options: UseQueryOptions<T> = {}
): UseQueryResult<T> {
  const {
    immediate = true,
    deps = [],
    transform,
    onSuccess,
    onError,
    cache = false,
    cacheTTL = 30000,
  } = options;

  const [data, setData] = useState<T[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExecuted, setIsExecuted] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Generate cache key from SQL and params
  const cacheKey = useMemo(() => {
    if (!cache) return null;
    return `${sql}:${JSON.stringify(params)}`;
  }, [sql, params, cache]);

  const execute = useCallback(async (): Promise<T[]> => {
    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    // Check cache first
    if (cache && cacheKey) {
      const cached = queryCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < cacheTTL) {
        const cachedData = cached.data as T[];
        setData(cachedData);
        setIsExecuted(true);
        return cachedData;
      }
    }

    setIsLoading(true);
    setError(null);

    try {
      const duckdb = getDuckDBService();

      if (!duckdb.isInitialized()) {
        throw new Error('DuckDB is not initialized');
      }

      const result = await duckdb.query<T>(sql, params);

      if (!result.success) {
        throw new Error(result.error || 'Query failed');
      }

      if (!mountedRef.current) {
        return [];
      }

      let rows = result.rows;

      // Apply transform if provided
      if (transform) {
        rows = transform(rows);
      }

      // Update cache
      if (cache && cacheKey) {
        queryCache.set(cacheKey, { data: rows, timestamp: Date.now() });
      }

      setData(rows);
      setIsExecuted(true);
      onSuccess?.(rows);

      return rows;
    } catch (err) {
      const queryError = err instanceof Error ? err : new Error('Query failed');

      if (mountedRef.current) {
        setError(queryError);
        onError?.(queryError);
      }

      throw queryError;
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [sql, params, transform, onSuccess, onError, cache, cacheKey, cacheTTL]);

  const reset = useCallback(() => {
    setData(null);
    setIsLoading(false);
    setIsExecuted(false);
    setError(null);
  }, []);

  // Execute on mount and when deps change
  useEffect(() => {
    mountedRef.current = true;

    if (immediate) {
      execute().catch(() => {
        // Error already handled in execute
      });
    }

    return () => {
      mountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [immediate, ...deps]);

  return {
    data,
    isLoading,
    isExecuted,
    error,
    refetch: execute,
    reset,
  };
}

/**
 * Hook for executing a single query that returns one row
 */
export function useQuerySingle<T = Record<string, unknown>>(
  sql: string,
  params: DuckDBParams = [],
  options: Omit<UseQueryOptions<T>, 'transform'> = {}
): Omit<UseQueryResult<T>, 'data'> & { data: T | null } {
  const result = useQuery<T>(sql, params, options);

  return {
    ...result,
    data: result.data?.[0] ?? null,
  };
}

/**
 * Hook for executing mutations (INSERT, UPDATE, DELETE)
 */
export interface UseMutationOptions {
  /** Callback when mutation succeeds */
  onSuccess?: () => void;
  /** Callback when mutation fails */
  onError?: (error: Error) => void;
}

export interface UseMutationResult {
  /** Execute the mutation */
  mutate: (sql: string, params?: DuckDBParams) => Promise<void>;
  /** Execute multiple mutations in a transaction */
  mutateMany: (queries: Array<{ sql: string; params?: DuckDBParams }>) => Promise<void>;
  /** Whether mutation is in progress */
  isLoading: boolean;
  /** Mutation error if any */
  error: Error | null;
  /** Reset state */
  reset: () => void;
}

/**
 * React hook for executing SQL mutations (INSERT, UPDATE, DELETE)
 *
 * @example
 * ```tsx
 * function CreateTableButton() {
 *   const { mutate, isLoading, error } = useMutation({
 *     onSuccess: () => console.log('Table created'),
 *   });
 *
 *   const handleCreate = async () => {
 *     await mutate(
 *       'INSERT INTO tables (id, name) VALUES (?, ?)',
 *       [crypto.randomUUID(), 'New Table']
 *     );
 *   };
 *
 *   return (
 *     <button onClick={handleCreate} disabled={isLoading}>
 *       {isLoading ? 'Creating...' : 'Create Table'}
 *     </button>
 *   );
 * }
 * ```
 */
export function useMutation(options: UseMutationOptions = {}): UseMutationResult {
  const { onSuccess, onError } = options;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mountedRef = useRef(true);

  const mutate = useCallback(
    async (sql: string, params: DuckDBParams = []): Promise<void> => {
      setIsLoading(true);
      setError(null);

      try {
        const duckdb = getDuckDBService();

        if (!duckdb.isInitialized()) {
          throw new Error('DuckDB is not initialized');
        }

        const result = await duckdb.execute(sql, params);

        if (!result.success) {
          throw new Error(result.error || 'Mutation failed');
        }

        if (!mountedRef.current) {
          return;
        }

        onSuccess?.();

        // Invalidate query cache on mutations
        queryCache.clear();
      } catch (err) {
        const mutationError = err instanceof Error ? err : new Error('Mutation failed');

        if (mountedRef.current) {
          setError(mutationError);
          onError?.(mutationError);
        }

        throw mutationError;
      } finally {
        if (mountedRef.current) {
          setIsLoading(false);
        }
      }
    },
    [onSuccess, onError]
  );

  const mutateMany = useCallback(
    async (queries: Array<{ sql: string; params?: DuckDBParams }>): Promise<void> => {
      setIsLoading(true);
      setError(null);

      try {
        const duckdb = getDuckDBService();

        if (!duckdb.isInitialized()) {
          throw new Error('DuckDB is not initialized');
        }

        // Execute in a transaction
        const txResult = await duckdb.transaction(async (conn) => {
          for (const query of queries) {
            if (query.params && query.params.length > 0) {
              const stmt = await conn.prepare(query.sql);
              await stmt.query(...query.params);
              await stmt.close();
            } else {
              await conn.query(query.sql);
            }
          }
        });

        if (!txResult.success) {
          throw new Error(txResult.error || 'Transaction failed');
        }

        if (!mountedRef.current) {
          return;
        }

        onSuccess?.();

        // Invalidate query cache
        queryCache.clear();
      } catch (err) {
        const mutationError = err instanceof Error ? err : new Error('Mutation failed');

        if (mountedRef.current) {
          setError(mutationError);
          onError?.(mutationError);
        }

        throw mutationError;
      } finally {
        if (mountedRef.current) {
          setIsLoading(false);
        }
      }
    },
    [onSuccess, onError]
  );

  const reset = useCallback(() => {
    setIsLoading(false);
    setError(null);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return {
    mutate,
    mutateMany,
    isLoading,
    error,
    reset,
  };
}

/**
 * Clear the query cache
 */
export function clearQueryCache(): void {
  queryCache.clear();
}

/**
 * Invalidate specific cache entries by pattern
 */
export function invalidateQueries(pattern: string | RegExp): void {
  const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;

  for (const key of queryCache.keys()) {
    if (regex.test(key)) {
      queryCache.delete(key);
    }
  }
}
