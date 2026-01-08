/**
 * Unit tests for useOfflineSync Hook
 * Tests offline sync management hook
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { useSDKModeStore } from '@/services/sdk/sdkMode';

// Mock dependencies
vi.mock('@/services/sdk/sdkMode', () => ({
  useSDKModeStore: vi.fn(),
}));

// Create a mock instance that will be reused
const createMockSyncService = () => ({
  syncToRemote: vi.fn(),
  syncFromRemote: vi.fn(),
  autoMergeOnConnectionRestored: vi.fn(),
  detectConflict: vi.fn(),
});

let mockSyncServiceInstance: ReturnType<typeof createMockSyncService>;

vi.mock('@/services/sync/syncService', () => {
  class MockSyncService {
    constructor() {
      mockSyncServiceInstance = createMockSyncService();
      return mockSyncServiceInstance;
    }
  }
  return {
    SyncService: MockSyncService,
  };
});

describe('useOfflineSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSDKModeStore).mockReturnValue({
      mode: 'online',
    } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize sync service', () => {
    renderHook(() =>
      useOfflineSync({
        workspaceId: 'workspace-1',
        enabled: true,
      })
    );

    expect(mockSyncServiceInstance).toBeDefined();
  });

  it('should not sync in offline mode', async () => {
    vi.mocked(useSDKModeStore).mockReturnValue({
      mode: 'offline',
    } as any);

    const { result } = renderHook(() =>
      useOfflineSync({
        workspaceId: 'workspace-1',
        enabled: true,
      })
    );

    await waitFor(() => {
      expect(result.current.isSyncing).toBe(false);
    });
  });

  it('should sync to remote when online', async () => {
    mockSyncServiceInstance.syncToRemote = vi.fn().mockResolvedValue({ success: true });

    const { result } = renderHook(() =>
      useOfflineSync({
        workspaceId: 'workspace-1',
        enabled: true,
      })
    );

    await result.current.syncToRemote();

    expect(mockSyncServiceInstance.syncToRemote).toHaveBeenCalled();
  });

  it('should sync from remote when online', async () => {
    mockSyncServiceInstance.syncFromRemote = vi.fn().mockResolvedValue({ success: true });

    const { result } = renderHook(() =>
      useOfflineSync({
        workspaceId: 'workspace-1',
        enabled: true,
      })
    );

    await result.current.syncFromRemote();

    expect(mockSyncServiceInstance.syncFromRemote).toHaveBeenCalled();
  });

  it('should auto-merge when connection restored', async () => {
    mockSyncServiceInstance.autoMergeOnConnectionRestored = vi
      .fn()
      .mockResolvedValue({ success: true });

    const { result } = renderHook(() =>
      useOfflineSync({
        workspaceId: 'workspace-1',
        enabled: true,
      })
    );

    await result.current.autoMerge();

    expect(mockSyncServiceInstance.autoMergeOnConnectionRestored).toHaveBeenCalled();
  });
});
