/**
 * useSyncStatus Hook
 * React hook for monitoring DuckDB sync status between memory/YAML and database
 *
 * @module hooks/useSyncStatus
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { getSyncEngine, SyncEngine } from '@/services/database';
import type {
  SyncStatus,
  SyncResult,
  SyncError,
  FileSyncMetadata,
  WorkspaceData,
} from '@/services/database';

export interface UseSyncStatusOptions {
  /** Whether to auto-refresh status on mount (default: true) */
  autoRefresh?: boolean;
  /** Polling interval in ms for status updates (default: 5000, 0 to disable) */
  pollInterval?: number;
  /** Callback when sync completes */
  onSyncComplete?: (result: SyncResult) => void;
  /** Callback when sync fails */
  onSyncError?: (errors: SyncError[]) => void;
}

export interface UseSyncStatusResult {
  /** Current sync status */
  status: SyncStatus;
  /** Whether a sync is currently in progress */
  isSyncing: boolean;
  /** Last sync result */
  lastSyncResult: SyncResult | null;
  /** Last sync time */
  lastSyncTime: Date | null;
  /** Sync statistics */
  syncStats: {
    totalFiles: number;
    syncedFiles: number;
    modifiedFiles: number;
    lastSyncAt: string | null;
  } | null;
  /** Sync metadata for files */
  fileMetadata: FileSyncMetadata[];
  /** Sync workspace data from memory to DuckDB */
  syncFromMemory: (data: WorkspaceData) => Promise<SyncResult>;
  /** Load workspace data from DuckDB */
  loadFromDatabase: (workspaceId: string) => Promise<WorkspaceData | null>;
  /** Check if a file has changed since last sync */
  hasFileChanged: (filePath: string, content: string) => Promise<boolean>;
  /** Record a file sync */
  recordFileSync: (
    filePath: string,
    resourceType: string,
    resourceId: string,
    content: string
  ) => Promise<void>;
  /** Clear all sync metadata */
  clearSyncMetadata: () => Promise<void>;
  /** Refresh sync status and stats */
  refreshStatus: () => Promise<void>;
}

