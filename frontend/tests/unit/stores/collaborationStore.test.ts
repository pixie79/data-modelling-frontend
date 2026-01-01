/**
 * Unit tests for Collaboration Store
 * Tests collaboration state management
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useCollaborationStore } from '@/stores/collaborationStore';
import type { CollaborationSession, CollaborationParticipant } from '@/stores/collaborationStore';

describe('CollaborationStore', () => {
  beforeEach(() => {
    // Reset store state
    useCollaborationStore.setState({
      session: null,
      currentUserId: null,
      conflicts: [],
    });
  });

  describe('session management', () => {
    it('should set collaboration session', () => {
      const session: CollaborationSession = {
        workspaceId: 'workspace-1',
        primaryOwnerId: 'user-1',
        participants: [],
        isConnected: true,
        connectionStatus: 'connected',
      };

      useCollaborationStore.getState().setSession(session);

      expect(useCollaborationStore.getState().session).toEqual(session);
    });

    it('should set current user ID', () => {
      useCollaborationStore.getState().setCurrentUserId('user-1');
      expect(useCollaborationStore.getState().currentUserId).toBe('user-1');
    });

    it('should update connection status', () => {
      const session: CollaborationSession = {
        workspaceId: 'workspace-1',
        primaryOwnerId: 'user-1',
        participants: [],
        isConnected: true,
        connectionStatus: 'connected',
      };

      useCollaborationStore.getState().setSession(session);
      useCollaborationStore.getState().setConnectionStatus('reconnecting');

      expect(useCollaborationStore.getState().session?.connectionStatus).toBe('reconnecting');
      expect(useCollaborationStore.getState().session?.isConnected).toBe(false);
    });
  });

  describe('participant management', () => {
    it('should add participant', () => {
      const session: CollaborationSession = {
        workspaceId: 'workspace-1',
        primaryOwnerId: 'user-1',
        participants: [],
        isConnected: true,
        connectionStatus: 'connected',
      };

      useCollaborationStore.getState().setSession(session);

      const participant: CollaborationParticipant = {
        userId: 'user-2',
        userName: 'User 2',
        accessLevel: 'edit',
        lastSeen: '2025-01-01T00:00:00Z',
      };

      useCollaborationStore.getState().addParticipant(participant);

      expect(useCollaborationStore.getState().getParticipants()).toHaveLength(1);
      expect(useCollaborationStore.getState().getParticipant('user-2')).toEqual(participant);
    });

    it('should update participant', () => {
      const session: CollaborationSession = {
        workspaceId: 'workspace-1',
        primaryOwnerId: 'user-1',
        participants: [
          {
            userId: 'user-2',
            accessLevel: 'read',
            lastSeen: '2025-01-01T00:00:00Z',
          },
        ],
        isConnected: true,
        connectionStatus: 'connected',
      };

      useCollaborationStore.getState().setSession(session);
      useCollaborationStore.getState().updateParticipant('user-2', { accessLevel: 'edit' });

      expect(useCollaborationStore.getState().getParticipant('user-2')?.accessLevel).toBe('edit');
    });

    it('should remove participant', () => {
      const session: CollaborationSession = {
        workspaceId: 'workspace-1',
        primaryOwnerId: 'user-1',
        participants: [
          {
            userId: 'user-2',
            accessLevel: 'edit',
            lastSeen: '2025-01-01T00:00:00Z',
          },
        ],
        isConnected: true,
        connectionStatus: 'connected',
      };

      useCollaborationStore.getState().setSession(session);
      useCollaborationStore.getState().removeParticipant('user-2');

      expect(useCollaborationStore.getState().getParticipants()).toHaveLength(0);
    });

    it('should update participant presence', () => {
      const session: CollaborationSession = {
        workspaceId: 'workspace-1',
        primaryOwnerId: 'user-1',
        participants: [
          {
            userId: 'user-2',
            accessLevel: 'edit',
            lastSeen: '2025-01-01T00:00:00Z',
          },
        ],
        isConnected: true,
        connectionStatus: 'connected',
      };

      useCollaborationStore.getState().setSession(session);
      useCollaborationStore.getState().updateParticipantPresence('user-2', { x: 100, y: 200 }, ['table-1']);

      const participant = useCollaborationStore.getState().getParticipant('user-2');
      expect(participant?.cursorPosition).toEqual({ x: 100, y: 200 });
      expect(participant?.selectedElements).toEqual(['table-1']);
    });
  });

  describe('conflict management', () => {
    it('should add conflict', () => {
      useCollaborationStore.getState().addConflict({
        elementType: 'table',
        elementId: 'table-1',
        message: 'Table has already been deleted',
        timestamp: '2025-01-01T00:00:00Z',
      });

      expect(useCollaborationStore.getState().conflicts).toHaveLength(1);
      expect(useCollaborationStore.getState().conflicts[0].message).toBe('Table has already been deleted');
    });

    it('should remove conflict', () => {
      useCollaborationStore.getState().addConflict({
        elementType: 'table',
        elementId: 'table-1',
        message: 'Conflict 1',
        timestamp: '2025-01-01T00:00:00Z',
      });

      const conflictId = useCollaborationStore.getState().conflicts[0].id;
      useCollaborationStore.getState().removeConflict(conflictId);

      expect(useCollaborationStore.getState().conflicts).toHaveLength(0);
    });

    it('should clear all conflicts', () => {
      useCollaborationStore.getState().addConflict({
        elementType: 'table',
        elementId: 'table-1',
        message: 'Conflict 1',
        timestamp: '2025-01-01T00:00:00Z',
      });
      useCollaborationStore.getState().addConflict({
        elementType: 'relationship',
        elementId: 'rel-1',
        message: 'Conflict 2',
        timestamp: '2025-01-01T00:00:00Z',
      });

      useCollaborationStore.getState().clearConflicts();

      expect(useCollaborationStore.getState().conflicts).toHaveLength(0);
    });
  });

  describe('access control', () => {
    it('should check if user is primary owner', () => {
      const session: CollaborationSession = {
        workspaceId: 'workspace-1',
        primaryOwnerId: 'user-1',
        participants: [
          {
            userId: 'user-1',
            accessLevel: 'edit',
            canvasOwnership: ['domain-1'],
            lastSeen: '2025-01-01T00:00:00Z',
          },
        ],
        isConnected: true,
        connectionStatus: 'connected',
      };

      useCollaborationStore.getState().setSession(session);

      expect(useCollaborationStore.getState().isPrimaryOwner('user-1', 'domain-1')).toBe(true);
      expect(useCollaborationStore.getState().isPrimaryOwner('user-1', 'domain-2')).toBe(false);
      expect(useCollaborationStore.getState().isPrimaryOwner('user-2', 'domain-1')).toBe(false);
    });

    it('should check edit access', () => {
      const session: CollaborationSession = {
        workspaceId: 'workspace-1',
        primaryOwnerId: 'user-1',
        participants: [
          {
            userId: 'user-1',
            accessLevel: 'edit',
            canvasOwnership: ['domain-1'],
            lastSeen: '2025-01-01T00:00:00Z',
          },
          {
            userId: 'user-2',
            accessLevel: 'edit',
            lastSeen: '2025-01-01T00:00:00Z',
          },
          {
            userId: 'user-3',
            accessLevel: 'read',
            lastSeen: '2025-01-01T00:00:00Z',
          },
        ],
        isConnected: true,
        connectionStatus: 'connected',
      };

      useCollaborationStore.getState().setSession(session);

      expect(useCollaborationStore.getState().hasEditAccess('user-1', 'domain-1')).toBe(true); // Primary owner
      expect(useCollaborationStore.getState().hasEditAccess('user-2', 'domain-1')).toBe(true); // Edit access
      expect(useCollaborationStore.getState().hasEditAccess('user-3', 'domain-1')).toBe(false); // Read only
    });
  });
});

