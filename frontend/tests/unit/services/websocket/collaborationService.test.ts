/**
 * Unit tests for Collaboration Service
 * Tests real-time collaboration features and conflict resolution
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CollaborationService } from '@/services/websocket/collaborationService';
import type { Table } from '@/types/table';
import type { Relationship } from '@/types/relationship';

// Create a shared mock instance
let sharedMockWebSocketClient: any;

// Mock WebSocketClient
vi.mock('@/services/websocket/websocketClient', () => {
  class MockWebSocketClient {
    constructor() {
      if (!sharedMockWebSocketClient) {
        sharedMockWebSocketClient = {
          isConnected: vi.fn(() => true),
          send: vi.fn(),
          onMessage: vi.fn(() => () => {}),
          onClose: vi.fn(() => () => {}),
          onError: vi.fn(() => () => {}),
          disconnect: vi.fn(),
          getWorkspaceId: vi.fn(() => 'workspace-1'),
        };
      }
      return sharedMockWebSocketClient;
    }
  }
  return {
    WebSocketClient: MockWebSocketClient,
  };
});

describe('CollaborationService', () => {
  const workspaceId = 'workspace-1';
  const accessToken = 'test-token';
  let collaborationService: CollaborationService;
  let registeredHandlers: Array<(message: any) => void> = [];

  beforeEach(() => {
    vi.clearAllMocks();
    registeredHandlers = [];
    // Reset and setup the shared mock
    sharedMockWebSocketClient = {
      isConnected: vi.fn(() => true),
      send: vi.fn(),
      onMessage: vi.fn((handler: any) => {
        registeredHandlers.push(handler);
        return () => {
          const index = registeredHandlers.indexOf(handler);
          if (index > -1) {
            registeredHandlers.splice(index, 1);
          }
        }; // Return unsubscribe function
      }),
      onClose: vi.fn(() => () => {}),
      onError: vi.fn(() => () => {}),
      disconnect: vi.fn(),
      getWorkspaceId: vi.fn(() => workspaceId),
    };
    collaborationService = new CollaborationService(workspaceId, accessToken);
  });

  // Helper to simulate a message being received
  const simulateMessage = (message: any) => {
    registeredHandlers.forEach((handler) => handler(message));
  };

  describe('table updates', () => {
    it('should send table update via WebSocket', () => {
      const tableUpdate = {
        table_id: 'table-1',
        data: {
          name: 'Updated Table',
          position_x: 100,
          position_y: 200,
        },
      };

      collaborationService.sendTableUpdate(tableUpdate.table_id, tableUpdate.data);

      expect(sharedMockWebSocketClient.send).toHaveBeenCalledWith({
        type: 'update_table',
        workspace_id: workspaceId,
        table_id: tableUpdate.table_id,
        data: tableUpdate.data,
      });
    });

    it('should handle table update messages from other users', () => {
      const updateHandler = vi.fn();
      collaborationService.onTableUpdate(updateHandler);

      const updateMessage = {
        type: 'table_updated',
        workspace_id: workspaceId,
        table_id: 'table-1',
        data: {
          name: 'Updated Table',
          position_x: 100,
          position_y: 200,
        },
        user_id: 'user-2',
        timestamp: '2025-01-01T00:00:00Z',
      };

      // Simulate message received
      simulateMessage(updateMessage);

      expect(updateHandler).toHaveBeenCalledWith({
        tableId: 'table-1',
        data: updateMessage.data,
        userId: 'user-2',
        timestamp: '2025-01-01T00:00:00Z',
      });
    });
  });

  describe('relationship updates', () => {
    it('should send relationship update via WebSocket', () => {
      const relationshipUpdate = {
        relationship_id: 'rel-1',
        data: {
          source_cardinality: '1',
          target_cardinality: 'N',
        },
      };

      collaborationService.sendRelationshipUpdate(
        relationshipUpdate.relationship_id,
        relationshipUpdate.data
      );

      expect(sharedMockWebSocketClient.send).toHaveBeenCalledWith({
        type: 'update_relationship',
        workspace_id: workspaceId,
        relationship_id: relationshipUpdate.relationship_id,
        data: relationshipUpdate.data,
      });
    });

    it('should handle relationship update messages from other users', () => {
      const messageHandler = vi.fn();
      collaborationService.onRelationshipUpdate(messageHandler);

      const updateMessage = {
        type: 'relationship_updated',
        workspace_id: workspaceId,
        relationship_id: 'rel-1',
        data: {
          source_cardinality: '1',
          target_cardinality: 'N',
        },
        user_id: 'user-2',
        timestamp: '2025-01-01T00:00:00Z',
      };

      simulateMessage(updateMessage);

      expect(messageHandler).toHaveBeenCalledWith({
        relationshipId: 'rel-1',
        data: updateMessage.data,
        userId: 'user-2',
        timestamp: '2025-01-01T00:00:00Z',
      });
    });
  });

  describe('presence updates', () => {
    it('should send presence update via WebSocket', () => {
      const presenceUpdate = {
        cursor_position: { x: 100, y: 200 },
        selected_elements: ['table-1', 'table-2'],
      };

      collaborationService.sendPresenceUpdate(
        presenceUpdate.cursor_position,
        presenceUpdate.selected_elements
      );

      expect(sharedMockWebSocketClient.send).toHaveBeenCalledWith({
        type: 'presence_update',
        workspace_id: workspaceId,
        cursor_position: presenceUpdate.cursor_position,
        selected_elements: presenceUpdate.selected_elements,
      });
    });

    it('should handle presence update messages from other users', () => {
      const messageHandler = vi.fn();
      collaborationService.onPresenceUpdate(messageHandler);

      const presenceMessage = {
        type: 'presence_update',
        workspace_id: workspaceId,
        user_id: 'user-2',
        cursor_position: { x: 100, y: 200 },
        selected_elements: ['table-1'],
        timestamp: '2025-01-01T00:00:00Z',
      };

      simulateMessage(presenceMessage);

      expect(messageHandler).toHaveBeenCalledWith({
        userId: 'user-2',
        cursorPosition: { x: 100, y: 200 },
        selectedElements: ['table-1'],
        timestamp: '2025-01-01T00:00:00Z',
      });
    });
  });

  describe('conflict resolution', () => {
    it('should handle conflict warning messages', () => {
      const conflictHandler = vi.fn();
      collaborationService.onConflict(conflictHandler);

      const conflictMessage = {
        type: 'conflict_warning',
        workspace_id: workspaceId,
        element_type: 'table',
        element_id: 'table-1',
        message: 'Table has already been deleted',
        timestamp: '2025-01-01T00:00:00Z',
      };

      simulateMessage(conflictMessage);

      expect(conflictHandler).toHaveBeenCalledWith({
        elementType: 'table',
        elementId: 'table-1',
        message: 'Table has already been deleted',
        timestamp: '2025-01-01T00:00:00Z',
      });
    });

    it('should apply last-change-wins strategy for table updates', () => {
      const tableUpdate1 = {
        type: 'table_updated',
        workspace_id: workspaceId,
        table_id: 'table-1',
        data: { name: 'Table 1' },
        user_id: 'user-1',
        timestamp: '2025-01-01T00:00:00Z',
      };

      const tableUpdate2 = {
        type: 'table_updated',
        workspace_id: workspaceId,
        table_id: 'table-1',
        data: { name: 'Table 1 Updated' },
        user_id: 'user-2',
        timestamp: '2025-01-01T00:01:00Z', // Later timestamp
      };

      const handler = vi.fn();
      collaborationService.onTableUpdate(handler);

      simulateMessage(tableUpdate1);
      simulateMessage(tableUpdate2);

      // Both updates should be received, last one wins
      expect(handler).toHaveBeenCalledTimes(2);
      expect(handler).toHaveBeenLastCalledWith({
        tableId: 'table-1',
        data: { name: 'Table 1 Updated' },
        userId: 'user-2',
        timestamp: '2025-01-01T00:01:00Z',
      });
    });
  });

  describe('connection management', () => {
    it('should check if WebSocket is connected', () => {
      expect(collaborationService.isConnected()).toBe(true);
      expect(sharedMockWebSocketClient.isConnected).toHaveBeenCalled();
    });

    it('should disconnect WebSocket', () => {
      collaborationService.disconnect();
      expect(sharedMockWebSocketClient.disconnect).toHaveBeenCalled();
    });
  });
});