/**
 * React hook for monitoring and triggering DuckDB sync operations
 *
 * @example
 * ```tsx
 * function SyncStatusBar() {
 *   const {
 *     status,
 *     isSyncing,
 *     syncStats,
 *     lastSyncTime,
 *     syncFromMemory,
 *   } = useSyncStatus();
 *
 *   return (
 *     <div>
 *       <span>Status: {status}</span>
 *       {syncStats?.modifiedFiles > 0 && (
 *         <span>{syncStats.modifiedFiles} files pending</span>
 *       )}
 *       {lastSyncTime && (
 *         <span>Last sync: {lastSyncTime.toLocaleTimeString()}</span>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useSyncStatus(options: UseSyncStatusOptions = {}): UseSyncStatusResult {
  const { autoRefresh = true, pollInterval = 5000, onSyncComplete, onSyncError } = options;

  const [status, setStatus] = useState<SyncStatus>('idle');
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncStats, setSyncStats] = useState<{
    totalFiles: number;
    syncedFiles: number;
    modifiedFiles: number;
    lastSyncAt: string | null;
  } | null>(null);
  const [fileMetadata, setFileMetadata] = useState<FileSyncMetadata[]>([]);

  const mountedRef = useRef(true);
  const syncEngineRef = useRef<SyncEngine | null>(null);

  // Initialize sync engine
  useEffect(() => {
    syncEngineRef.current = getSyncEngine();
  }, []);

  // Refresh status from sync engine
  const refreshStatus = useCallback(async () => {
    if (!syncEngineRef.current) return;

    try {
      const engine = syncEngineRef.current;

      // Get current status
      const currentStatus = engine.getStatus();
      if (mountedRef.current) {
        setStatus(currentStatus);
        setIsSyncing(currentStatus === 'syncing');
      }

      // Get sync stats
      const stats = await engine.getSyncStats();
      if (mountedRef.current) {
        setSyncStats(stats);
      }

      // Get file metadata
      const metadata = await engine.getSyncMetadata();
      if (mountedRef.current) {
        setFileMetadata(metadata);
      }
    } catch (error) {
      console.error('[useSyncStatus] Failed to refresh status:', error);
    }
  }, []);

  // Sync from memory to database
  const syncFromMemory = useCallback(
    async (data: WorkspaceData): Promise<SyncResult> => {
      if (!syncEngineRef.current) {
        throw new Error('Sync engine not initialized');
      }

      setIsSyncing(true);
      setStatus('syncing');

      try {
        const engine = syncEngineRef.current;
        const result = await engine.syncFromMemory(data);

        if (mountedRef.current) {
          setLastSyncResult(result);
          setLastSyncTime(new Date());
          setStatus(result.success ? 'success' : 'error');

          if (result.success) {
            onSyncComplete?.(result);
          } else if (result.errors.length > 0) {
            onSyncError?.(result.errors);
          }
        }

        // Refresh status after sync
        await refreshStatus();

        return result;
      } catch (error) {
        const syncError: SyncError = {
          entityType: 'workspace',
          message: error instanceof Error ? error.message : 'Sync failed',
        };

        if (mountedRef.current) {
          setStatus('error');
          onSyncError?.([syncError]);
        }

        throw error;
      } finally {
        if (mountedRef.current) {
          setIsSyncing(false);
        }
      }
    },
    [onSyncComplete, onSyncError, refreshStatus]
  );

  // Load from database
  const loadFromDatabase = useCallback(
    async (workspaceId: string): Promise<WorkspaceData | null> => {
      if (!syncEngineRef.current) {
        throw new Error('Sync engine not initialized');
      }

      setIsSyncing(true);
      setStatus('syncing');

      try {
        const engine = syncEngineRef.current;
        const data = await engine.loadFromDatabase(workspaceId);

        if (mountedRef.current) {
          setStatus(data ? 'success' : 'idle');
        }

        return data;
      } catch (error) {
        if (mountedRef.current) {
          setStatus('error');
        }
        throw error;
      } finally {
        if (mountedRef.current) {
          setIsSyncing(false);
        }
      }
    },
    []
  );

  // Check if file has changed
  const hasFileChanged = useCallback(
    async (filePath: string, content: string): Promise<boolean> => {
      if (!syncEngineRef.current) {
        return true;
      }
      return syncEngineRef.current.hasFileChanged(filePath, content);
    },
    []
  );

  // Record file sync
  const recordFileSync = useCallback(
    async (
      filePath: string,
      resourceType: string,
      resourceId: string,
      content: string
    ): Promise<void> => {
      if (!syncEngineRef.current) {
        throw new Error('Sync engine not initialized');
      }
      await syncEngineRef.current.recordFileSync(filePath, resourceType, resourceId, content);
      await refreshStatus();
    },
    [refreshStatus]
  );

  // Clear sync metadata
  const clearSyncMetadata = useCallback(async (): Promise<void> => {
    if (!syncEngineRef.current) {
      throw new Error('Sync engine not initialized');
    }
    await syncEngineRef.current.clearSyncMetadata();
    await refreshStatus();
  }, [refreshStatus]);

  // Auto-refresh and polling
  useEffect(() => {
    mountedRef.current = true;

    if (autoRefresh) {
      // Initial refresh
      refreshStatus();

      // Set up polling if interval > 0
      if (pollInterval > 0) {
        const interval = setInterval(refreshStatus, pollInterval);
        return () => {
          mountedRef.current = false;
          clearInterval(interval);
        };
      }
    }

    return () => {
      mountedRef.current = false;
    };
  }, [autoRefresh, pollInterval, refreshStatus]);

  return {
    status,
    isSyncing,
    lastSyncResult,
    lastSyncTime,
    syncStats,
    fileMetadata,
    syncFromMemory,
    loadFromDatabase,
    hasFileChanged,
    recordFileSync,
    clearSyncMetadata,
    refreshStatus,
  };
}

/**
 * Simplified hook for just displaying sync status indicator
 */
export function useSyncIndicator(): {
  isSyncing: boolean;
  hasPendingChanges: boolean;
  lastSyncTime: Date | null;
} {
  const { isSyncing, syncStats, lastSyncTime } = useSyncStatus({
    pollInterval: 10000, // Less frequent polling for indicator
  });

  return {
    isSyncing,
    hasPendingChanges: (syncStats?.modifiedFiles ?? 0) > 0,
    lastSyncTime,
  };
}
