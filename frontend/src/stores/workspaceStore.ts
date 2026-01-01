/**
 * Workspace Store
 * Manages workspace state using Zustand
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { workspaceService } from '@/services/api/workspaceService';
import type { Workspace } from '@/types/workspace';
import type { CreateWorkspaceRequest } from '@/types/api';

interface WorkspaceState {
  workspaces: Workspace[];
  currentWorkspaceId: string | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  setWorkspaces: (workspaces: Workspace[]) => void;
  setCurrentWorkspace: (workspaceId: string | null) => void;
  addWorkspace: (workspace: Workspace) => void;
  updateWorkspace: (workspaceId: string, updates: Partial<Workspace>) => void;
  removeWorkspace: (workspaceId: string) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;

  // CRUD Operations
  fetchWorkspaces: () => Promise<void>;
  fetchWorkspace: (workspaceId: string) => Promise<Workspace | null>;
  createWorkspace: (request: CreateWorkspaceRequest) => Promise<Workspace>;
  updateWorkspaceRemote: (workspaceId: string, updates: Partial<Workspace>) => Promise<Workspace>;
  deleteWorkspaceRemote: (workspaceId: string) => Promise<void>;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      workspaces: [],
      currentWorkspaceId: null,
      isLoading: false,
      error: null,

      setWorkspaces: (workspaces) => set({ workspaces }),
      setCurrentWorkspace: (workspaceId) => set({ currentWorkspaceId: workspaceId }),
      addWorkspace: (workspace) =>
        set((state) => ({
          workspaces: [...state.workspaces, workspace],
        })),
      updateWorkspace: (workspaceId, updates) =>
        set((state) => ({
          workspaces: state.workspaces.map((w) => (w.id === workspaceId ? { ...w, ...updates } : w)),
        })),
      removeWorkspace: (workspaceId) =>
        set((state) => ({
          workspaces: state.workspaces.filter((w) => w.id !== workspaceId),
          currentWorkspaceId: state.currentWorkspaceId === workspaceId ? null : state.currentWorkspaceId,
        })),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),

      // CRUD Operations
      fetchWorkspaces: async () => {
        set({ isLoading: true, error: null });
        try {
          const profiles = await workspaceService.listProfiles();
          // Convert profiles to workspaces format (simplified for now)
          const workspaces = profiles.map((profile, index) => ({
            id: `workspace-${index}`,
            name: profile.email,
            type: 'personal' as const,
            owner_id: profile.email,
            created_at: new Date().toISOString(),
            last_modified_at: new Date().toISOString(),
          }));
          set({ workspaces, isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to fetch workspaces',
            isLoading: false,
          });
        }
      },

      fetchWorkspace: async (workspaceId: string) => {
        set({ isLoading: true, error: null });
        try {
          const info = await workspaceService.getWorkspaceInfo();
          const workspace = {
            id: workspaceId,
            name: info.email,
            type: 'personal' as const,
            owner_id: info.email,
            created_at: new Date().toISOString(),
            last_modified_at: new Date().toISOString(),
          };
          set((state) => {
            const existing = state.workspaces.find((w) => w.id === workspaceId);
            if (existing) {
              return {
                workspaces: state.workspaces.map((w) => (w.id === workspaceId ? workspace : w)),
                isLoading: false,
              };
            }
            return {
              workspaces: [...state.workspaces, workspace],
              isLoading: false,
            };
          });
          return workspace;
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to fetch workspace',
            isLoading: false,
          });
          return null;
        }
      },

      createWorkspace: async (request: CreateWorkspaceRequest) => {
        set({ isLoading: true, error: null });
        try {
          // API expects email and domain
          const email = request.name || 'user@example.com';
          const domain = 'default';
          const result = await workspaceService.createWorkspace(email, domain);
          const workspace = {
            id: result.workspace_path,
            name: email,
            type: 'personal' as const,
            owner_id: email,
            created_at: new Date().toISOString(),
            last_modified_at: new Date().toISOString(),
          };
          set((state) => ({
            workspaces: [...state.workspaces, workspace],
            isLoading: false,
          }));
          return workspace;
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to create workspace',
            isLoading: false,
          });
          throw error;
        }
      },

      updateWorkspaceRemote: async (workspaceId: string, updates: Partial<Workspace>) => {
        // Workspace updates are not supported by the API (email-based workspaces)
        // Use local state update instead
        set((state) => ({
          workspaces: state.workspaces.map((w) => (w.id === workspaceId ? { ...w, ...updates } : w)),
        }));
        return updates as Workspace;
      },

      deleteWorkspaceRemote: async (workspaceId: string) => {
        // Workspace deletion is not supported by the API (email-based workspaces)
        // Use local state update instead
        set((state) => ({
          workspaces: state.workspaces.filter((w) => w.id !== workspaceId),
          currentWorkspaceId: state.currentWorkspaceId === workspaceId ? null : state.currentWorkspaceId,
        }));
      },
    }),
    {
      name: 'workspace-storage',
      partialize: (state) => ({
        workspaces: state.workspaces,
        currentWorkspaceId: state.currentWorkspaceId,
      }),
    }
  )
);

