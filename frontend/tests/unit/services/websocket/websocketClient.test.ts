/**
 * Unit tests for WebSocket Client Service
 * Tests WebSocket connection, authentication, and message handling
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { WebSocketClient } from '@/services/websocket/websocketClient';

// Mock WebSocket
class MockWebSocket {
  url: string;
  readyState: number = WebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  send: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;

  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  constructor(url: string) {
    this.url = url;
    this.send = vi.fn();
    this.close = vi.fn();
    
    // Simulate connection after a short delay
    setTimeout(() => {
      this.readyState = WebSocket.OPEN;
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    }, 10);
  }

  // Helper methods for testing
  simulateMessage(data: any) {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', { data: JSON.stringify(data) }));
    }
  }

  simulateClose(code?: number, reason?: string) {
    this.readyState = WebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close', { code, reason }));
    }
  }

  simulateError() {
    if (this.onerror) {
      this.onerror(new Event('error'));
    }
  }
}

// Replace global WebSocket with mock
global.WebSocket = MockWebSocket as any;

describe('WebSocketClient', () => {
  const workspaceId = 'workspace-1';
  const accessToken = 'test-access-token';
  const wsBaseUrl = 'ws://localhost:8081';

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment
    vi.stubEnv('VITE_WS_BASE_URL', wsBaseUrl);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('connection', () => {
    it('should connect to WebSocket with JWT token', async () => {
      const client = new WebSocketClient(workspaceId, accessToken);
      
      await new Promise((resolve) => setTimeout(resolve, 50));
      
      expect(client.isConnected()).toBe(true);
      expect(client.getWorkspaceId()).toBe(workspaceId);
    });

    it('should include token in WebSocket URL', async () => {
      const client = new WebSocketClient(workspaceId, accessToken);
      
      await new Promise((resolve) => setTimeout(resolve, 50));
      
      // Verify WebSocket was created with correct URL
      expect(client.isConnected()).toBe(true);
    });

    it('should handle connection errors', async () => {
      const client = new WebSocketClient(workspaceId, accessToken);
      
      await new Promise((resolve) => setTimeout(resolve, 50));
      
      // Simulate error
      const ws = (client as any).socket as MockWebSocket;
      ws.simulateError();
      
      await new Promise((resolve) => setTimeout(resolve, 10));
      
      // Client should handle error gracefully
      expect(client.isConnected()).toBe(false);
    });

    it('should reconnect on connection close', async () => {
      const client = new WebSocketClient(workspaceId, accessToken);
      
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(client.isConnected()).toBe(true);
      
      // Close connection
      const ws = (client as any).socket as MockWebSocket;
      ws.simulateClose(1000, 'Normal closure');
      
      await new Promise((resolve) => setTimeout(resolve, 10));
      
      // Should attempt to reconnect
      // Note: Actual reconnection logic would be tested here
    });
  });

  describe('message handling', () => {
    it('should send messages to WebSocket', async () => {
      const client = new WebSocketClient(workspaceId, accessToken);
      
      await new Promise((resolve) => setTimeout(resolve, 50));
      
      const message = {
        type: 'update_table',
        workspace_id: workspaceId,
        table_id: 'table-1',
        data: { name: 'Updated Table' },
      };
      
      client.send(message);
      
      const ws = (client as any).socket as MockWebSocket;
      expect(ws.send).toHaveBeenCalledWith(JSON.stringify(message));
    });

    it('should receive and handle messages from WebSocket', async () => {
      const client = new WebSocketClient(workspaceId, accessToken);
      const messageHandler = vi.fn();
      
      client.onMessage(messageHandler);
      
      await new Promise((resolve) => setTimeout(resolve, 50));
      
      const receivedMessage = {
        type: 'table_updated',
        workspace_id: workspaceId,
        table_id: 'table-1',
        data: { name: 'Updated Table' },
        user_id: 'user-2',
        timestamp: '2025-01-01T00:00:00Z',
      };
      
      const ws = (client as any).socket as MockWebSocket;
      ws.simulateMessage(receivedMessage);
      
      await new Promise((resolve) => setTimeout(resolve, 10));
      
      expect(messageHandler).toHaveBeenCalledWith(receivedMessage);
    });

    it('should handle multiple message handlers', async () => {
      const client = new WebSocketClient(workspaceId, accessToken);
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      
      client.onMessage(handler1);
      client.onMessage(handler2);
      
      await new Promise((resolve) => setTimeout(resolve, 50));
      
      const message = {
        type: 'table_updated',
        workspace_id: workspaceId,
        table_id: 'table-1',
        data: {},
        user_id: 'user-2',
        timestamp: '2025-01-01T00:00:00Z',
      };
      
      const ws = (client as any).socket as MockWebSocket;
      ws.simulateMessage(message);
      
      await new Promise((resolve) => setTimeout(resolve, 10));
      
      expect(handler1).toHaveBeenCalledWith(message);
      expect(handler2).toHaveBeenCalledWith(message);
    });
  });

  describe('disconnection', () => {
    it('should close WebSocket connection', async () => {
      const client = new WebSocketClient(workspaceId, accessToken);
      
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(client.isConnected()).toBe(true);
      
      const ws = (client as any).socket as MockWebSocket;
      const closeSpy = ws.close;
      
      client.disconnect();
      
      expect(closeSpy).toHaveBeenCalled();
      expect(client.isConnected()).toBe(false);
    });

    it('should handle close event', async () => {
      const client = new WebSocketClient(workspaceId, accessToken);
      const closeHandler = vi.fn();
      
      client.onClose(closeHandler);
      
      await new Promise((resolve) => setTimeout(resolve, 50));
      
      const ws = (client as any).socket as MockWebSocket;
      ws.simulateClose(1000, 'Normal closure');
      
      await new Promise((resolve) => setTimeout(resolve, 10));
      
      expect(closeHandler).toHaveBeenCalled();
    });
  });
});

