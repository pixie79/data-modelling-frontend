/**
 * useWebSocket Hook
 * React hook for managing WebSocket connections
 */

import { useEffect, useRef, useState } from 'react';
import { WebSocketClient, type WebSocketMessage } from '@/services/websocket/websocketClient';
import { useSDKModeStore } from '@/services/sdk/sdkMode';
import { apiClient } from '@/services/api/apiClient';

export interface UseWebSocketOptions {
  workspaceId: string;
  enabled?: boolean;
  onMessage?: (message: WebSocketMessage) => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
}

export function useWebSocket({
  workspaceId,
  enabled = true,
  onMessage,
  onClose,
  onError,
}: UseWebSocketOptions) {
  const { mode } = useSDKModeStore();
  const wsClientRef = useRef<WebSocketClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'reconnecting'>('disconnected');

  useEffect(() => {
    // Don't connect in offline mode or if disabled
    if (mode === 'offline' || !enabled || !workspaceId) {
      return;
    }

    // Get access token
    const accessToken = apiClient.getAccessToken();
    if (!accessToken) {
      console.warn('No access token available for WebSocket connection');
      return;
    }

    // Create WebSocket client
    const client = new WebSocketClient(workspaceId, accessToken);
    wsClientRef.current = client;

    // Setup handlers
    const unsubscribeMessage = client.onMessage((message) => {
      onMessage?.(message);
    });

    const unsubscribeClose = client.onClose(() => {
      setIsConnected(false);
      setConnectionStatus('disconnected');
      onClose?.();
    });

    const unsubscribeError = client.onError((error) => {
      setConnectionStatus('disconnected');
      onError?.(error);
    });

    // Check connection status periodically
    const statusInterval = setInterval(() => {
      const connected = client.isConnected();
      setIsConnected(connected);
      if (connected) {
        setConnectionStatus('connected');
      } else if (connectionStatus === 'connected') {
        setConnectionStatus('reconnecting');
      }
    }, 1000);

    setIsConnected(client.isConnected());
    setConnectionStatus(client.isConnected() ? 'connected' : 'reconnecting');

    // Cleanup
    return () => {
      clearInterval(statusInterval);
      unsubscribeMessage();
      unsubscribeClose();
      unsubscribeError();
      client.disconnect();
      wsClientRef.current = null;
    };
  }, [workspaceId, enabled, mode, onMessage, onClose, onError, connectionStatus]);

  const send = (message: WebSocketMessage) => {
    if (wsClientRef.current && isConnected) {
      wsClientRef.current.send(message);
    } else {
      console.warn('WebSocket is not connected. Message not sent:', message);
    }
  };

  return {
    isConnected,
    connectionStatus,
    send,
  };
}

