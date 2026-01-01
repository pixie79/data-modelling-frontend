/**
 * useCollaboration Hook
 * React hook for managing collaboration features
 */

import { useEffect, useCallback, useRef } from 'react';
import { CollaborationService } from '@/services/websocket/collaborationService';
import { useCollaborationStore } from '@/stores/collaborationStore';
import { useModelStore } from '@/stores/modelStore';
import { useSDKModeStore } from '@/services/sdk/sdkMode';
import { apiClient } from '@/services/api/apiClient';
import type {
  TableUpdateData,
  RelationshipUpdateData,
  CursorPosition,
} from '@/services/websocket/collaborationService';

export interface UseCollaborationOptions {
  workspaceId: string;
  enabled?: boolean;
}

export function useCollaboration({ workspaceId, enabled = true }: UseCollaborationOptions) {
  const { mode } = useSDKModeStore();
  const collaborationServiceRef = useRef<CollaborationService | null>(null);
  const { setConnectionStatus, updateParticipantPresence, addConflict } =
    useCollaborationStore();
  const { updateTable, updateRelationship } = useModelStore();

  // Initialize collaboration service
  useEffect(() => {
    if (mode === 'offline' || !enabled || !workspaceId) {
      return;
    }

    const accessToken = apiClient.getAccessToken();
    if (!accessToken) {
      console.warn('No access token available for collaboration');
      return;
    }

    const service = new CollaborationService(workspaceId, accessToken);
    collaborationServiceRef.current = service;

    // Setup message handlers
    const unsubscribeTableUpdate = service.onTableUpdate((event) => {
      // Apply last-change-wins: update table in store
      updateTable(event.tableId, event.data);
    });

    const unsubscribeRelationshipUpdate = service.onRelationshipUpdate((event) => {
      // Apply last-change-wins: update relationship in store
      updateRelationship(event.relationshipId, event.data);
    });

    const unsubscribePresenceUpdate = service.onPresenceUpdate((event) => {
      // Update participant presence
      updateParticipantPresence(
        event.userId,
        event.cursorPosition,
        event.selectedElements
      );
    });

    const unsubscribeConflict = service.onConflict((event) => {
      // Add conflict to store
      addConflict({
        elementType: event.elementType,
        elementId: event.elementId,
        message: event.message,
        timestamp: event.timestamp,
      });
    });

    // Update connection status
    const statusInterval = setInterval(() => {
      const isConnected = service.isConnected();
      setConnectionStatus(isConnected ? 'connected' : 'disconnected');
    }, 1000);

    // Cleanup
    return () => {
      clearInterval(statusInterval);
      unsubscribeTableUpdate();
      unsubscribeRelationshipUpdate();
      unsubscribePresenceUpdate();
      unsubscribeConflict();
      service.disconnect();
      collaborationServiceRef.current = null;
    };
  }, [workspaceId, enabled, mode, updateTable, updateRelationship, updateParticipantPresence, addConflict, setConnectionStatus]);

  // Send table update
  const sendTableUpdate = useCallback(
    (tableId: string, data: TableUpdateData) => {
      if (collaborationServiceRef.current) {
        collaborationServiceRef.current.sendTableUpdate(tableId, data);
      }
    },
    []
  );

  // Send relationship update
  const sendRelationshipUpdate = useCallback(
    (relationshipId: string, data: RelationshipUpdateData) => {
      if (collaborationServiceRef.current) {
        collaborationServiceRef.current.sendRelationshipUpdate(relationshipId, data);
      }
    },
    []
  );

  // Send presence update
  const sendPresenceUpdate = useCallback(
    (cursorPosition?: CursorPosition, selectedElements?: string[]) => {
      if (collaborationServiceRef.current) {
        collaborationServiceRef.current.sendPresenceUpdate(cursorPosition, selectedElements);
      }
    },
    []
  );

  const isConnected = collaborationServiceRef.current?.isConnected() ?? false;

  return {
    isConnected,
    sendTableUpdate,
    sendRelationshipUpdate,
    sendPresenceUpdate,
  };
}

