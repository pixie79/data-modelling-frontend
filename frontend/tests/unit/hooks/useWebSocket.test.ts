/**
 * Unit tests for useWebSocket Hook
 * Tests WebSocket hook functionality
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useSDKModeStore } from '@/services/sdk/sdkMode';
import { apiClient } from '@/services/api/apiClient';

// Mock dependencies
vi.mock('@/services/sdk/sdkMode', () => ({
  useSDKModeStore: vi.fn(),
}));

vi.mock('@/services/api/apiClient', () => ({
  apiClient: {
    getAccessToken: vi.fn(),
  },
}));

vi.mock('@/services/websocket/websocketClient', () => ({
  WebSocketClient: vi.fn().mockImplementation(() => ({
    isConnected: vi.fn(() => true),
    send: vi.fn(),
    onMessage: vi.fn(() => () => {}),
    onClose: vi.fn(() => () => {}),
    onError: vi.fn(() => () => {}),
    disconnect: vi.fn(),
  })),
}));

describe('useWebSocket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSDKModeStore).mockReturnValue({
      mode: 'online',
    } as any);
    vi.mocked(apiClient.getAccessToken).mockReturnValue('test-token');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should not connect in offline mode', () => {
    vi.mocked(useSDKModeStore).mockReturnValue({
      mode: 'offline',
    } as any);

    const { result } = renderHook(() =>
      useWebSocket({
        workspaceId: 'workspace-1',
        enabled: true,
      })
    );

    expect(result.current.isConnected).toBe(false);
  });

  it('should not connect when disabled', () => {
    const { result } = renderHook(() =>
      useWebSocket({
        workspaceId: 'workspace-1',
        enabled: false,
      })
    );

    expect(result.current.isConnected).toBe(false);
  });

  it('should connect when enabled and online', async () => {
    const { result } = renderHook(() =>
      useWebSocket({
        workspaceId: 'workspace-1',
        enabled: true,
      })
    );

    await waitFor(() => {
      expect(result.current.connectionStatus).toBeDefined();
    });
  });

  it('should call onMessage callback when message received', async () => {
    const onMessage = vi.fn();
    const { WebSocketClient } = await import('@/services/websocket/websocketClient');
    const mockClient = (WebSocketClient as any).mock.results[0].value;

    renderHook(() =>
      useWebSocket({
        workspaceId: 'workspace-1',
        enabled: true,
        onMessage,
      })
    );

    await waitFor(() => {
      expect(mockClient.onMessage).toHaveBeenCalled();
    });
  });

  it('should call onClose callback when connection closes', async () => {
    const onClose = vi.fn();
    const { WebSocketClient } = await import('@/services/websocket/websocketClient');
    const mockClient = (WebSocketClient as any).mock.results[0].value;

    renderHook(() =>
      useWebSocket({
        workspaceId: 'workspace-1',
        enabled: true,
        onClose,
      })
    );

    await waitFor(() => {
      expect(mockClient.onClose).toHaveBeenCalled();
    });
  });

  it('should send messages when connected', async () => {
    const { result } = renderHook(() =>
      useWebSocket({
        workspaceId: 'workspace-1',
        enabled: true,
      })
    );

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    const { WebSocketClient } = await import('@/services/websocket/websocketClient');
    const mockClient = (WebSocketClient as any).mock.results[0].value;

    result.current.send({
      type: 'test_message',
      workspace_id: 'workspace-1',
    });

    expect(mockClient.send).toHaveBeenCalled();
  });

  it('should cleanup on unmount', async () => {
    const { WebSocketClient } = await import('@/services/websocket/websocketClient');
    const mockDisconnect = vi.fn();
    (WebSocketClient as any).mockImplementation(() => ({
      isConnected: vi.fn(() => true),
      send: vi.fn(),
      onMessage: vi.fn(() => () => {}),
      onClose: vi.fn(() => () => {}),
      onError: vi.fn(() => () => {}),
      disconnect: mockDisconnect,
    }));

    const { unmount } = renderHook(() =>
      useWebSocket({
        workspaceId: 'workspace-1',
        enabled: true,
      })
    );

    unmount();

    await waitFor(() => {
      expect(mockDisconnect).toHaveBeenCalled();
    });
  });
});

