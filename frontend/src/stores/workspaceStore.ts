/**
 * Workspace Store
 * Manages workspace state using Zustand
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { workspaceService } from '@/services/api/workspaceService';
import { useSDKModeStore } from '@/services/sdk/sdkMode';
// import { localFileService } from '@/services/storage/localFileService';
import { getPlatform } from '@/services/platform/platform';
import axios from 'axios';
import type { Workspace } from '@/types/workspace';
import type { CreateWorkspaceRequest } from '@/types/api';

interface WorkspaceState {
  workspaces: Workspace[];
  currentWorkspaceId: string | null;
  isLoading: boolean;
  error: string | null;
  autoSaveInterval: number; // Auto-save interval in milliseconds (default: 5 minutes)
  autoSaveEnabled: boolean;
  pendingChanges: boolean; // Track if there are unsaved changes
  lastSavedAt: string | null; // ISO timestamp of last save

  // Actions
  setWorkspaces: (workspaces: Workspace[]) => void;
  setCurrentWorkspace: (workspaceId: string | null) => void;
  addWorkspace: (workspace: Workspace) => void;
  updateWorkspace: (workspaceId: string, updates: Partial<Workspace>) => void;
  removeWorkspace: (workspaceId: string) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  setAutoSaveInterval: (interval: number) => void;
  setAutoSaveEnabled: (enabled: boolean) => void;
  setPendingChanges: (pending: boolean) => void;
  markSaved: () => void;

  // CRUD Operations
  fetchWorkspaces: () => Promise<void>;
  fetchWorkspace: (workspaceId: string) => Promise<Workspace | null>;
  createWorkspace: (request: CreateWorkspaceRequest) => Promise<Workspace>;
  updateWorkspaceRemote: (workspaceId: string, updates: Partial<Workspace>) => Promise<Workspace>;
  deleteWorkspaceRemote: (workspaceId: string) => Promise<void>;

  // Auto-save
  autoSave: () => Promise<void>;
  manualSave: () => Promise<void>; // Manual save (same as autoSave but always shows feedback)
  startAutoSave: () => void;
  stopAutoSave: () => void;

  // Browser refresh handling
  handleBrowserRefresh: () => Promise<{ hasLocalChanges: boolean; hasRemoteChanges: boolean }>;

  // Disk sync
  reloadWorkspaceFromDisk: (workspaceId: string) => Promise<{
    success: boolean;
    reloaded: boolean; // true if loaded from disk, false if used cache
    error?: string;
  }>;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => {
      let autoSaveTimer: NodeJS.Timeout | null = null;

      return {
        workspaces: [],
        currentWorkspaceId: null,
        isLoading: false,
        error: null,
        autoSaveInterval: 5 * 60 * 1000, // 5 minutes default
        autoSaveEnabled: true,
        pendingChanges: false,
        lastSavedAt: null,

        setWorkspaces: (workspaces) => set({ workspaces }),
        setCurrentWorkspace: (workspaceId) => set({ currentWorkspaceId: workspaceId }),
        addWorkspace: (workspace) =>
          set((state) => ({
            workspaces: [...state.workspaces, workspace],
          })),
        updateWorkspace: (workspaceId, updates) =>
          set((state) => ({
            workspaces: state.workspaces.map((w) =>
              w.id === workspaceId ? { ...w, ...updates } : w
            ),
          })),
        removeWorkspace: (workspaceId) =>
          set((state) => ({
            workspaces: state.workspaces.filter((w) => w.id !== workspaceId),
            currentWorkspaceId:
              state.currentWorkspaceId === workspaceId ? null : state.currentWorkspaceId,
          })),
        setLoading: (isLoading) => set({ isLoading }),
        setError: (error) => set({ error }),
        setAutoSaveInterval: (interval) => {
          set({ autoSaveInterval: interval });
          // Restart auto-save with new interval
          get().stopAutoSave();
          if (get().autoSaveEnabled) {
            get().startAutoSave();
          }
        },
        setAutoSaveEnabled: (enabled) => {
          set({ autoSaveEnabled: enabled });
          if (enabled) {
            get().startAutoSave();
          } else {
            get().stopAutoSave();
          }
        },
        setPendingChanges: (pending) => set({ pendingChanges: pending }),
        markSaved: () => set({ pendingChanges: false, lastSavedAt: new Date().toISOString() }),

        // CRUD Operations
        fetchWorkspaces: async () => {
          set({ isLoading: true, error: null });
          try {
            const mode = useSDKModeStore.getState().mode;
            if (mode === 'offline') {
              // In offline mode, workspaces are local files, not fetched from API
              set({ workspaces: [], isLoading: false });
              return;
            }

            // Use the API endpoint: GET /workspace/profiles
            // This returns email/domain combinations (profiles)
            const profiles = await workspaceService.listProfiles();

            // Ensure profiles is an array
            if (!profiles || !Array.isArray(profiles)) {
              console.warn('Invalid profiles response:', profiles);
              set({ workspaces: [], isLoading: false });
              return;
            }

            // Convert profiles to workspace objects
            const workspaces: Workspace[] = profiles.flatMap((profile) => {
              // Ensure profile has required fields
              if (!profile || !profile.email || !Array.isArray(profile.domains)) {
                console.warn('Invalid profile structure:', profile);
                return [];
              }

              return profile.domains.map((domain) => ({
                id: `${profile.email}:${domain}`,
                name: `${profile.email} - ${domain}`,
                owner_id: profile.email,
                created_at: new Date().toISOString(),
                last_modified_at: new Date().toISOString(),
              }));
            });

            set({ workspaces, isLoading: false });
          } catch (error) {
            // If endpoint doesn't exist (404), return empty array instead of error
            if (axios.isAxiosError(error) && error.response?.status === 404) {
              console.warn(
                '/workspace/profiles endpoint not available - workspace management not supported'
              );
              set({ workspaces: [], isLoading: false });
            } else {
              set({
                error: error instanceof Error ? error.message : 'Failed to fetch workspaces',
                isLoading: false,
              });
              throw error;
            }
          }
        },

        fetchWorkspace: async (workspaceId: string) => {
          set({ isLoading: true, error: null });
          try {
            const info = await workspaceService.getWorkspaceInfo();
            const workspace = {
              id: workspaceId,
              name: info.email,
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
            const mode = useSDKModeStore.getState().mode;
            if (mode === 'offline') {
              // In offline mode, create workspace with default domain
              const modelStoreModule = await import('@/stores/modelStore');
              const { generateUUID, isValidUUID } = await import('@/utils/validation');

              // Generate workspace ID first
              const newWorkspaceId = generateUUID();

              // Create default domain with proper workspace_id
              // Ensure domain ID is always a valid UUID
              const domainId = generateUUID();
              if (!isValidUUID(domainId)) {
                throw new Error(`Failed to generate valid UUID for domain: ${domainId}`);
              }

              const defaultDomain = {
                id: domainId, // Domain ID must be a valid UUID
                workspace_id: newWorkspaceId, // Use the workspace ID, not a new UUID
                name: request.name || 'Default Domain',
                is_primary: true,
                created_at: new Date().toISOString(),
                last_modified_at: new Date().toISOString(),
              };

              // Validate domain ID before creating workspace
              if (!isValidUUID(defaultDomain.id)) {
                console.error(`[WorkspaceStore] Invalid domain ID created: ${defaultDomain.id}`);
                throw new Error(`Invalid domain ID: ${defaultDomain.id}`);
              }

              const newWorkspace: Workspace = {
                id: newWorkspaceId,
                name: request.name || 'Untitled Workspace',
                owner_id: 'offline-user',
                created_at: new Date().toISOString(),
                last_modified_at: new Date().toISOString(),
                domains: [defaultDomain],
              };

              // Validate workspace domain ID before setting
              if (
                newWorkspace.domains &&
                newWorkspace.domains[0] &&
                !isValidUUID(newWorkspace.domains[0].id)
              ) {
                console.error(
                  `[WorkspaceStore] Invalid domain ID in workspace: ${newWorkspace.domains[0].id}`
                );
                throw new Error(`Invalid domain ID in workspace: ${newWorkspace.domains[0].id}`);
              }

              modelStoreModule.useModelStore.getState().setDomains([defaultDomain]);
              set((state) => ({
                workspaces: [...state.workspaces, newWorkspace],
                currentWorkspaceId: newWorkspace.id,
                isLoading: false,
              }));

              console.log(
                `[WorkspaceStore] Created workspace with domain ID: ${defaultDomain.id} (isValidUUID: ${isValidUUID(defaultDomain.id)})`
              );
              return newWorkspace;
            }

            // API expects email and domain (not name and type)
            // Get user email from auth service or workspace info
            let userEmail: string | null = null;

            // Try to get email from auth service first
            try {
              const authServiceModule = await import('@/services/api/authService');
              const user = await authServiceModule.authService.getCurrentUser();
              console.log('[WorkspaceStore] Creating workspace - user from auth:', user);

              if (user && user.email) {
                userEmail = user.email;
              }
            } catch (authError) {
              console.warn('[WorkspaceStore] Failed to get user from auth service:', authError);
            }

            // If no email from auth, try to get it from workspace info
            if (!userEmail) {
              try {
                const workspaceInfo = await workspaceService.getWorkspaceInfo();
                console.log('[WorkspaceStore] Creating workspace - workspace info:', workspaceInfo);
                if (workspaceInfo && workspaceInfo.email) {
                  userEmail = workspaceInfo.email;
                }
              } catch (infoError) {
                console.warn(
                  '[WorkspaceStore] Failed to get email from workspace info:',
                  infoError
                );
              }
            }

            if (!userEmail) {
              const errorMsg =
                'User email not available. Please ensure you are authenticated and try again.';
              console.error('[WorkspaceStore]', errorMsg);
              set({
                error: errorMsg,
                isLoading: false,
              });
              throw new Error(errorMsg);
            }

            // Use the workspace name as the domain name
            // The API creates a workspace for email/domain combination
            const domain = request.name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
            console.log(
              '[WorkspaceStore] Creating workspace with email:',
              userEmail,
              'domain:',
              domain
            );

            let result;
            try {
              result = await workspaceService.createWorkspace(userEmail, domain);
              console.log('[WorkspaceStore] Workspace created successfully:', result);
            } catch (apiError) {
              console.error('[WorkspaceStore] API error creating workspace:', apiError);
              // Re-throw with more context
              if (axios.isAxiosError(apiError)) {
                const apiErrorMessage =
                  apiError.response?.data?.error ||
                  apiError.response?.data?.message ||
                  apiError.message ||
                  'API error creating workspace';
                throw new Error(
                  `API error: ${apiErrorMessage} (Status: ${apiError.response?.status})`
                );
              }
              throw apiError;
            }

            // Create workspace object from API response
            const workspace: Workspace = {
              id: `${result.email}:${result.domain}`,
              name: `${result.email} - ${result.domain}`,
              owner_id: result.email,
              created_at: new Date().toISOString(),
              last_modified_at: new Date().toISOString(),
            };

            set((state) => ({
              workspaces: [...state.workspaces, workspace],
              isLoading: false,
            }));
            return workspace;
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : 'Failed to create workspace';
            console.error('[WorkspaceStore] Workspace creation failed:', errorMessage, error);
            set({
              error: errorMessage,
              isLoading: false,
            });
            throw error;
          }
        },

        updateWorkspaceRemote: async (workspaceId: string, updates: Partial<Workspace>) => {
          // Workspace updates are not supported by the API (email-based workspaces)
          // Use local state update instead
          set((state) => ({
            workspaces: state.workspaces.map((w) =>
              w.id === workspaceId ? { ...w, ...updates } : w
            ),
            pendingChanges: true, // Mark as needing save
          }));
          return updates as Workspace;
        },

        deleteWorkspaceRemote: async (workspaceId: string) => {
          // In offline mode, handle domain-based file structure
          const mode = useSDKModeStore.getState().mode;
          if (mode === 'offline') {
            const workspace = get().workspaces.find((w) => w.id === workspaceId);
            if (workspace && workspace.domains) {
              // Clear domains from model store
              const modelStoreModule = await import('@/stores/modelStore');
              modelStoreModule.useModelStore.getState().setDomains([]);
              modelStoreModule.useModelStore.getState().setTables([]);
              modelStoreModule.useModelStore.getState().setRelationships([]);
            }
            // Remove from local state
            set((state) => ({
              workspaces: state.workspaces.filter((w) => w.id !== workspaceId),
              currentWorkspaceId:
                state.currentWorkspaceId === workspaceId ? null : state.currentWorkspaceId,
            }));
            return;
          }

          // Online mode - use API
          // Workspace deletion is not supported by the API (email-based workspaces)
          // Use local state update instead
          set((state) => ({
            workspaces: state.workspaces.filter((w) => w.id !== workspaceId),
            currentWorkspaceId:
              state.currentWorkspaceId === workspaceId ? null : state.currentWorkspaceId,
          }));
        },

        // Auto-save functionality
        autoSave: async () => {
          const state = get();
          if (!state.currentWorkspaceId || !state.pendingChanges) {
            return;
          }

          const workspace = state.workspaces.find((w) => w.id === state.currentWorkspaceId);
          if (!workspace) {
            return;
          }

          try {
            const mode = await useSDKModeStore.getState().getMode();
            const uiStoreModule = await import('@/stores/uiStore');

            if (mode === 'offline') {
              // Save domains to their folders in offline mode
              const modelStoreModule = await import('@/stores/modelStore');
              const {
                tables,
                relationships,
                domains,
                products,
                computeAssets,
                bpmnProcesses,
                dmnDecisions,
                systems,
              } = modelStoreModule.useModelStore.getState();

              if (getPlatform() === 'electron') {
                const electronFileServiceModule =
                  await import('@/services/storage/electronFileService');
                const electronPlatformModule = await import('@/services/platform/electron');
                const decisionStoreModule = await import('@/stores/decisionStore');
                const knowledgeStoreModule = await import('@/stores/knowledgeStore');

                // Determine workspace path from first domain or prompt
                let workspacePath: string | null = null;

                // Try to get workspace path from existing domains
                for (const domain of domains) {
                  if (domain.workspace_path) {
                    workspacePath = domain.workspace_path;
                    break;
                  }
                }

                // If no workspace path, prompt for one
                if (!workspacePath) {
                  const result = await electronPlatformModule.electronFileService.showOpenDialog({
                    properties: ['openDirectory'],
                    title: 'Select Workspace Folder for Auto-Save',
                  });

                  if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
                    // User cancelled - skip auto-save for this cycle
                    return;
                  }

                  workspacePath = result.filePaths[0] || null;

                  // Update all domains with workspace path
                  if (workspacePath) {
                    for (const d of domains) {
                      if (!d.workspace_path) {
                        modelStoreModule.useModelStore.getState().updateDomain(d.id, {
                          workspace_path: workspacePath,
                        });
                      }
                    }
                  }
                }

                if (workspacePath) {
                  try {
                    // Get KB articles and decision records
                    const { articles } = knowledgeStoreModule.useKnowledgeStore.getState();
                    const { decisions } = decisionStoreModule.useDecisionStore.getState();

                    // Save workspace in V2 format (flat files)
                    await electronFileServiceModule.electronFileService.saveWorkspaceV2(
                      workspacePath,
                      workspace,
                      domains,
                      tables,
                      systems,
                      relationships,
                      products,
                      computeAssets,
                      bpmnProcesses,
                      dmnDecisions,
                      articles,
                      decisions
                    );

                    set({ pendingChanges: false, lastSavedAt: new Date().toISOString() });
                    // Silent auto-save - don't show toast to avoid interrupting user
                  } catch (error) {
                    console.error('Failed to auto-save workspace:', error);
                  }
                }
              } else {
                // Browser: Use IndexedDB for auto-save
                try {
                  const { indexedDBStorage } = await import('@/services/storage/indexedDBStorage');
                  const { useModelStore } = await import('@/stores/modelStore');
                  const knowledgeStoreModule = await import('@/stores/knowledgeStore');
                  const decisionStoreModule = await import('@/stores/decisionStore');

                  // Get compute assets from model store
                  const { computeAssets } = useModelStore.getState();

                  // Get KB articles and decision records
                  const { articles } = knowledgeStoreModule.useKnowledgeStore.getState();
                  const { decisions } = decisionStoreModule.useDecisionStore.getState();

                  // Save workspace state to IndexedDB
                  await indexedDBStorage.saveWorkspace(
                    workspace.id,
                    workspace.name || workspace.id,
                    {
                      workspace,
                      domains,
                      tables,
                      relationships,
                      systems,
                      products,
                      assets: computeAssets,
                      bpmnProcesses,
                      dmnDecisions,
                      knowledgeArticles: articles,
                      decisionRecords: decisions,
                    }
                  );

                  // Try to save domain folders to disk if directory handle is cached
                  // This allows auto-save to persist to the same location selected during manual save
                  const { browserFileService } = await import('@/services/platform/browser');
                  const directoryHandle = browserFileService.getCachedDirectoryHandle(
                    workspace.name || workspace.id
                  );

                  if (directoryHandle) {
                    try {
                      // Verify directory handle is still valid by checking permissions
                      // Note: queryPermission may not be available in all browsers
                      let permissionStatus: PermissionState = 'prompt';
                      if (
                        'queryPermission' in directoryHandle &&
                        typeof directoryHandle.queryPermission === 'function'
                      ) {
                        permissionStatus = await (directoryHandle as any).queryPermission({
                          mode: 'readwrite',
                        });
                      } else {
                        // Try to access the directory to check permissions
                        try {
                          await directoryHandle.getDirectoryHandle('.', { create: false });
                          permissionStatus = 'granted';
                        } catch {
                          permissionStatus = 'prompt';
                        }
                      }

                      if (permissionStatus === 'granted') {
                        // Save workspace in V2 flat file format
                        const { WorkspaceV2Saver } =
                          await import('@/services/storage/workspaceV2Saver');
                        const decisionStoreModule = await import('@/stores/decisionStore');
                        const knowledgeStoreModule = await import('@/stores/knowledgeStore');

                        const { articles } = knowledgeStoreModule.useKnowledgeStore.getState();
                        const { decisions } = decisionStoreModule.useDecisionStore.getState();

                        // Generate V2 files
                        const files = await WorkspaceV2Saver.generateFiles(
                          workspace,
                          domains,
                          tables,
                          systems,
                          relationships,
                          products,
                          computeAssets,
                          bpmnProcesses,
                          dmnDecisions,
                          articles,
                          decisions
                        );

                        // Save using File System Access API
                        await WorkspaceV2Saver.saveWithFileSystemAPI(files, directoryHandle);

                        console.log(
                          '[WorkspaceStore] Auto-saved to disk in V2 format (directory handle cached)'
                        );
                      } else if (permissionStatus === 'prompt') {
                        // Permission was revoked - request again
                        console.log(
                          '[WorkspaceStore] Directory permission revoked, requesting again...'
                        );
                        const newHandle = await browserFileService.requestDirectoryAccess(
                          workspace.name || workspace.id
                        );
                        if (newHandle) {
                          // Retry save with new handle
                          // Note: This will be saved in the next auto-save cycle
                          console.log(
                            '[WorkspaceStore] Directory access re-granted, will save in next cycle'
                          );
                        }
                      } else {
                        // Permission denied - clear cached handle
                        console.warn(
                          '[WorkspaceStore] Directory permission denied, clearing cached handle'
                        );
                        // Note: We can't directly clear the cache from here, but it will be handled on next manual save
                      }
                    } catch (error) {
                      // Handle stale directory handle errors
                      console.warn(
                        '[WorkspaceStore] Failed to save to disk during auto-save:',
                        error
                      );
                      // Continue - IndexedDB save already succeeded
                    }
                  } else {
                    // No cached directory handle - auto-save only to IndexedDB
                    // User needs to manually save first to grant directory access
                    console.log(
                      '[WorkspaceStore] No cached directory handle - auto-save to IndexedDB only'
                    );
                  }

                  set({ pendingChanges: false, lastSavedAt: new Date().toISOString() });
                  console.log('[WorkspaceStore] Auto-saved to IndexedDB');
                } catch (error) {
                  console.error('[WorkspaceStore] Failed to auto-save to IndexedDB:', error);
                  // Still mark as saved to avoid repeated attempts
                  set({ pendingChanges: false, lastSavedAt: new Date().toISOString() });
                }
              }
            } else {
              // In online mode, sync to remote
              const syncModule = await import('@/services/sync/syncService');
              const sync = new syncModule.SyncService(workspace.id);
              const result = await sync.syncToRemote();
              if (result.success) {
                set({ pendingChanges: false, lastSavedAt: new Date().toISOString() });
                uiStoreModule.useUIStore.getState().addToast({
                  type: 'success',
                  message: 'Workspace synced to server',
                });
              } else {
                throw new Error(result.error || 'Sync failed');
              }
            }
          } catch (error) {
            console.error('Auto-save failed:', error);
            const uiStoreModule = await import('@/stores/uiStore');
            uiStoreModule.useUIStore.getState().addToast({
              type: 'error',
              message: `Auto-save failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            });
            // Don't throw - auto-save failures shouldn't interrupt user
          }
        },

        manualSave: async () => {
          // Manual save - always prompts for location in browser mode
          const state = get();
          if (!state.currentWorkspaceId) {
            const uiStoreModule = await import('@/stores/uiStore');
            uiStoreModule.useUIStore.getState().addToast({
              type: 'warning',
              message: 'No workspace selected. Please select a workspace first.',
            });
            return;
          }

          const workspace = state.workspaces.find((w) => w.id === state.currentWorkspaceId);
          if (!workspace) {
            const uiStoreModule = await import('@/stores/uiStore');
            uiStoreModule.useUIStore.getState().addToast({
              type: 'warning',
              message: 'Workspace not found.',
            });
            return;
          }

          const mode = await useSDKModeStore.getState().getMode();
          const platform = getPlatform();
          const uiStoreModule = await import('@/stores/uiStore');

          if (mode === 'offline' && platform === 'browser') {
            // Browser mode: Save in V2 flat file format
            try {
              const { localFileService } = await import('@/services/storage/localFileService');
              const modelStoreModule = await import('@/stores/modelStore');
              const decisionStoreModule = await import('@/stores/decisionStore');
              const knowledgeStoreModule = await import('@/stores/knowledgeStore');

              const {
                tables,
                relationships,
                domains,
                products,
                computeAssets,
                bpmnProcesses,
                dmnDecisions,
                systems,
              } = modelStoreModule.useModelStore.getState();

              const { articles } = knowledgeStoreModule.useKnowledgeStore.getState();
              const { decisions } = decisionStoreModule.useDecisionStore.getState();

              // Save workspace in V2 format (prompts for directory or falls back to ZIP)
              await localFileService.saveWorkspaceV2(
                workspace,
                domains,
                tables,
                systems,
                relationships,
                products,
                computeAssets,
                bpmnProcesses,
                dmnDecisions,
                articles,
                decisions
              );

              set({ pendingChanges: false, lastSavedAt: new Date().toISOString() });

              uiStoreModule.useUIStore.getState().addToast({
                type: 'success',
                message: `Saved workspace "${workspace.name}" with ${domains.length} domain(s) in V2 format`,
              });
            } catch (error) {
              console.error('Failed to manually save workspace:', error);
              uiStoreModule.useUIStore.getState().addToast({
                type: 'error',
                message: `Failed to save: ${error instanceof Error ? error.message : 'Unknown error'}`,
              });
            }
          } else {
            // Electron mode or online mode: Use existing autoSave logic
            // Force pendingChanges to true to ensure save happens
            set({ pendingChanges: true });

            // Call autoSave which will handle the actual save
            await get().autoSave();

            if (mode === 'offline' && platform === 'electron') {
              uiStoreModule.useUIStore.getState().addToast({
                type: 'success',
                message: 'Domains saved successfully',
              });
            } else if (mode === 'online') {
              uiStoreModule.useUIStore.getState().addToast({
                type: 'success',
                message: 'Workspace synced to server',
              });
            }
          }
        },

        startAutoSave: () => {
          const state = get();
          if (autoSaveTimer) {
            clearInterval(autoSaveTimer);
          }

          if (state.autoSaveEnabled && state.autoSaveInterval > 0) {
            autoSaveTimer = setInterval(() => {
              get().autoSave();
            }, state.autoSaveInterval);
          }
        },

        stopAutoSave: () => {
          if (autoSaveTimer) {
            clearInterval(autoSaveTimer);
            autoSaveTimer = null;
          }
        },

        // Workspace switching with state save/load
        switchWorkspace: async (workspaceId: string) => {
          const state = get();

          // Save current workspace state if there are pending changes
          if (state.pendingChanges && state.currentWorkspaceId) {
            await state.autoSave();
          }

          // Clear pending changes
          set({ pendingChanges: false });

          // Switch to new workspace
          set({ currentWorkspaceId: workspaceId });

          // Load new workspace data
          await get().fetchWorkspace(workspaceId);
        },

        // Browser refresh handling
        handleBrowserRefresh: async () => {
          const state = get();
          const mode = await useSDKModeStore.getState().getMode();

          const hasLocalChanges = state.pendingChanges;
          let hasRemoteChanges = false;

          if (mode === 'online' && state.currentWorkspaceId) {
            try {
              // Check if remote workspace has been modified
              await workspaceService.getWorkspaceInfo();
              const localWorkspace = state.workspaces.find(
                (w) => w.id === state.currentWorkspaceId
              );

              if (localWorkspace) {
                // Remote workspace info doesn't have last_modified_at, so assume no remote changes
                // In a real implementation, we'd fetch the full workspace to compare timestamps
                hasRemoteChanges = false;
              }
            } catch (error) {
              // If we can't check remote, assume no remote changes
              console.warn('Failed to check remote workspace:', error);
            }
          }

          return {
            hasLocalChanges,
            hasRemoteChanges,
          };
        },

        // Reload workspace from disk using persisted directory handle
        reloadWorkspaceFromDisk: async (workspaceId: string) => {
          const mode = await useSDKModeStore.getState().getMode();

          // Only works in offline mode
          if (mode !== 'offline') {
            return { success: true, reloaded: false };
          }

          // Only works in browser (not Electron - Electron has file paths)
          if (getPlatform() !== 'browser') {
            return { success: true, reloaded: false };
          }

          try {
            const { browserFileService } = await import('@/services/platform/browser');

            // Try to load persisted directory handle
            const handle = await browserFileService.loadDirectoryHandle(workspaceId);
            if (!handle) {
              console.log('[WorkspaceStore] No directory handle found for workspace:', workspaceId);
              return { success: true, reloaded: false };
            }

            // Verify permission
            const permission = await browserFileService.verifyDirectoryPermission(handle);
            if (permission === 'denied') {
              // Permission was explicitly denied - remove stale handle
              await browserFileService.removeDirectoryHandle(workspaceId);
              return {
                success: false,
                reloaded: false,
                error: 'Directory access denied. Please use "Open Workspace Folder" to reload.',
              };
            }

            if (permission === 'prompt') {
              // Permission needs to be re-requested
              const granted = await browserFileService.requestDirectoryPermission(handle);
              if (!granted) {
                return {
                  success: false,
                  reloaded: false,
                  error: 'Directory access required. Please use "Open Workspace Folder" to reload.',
                };
              }
            }

            // Read files from directory
            const files = await browserFileService.readFilesFromHandle(handle);
            if (files.length === 0) {
              return {
                success: false,
                reloaded: false,
                error: 'No files found in workspace directory.',
              };
            }

            // Create a FileList-like object from the files array
            const fileList = {
              length: files.length,
              item: (index: number) => files[index] || null,
              [Symbol.iterator]: function* () {
                for (let i = 0; i < files.length; i++) {
                  yield files[i];
                }
              },
            } as FileList;

            // Use localFileService to load the workspace
            const { localFileService } = await import('@/services/storage/localFileService');
            const workspace = await localFileService.loadWorkspaceFromFolder(fileList);

            // Populate model store with loaded data
            const { useModelStore } = await import('@/stores/modelStore');
            const modelStore = useModelStore.getState();

            if ((workspace as any).domains) {
              modelStore.setDomains((workspace as any).domains);
            }
            if ((workspace as any).tables) {
              modelStore.setTables((workspace as any).tables);
            }
            if ((workspace as any).relationships) {
              modelStore.setRelationships((workspace as any).relationships);
            }
            if ((workspace as any).systems) {
              modelStore.setSystems((workspace as any).systems);
            }
            if ((workspace as any).products) {
              modelStore.setProducts((workspace as any).products);
            }
            if ((workspace as any).assets) {
              modelStore.setComputeAssets((workspace as any).assets);
            }
            if ((workspace as any).bpmnProcesses) {
              modelStore.setBPMNProcesses((workspace as any).bpmnProcesses);
            }
            if ((workspace as any).dmnDecisions) {
              modelStore.setDMNDecisions((workspace as any).dmnDecisions);
            }
            if ((workspace as any).knowledgeArticles) {
              const { useKnowledgeStore } = await import('@/stores/knowledgeStore');
              useKnowledgeStore.getState().setArticles((workspace as any).knowledgeArticles);
            }
            if ((workspace as any).decisionRecords) {
              const { useDecisionStore } = await import('@/stores/decisionStore');
              useDecisionStore.getState().setDecisions((workspace as any).decisionRecords);
            }

            // Select first domain if available
            if ((workspace as any).domains && (workspace as any).domains.length > 0) {
              modelStore.setSelectedDomain((workspace as any).domains[0].id);
            }

            // Update workspace in store with fresh data
            set((state) => ({
              workspaces: state.workspaces.map((w) =>
                w.id === workspaceId ? { ...w, ...workspace, id: workspaceId } : w
              ),
            }));

            console.log('[WorkspaceStore] Reloaded workspace from disk:', workspaceId);
            return { success: true, reloaded: true };
          } catch (error) {
            console.error('[WorkspaceStore] Failed to reload workspace from disk:', error);
            return {
              success: false,
              reloaded: false,
              error: error instanceof Error ? error.message : 'Failed to reload from disk',
            };
          }
        },
      };
    },
    {
      name: 'workspace-storage',
      partialize: (state) => ({
        workspaces: state.workspaces,
        currentWorkspaceId: state.currentWorkspaceId,
        autoSaveInterval: state.autoSaveInterval,
        autoSaveEnabled: state.autoSaveEnabled,
        lastSavedAt: state.lastSavedAt,
      }),
      onRehydrateStorage: () => async (state, error) => {
        if (error) {
          console.error('[WorkspaceStore] Error rehydrating from storage:', error);
          return;
        }

        // Normalize domain IDs when loading from persisted state
        // This ensures old workspaces with non-UUID domain IDs are migrated to UUIDs
        if (state?.workspaces && Array.isArray(state.workspaces)) {
          const { generateUUID, isValidUUID } = await import('@/utils/validation');
          let needsUpdate = false;

          const normalizedWorkspaces = state.workspaces.map((workspace) => {
            if (!workspace.domains || !Array.isArray(workspace.domains)) {
              return workspace;
            }

            const normalizedDomains = workspace.domains.map((domain) => {
              // If domain ID is not a valid UUID, generate a new one
              if (!domain.id || !isValidUUID(domain.id)) {
                console.warn(
                  `[WorkspaceStore] Normalizing invalid domain ID "${domain.id}" to UUID for domain "${domain.name}"`
                );
                needsUpdate = true;
                return {
                  ...domain,
                  id: generateUUID(),
                };
              }
              return domain;
            });

            return {
              ...workspace,
              domains: normalizedDomains,
            };
          });

          // If any domains were normalized, update the state
          if (needsUpdate) {
            // Update state with normalized workspaces
            state.workspaces = normalizedWorkspaces;
            // Persist the normalized state back to storage
            const store = useWorkspaceStore.getState();
            store.setWorkspaces(normalizedWorkspaces);
          }
        }
      },
    }
  )
);
