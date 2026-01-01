/**
 * Integration tests for Collaboration
 * Tests real-time collaboration workflow
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CollaborationService } from '@/services/websocket/collaborationService';
import { useCollaborationStore } from '@/stores/collaborationStore';
import { useModelStore } from '@/stores/modelStore';
import type { Table } from '@/types/table';
import type { Relationship } from '@/types/relationship';

// Mock WebSocket client
vi.mock('@/services/websocket/websocketClient', () => ({
  WebSocketClient: vi.fn().mockImplementation(() => {
    const handlers: Map<string, Set<Function>> = new Map();
    
    return {
      isConnected: vi.fn(() => true),
      send: vi.fn(),
      onMessage: vi.fn((handler: Function) => {
        if (!handlers.has('message')) {
          handlers.set('message', new Set());
        }
        handlers.get('message')!.add(handler);
        return () => handlers.get('message')!.delete(handler);
      }),
      onClose: vi.fn(() => () => {}),
      onError: vi.fn(() => () => {}),
      disconnect: vi.fn(),
      getWorkspaceId: vi.fn(() => 'workspace-1'),
      // Test helper to simulate message
      _simulateMessage: (message: any) => {
        handlers.get('message')?.forEach((h) => h(message));
      },
    };
  }),
}));

describe('Collaboration Integration', () => {
  const workspaceId = 'workspace-1';
  const accessToken = 'test-token';
  let collaborationService: CollaborationService;
  let wsClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset stores
    useCollaborationStore.setState({
      session: null,
      currentUserId: null,
      conflicts: [],
    });
    
    useModelStore.setState({
      tables: [],
      relationships: [],
      domains: [],
      dataFlowDiagrams: [],
      selectedTableId: null,
      selectedRelationshipId: null,
      selectedDomainId: null,
      selectedDataFlowDiagramId: null,
      isLoading: false,
      error: null,
    });

    // Create collaboration service
    collaborationService = new CollaborationService(workspaceId, accessToken);
    
    // Get WebSocket client instance
    const { WebSocketClient } = require('@/services/websocket/websocketClient');
    wsClient = (WebSocketClient as any).mock.results[(WebSocketClient as any).mock.results.length - 1].value;
  });

  describe('real-time table updates', () => {
    it('should update table in store when receiving table update message', () => {
      const initialTable: Table = {
        id: 'table-1',
        workspace_id: workspaceId,
        primary_domain_id: 'domain-1',
        name: 'Original Table',
        model_type: 'conceptual',
        columns: [],
        position_x: 0,
        position_y: 0,
        width: 200,
        height: 150,
        visible_domains: ['domain-1'],
        created_at: '2025-01-01T00:00:00Z',
        last_modified_at: '2025-01-01T00:00:00Z',
      };

      useModelStore.getState().addTable(initialTable);

      // Register handler
      collaborationService.onTableUpdate((event) => {
        useModelStore.getState().updateTable(event.tableId, event.data);
      });

      // Simulate table update from another user
      wsClient._simulateMessage({
        type: 'table_updated',
        workspace_id: workspaceId,
        table_id: 'table-1',
        data: {
          name: 'Updated Table',
          position_x: 100,
          position_y: 200,
        },
        user_id: 'user-2',
        timestamp: '2025-01-01T00:01:00Z',
      });

      const updatedTable = useModelStore.getState().tables.find((t) => t.id === 'table-1');
      expect(updatedTable?.name).toBe('Updated Table');
      expect(updatedTable?.position_x).toBe(100);
      expect(updatedTable?.position_y).toBe(200);
    });

    it('should send table update to other users', () => {
      collaborationService.sendTableUpdate('table-1', {
        name: 'Updated Table',
        position_x: 100,
        position_y: 200,
      });

      expect(wsClient.send).toHaveBeenCalledWith({
        type: 'update_table',
        workspace_id: workspaceId,
        table_id: 'table-1',
        data: {
          name: 'Updated Table',
          position_x: 100,
          position_y: 200,
        },
      });
    });
  });

  describe('real-time relationship updates', () => {
    it('should update relationship in store when receiving relationship update message', () => {
      const initialRelationship: Relationship = {
        id: 'rel-1',
        workspace_id: workspaceId,
        domain_id: 'domain-1',
        source_table_id: 'table-1',
        target_table_id: 'table-2',
        type: 'one-to-many',
        source_cardinality: '1',
        target_cardinality: 'N',
        label: 'Original Relationship',
        model_type: 'conceptual',
        is_circular: false,
        created_at: '2025-01-01T00:00:00Z',
        last_modified_at: '2025-01-01T00:00:00Z',
      };

      useModelStore.getState().addRelationship(initialRelationship);

      // Register handler
      collaborationService.onRelationshipUpdate((event) => {
        useModelStore.getState().updateRelationship(event.relationshipId, event.data);
      });

      // Simulate relationship update from another user
      wsClient._simulateMessage({
        type: 'relationship_updated',
        workspace_id: workspaceId,
        relationship_id: 'rel-1',
        data: {
          source_cardinality: 'N',
          target_cardinality: 'N',
          label: 'Updated Relationship',
        },
        user_id: 'user-2',
        timestamp: '2025-01-01T00:01:00Z',
      });

      const updatedRelationship = useModelStore.getState().relationships.find((r) => r.id === 'rel-1');
      expect(updatedRelationship?.source_cardinality).toBe('N');
      expect(updatedRelationship?.target_cardinality).toBe('N');
      expect(updatedRelationship?.label).toBe('Updated Relationship');
    });
  });

  describe('presence updates', () => {
    it('should update participant presence in collaboration store', () => {
      const session = {
        workspaceId,
        primaryOwnerId: 'user-1',
        participants: [
          {
            userId: 'user-2',
            accessLevel: 'edit' as const,
            lastSeen: '2025-01-01T00:00:00Z',
          },
        ],
        isConnected: true,
        connectionStatus: 'connected' as const,
      };

      useCollaborationStore.getState().setSession(session);

      // Register handler
      collaborationService.onPresenceUpdate((event) => {
        useCollaborationStore.getState().updateParticipantPresence(
          event.userId,
          event.cursorPosition,
          event.selectedElements
        );
      });

      // Simulate presence update
      wsClient._simulateMessage({
        type: 'presence_update',
        workspace_id: workspaceId,
        user_id: 'user-2',
        cursor_position: { x: 100, y: 200 },
        selected_elements: ['table-1'],
        timestamp: '2025-01-01T00:01:00Z',
      });

      const participant = useCollaborationStore.getState().getParticipant('user-2');
      expect(participant?.cursorPosition).toEqual({ x: 100, y: 200 });
      expect(participant?.selectedElements).toEqual(['table-1']);
    });
  });

  describe('conflict resolution', () => {
    it('should add conflict to store when receiving conflict warning', () => {
      // Register handler
      collaborationService.onConflict((event) => {
        useCollaborationStore.getState().addConflict({
          elementType: event.elementType,
          elementId: event.elementId,
          message: event.message,
          timestamp: event.timestamp,
        });
      });

      // Simulate conflict warning
      wsClient._simulateMessage({
        type: 'conflict_warning',
        workspace_id: workspaceId,
        element_type: 'table',
        element_id: 'table-1',
        message: 'Table has already been deleted',
        timestamp: '2025-01-01T00:01:00Z',
      });

      const conflicts = useCollaborationStore.getState().conflicts;
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].message).toBe('Table has already been deleted');
      expect(conflicts[0].elementType).toBe('table');
      expect(conflicts[0].elementId).toBe('table-1');
    });

    it('should apply last-change-wins for simultaneous table updates', () => {
      const initialTable: Table = {
        id: 'table-1',
        workspace_id: workspaceId,
        primary_domain_id: 'domain-1',
        name: 'Original Table',
        model_type: 'conceptual',
        columns: [],
        position_x: 0,
        position_y: 0,
        width: 200,
        height: 150,
        visible_domains: ['domain-1'],
        created_at: '2025-01-01T00:00:00Z',
        last_modified_at: '2025-01-01T00:00:00Z',
      };

      useModelStore.getState().addTable(initialTable);

      // Register handler
      collaborationService.onTableUpdate((event) => {
        useModelStore.getState().updateTable(event.tableId, event.data);
      });

      // Simulate two simultaneous updates
      wsClient._simulateMessage({
        type: 'table_updated',
        workspace_id: workspaceId,
        table_id: 'table-1',
        data: { name: 'Update 1' },
        user_id: 'user-2',
        timestamp: '2025-01-01T00:01:00Z',
      });

      wsClient._simulateMessage({
        type: 'table_updated',
        workspace_id: workspaceId,
        table_id: 'table-1',
        data: { name: 'Update 2' },
        user_id: 'user-3',
        timestamp: '2025-01-01T00:02:00Z', // Later timestamp
      });

      // Last change should win
      const updatedTable = useModelStore.getState().tables.find((t) => t.id === 'table-1');
      expect(updatedTable?.name).toBe('Update 2');
    });
  });
});

