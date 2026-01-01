/**
 * Unit tests for Workspace Store
 * Tests Zustand store state management for workspaces
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import type { Workspace } from '@/types/workspace';

describe('WorkspaceStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useWorkspaceStore.getState().setWorkspaces([]);
    useWorkspaceStore.getState().setCurrentWorkspace(null);
    useWorkspaceStore.getState().setError(null);
  });

  describe('setWorkspaces', () => {
    it('should set workspaces list', () => {
      const workspaces: Workspace[] = [
        {
          id: 'workspace-1',
          name: 'Test Workspace',
          type: 'personal',
          owner_id: 'user-1',
          created_at: '2025-01-01T00:00:00Z',
          last_modified_at: '2025-01-01T00:00:00Z',
        },
      ];

      useWorkspaceStore.getState().setWorkspaces(workspaces);
      expect(useWorkspaceStore.getState().workspaces).toEqual(workspaces);
    });
  });

  describe('setCurrentWorkspace', () => {
    it('should set the current workspace ID', () => {
      useWorkspaceStore.getState().setCurrentWorkspace('workspace-1');
      expect(useWorkspaceStore.getState().currentWorkspaceId).toBe('workspace-1');
    });

    it('should clear current workspace when set to null', () => {
      useWorkspaceStore.getState().setCurrentWorkspace('workspace-1');
      useWorkspaceStore.getState().setCurrentWorkspace(null);
      expect(useWorkspaceStore.getState().currentWorkspaceId).toBeNull();
    });
  });

  describe('addWorkspace', () => {
    it('should add a new workspace to the list', () => {
      const workspace: Workspace = {
        id: 'workspace-2',
        name: 'New Workspace',
        type: 'shared',
        owner_id: 'user-1',
        created_at: '2025-01-01T00:00:00Z',
        last_modified_at: '2025-01-01T00:00:00Z',
      };

      useWorkspaceStore.getState().addWorkspace(workspace);
      const workspaces = useWorkspaceStore.getState().workspaces;
      expect(workspaces).toHaveLength(1);
      expect(workspaces[0]).toEqual(workspace);
    });
  });

  describe('updateWorkspace', () => {
    it('should update an existing workspace', () => {
      const workspace: Workspace = {
        id: 'workspace-1',
        name: 'Original Name',
        type: 'personal',
        owner_id: 'user-1',
        created_at: '2025-01-01T00:00:00Z',
        last_modified_at: '2025-01-01T00:00:00Z',
      };

      useWorkspaceStore.getState().addWorkspace(workspace);
      useWorkspaceStore.getState().updateWorkspace('workspace-1', { name: 'Updated Name' });

      const updated = useWorkspaceStore.getState().workspaces.find((w) => w.id === 'workspace-1');
      expect(updated?.name).toBe('Updated Name');
    });

    it('should not update non-existent workspace', () => {
      useWorkspaceStore.getState().updateWorkspace('non-existent', { name: 'Test' });
      expect(useWorkspaceStore.getState().workspaces).toHaveLength(0);
    });
  });

  describe('removeWorkspace', () => {
    it('should remove a workspace from the list', () => {
      const workspace: Workspace = {
        id: 'workspace-1',
        name: 'Test Workspace',
        type: 'personal',
        owner_id: 'user-1',
        created_at: '2025-01-01T00:00:00Z',
        last_modified_at: '2025-01-01T00:00:00Z',
      };

      useWorkspaceStore.getState().addWorkspace(workspace);
      useWorkspaceStore.getState().setCurrentWorkspace('workspace-1');
      useWorkspaceStore.getState().removeWorkspace('workspace-1');

      expect(useWorkspaceStore.getState().workspaces).toHaveLength(0);
      expect(useWorkspaceStore.getState().currentWorkspaceId).toBeNull();
    });

    it('should not remove current workspace if ID does not match', () => {
      const workspace: Workspace = {
        id: 'workspace-1',
        name: 'Test Workspace',
        type: 'personal',
        owner_id: 'user-1',
        created_at: '2025-01-01T00:00:00Z',
        last_modified_at: '2025-01-01T00:00:00Z',
      };

      useWorkspaceStore.getState().addWorkspace(workspace);
      useWorkspaceStore.getState().setCurrentWorkspace('workspace-2');
      useWorkspaceStore.getState().removeWorkspace('workspace-1');

      expect(useWorkspaceStore.getState().workspaces).toHaveLength(0);
      expect(useWorkspaceStore.getState().currentWorkspaceId).toBe('workspace-2');
    });
  });

  describe('setLoading', () => {
    it('should set loading state', () => {
      useWorkspaceStore.getState().setLoading(true);
      expect(useWorkspaceStore.getState().isLoading).toBe(true);

      useWorkspaceStore.getState().setLoading(false);
      expect(useWorkspaceStore.getState().isLoading).toBe(false);
    });
  });

  describe('setError', () => {
    it('should set error message', () => {
      useWorkspaceStore.getState().setError('Test error');
      expect(useWorkspaceStore.getState().error).toBe('Test error');

      useWorkspaceStore.getState().setError(null);
      expect(useWorkspaceStore.getState().error).toBeNull();
    });
  });
});

