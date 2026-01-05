/**
 * Workspace Store
 * Manages workspace state using Zustand
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { workspaceService } from '@/services/api/workspaceService';
import { useSDKModeStore } from '@/services/sdk/sdkMode';
import { localFileService } from '@/services/storage/localFileService';
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
            workspaces: state.workspaces.map((w) => (w.id === workspaceId ? { ...w, ...updates } : w)),
          })),
        removeWorkspace: (workspaceId) =>
          set((state) => ({
            workspaces: state.workspaces.filter((w) => w.id !== workspaceId),
            currentWorkspaceId: state.currentWorkspaceId === workspaceId ? null : state.currentWorkspaceId,
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
              console.warn('/workspace/profiles endpoint not available - workspace management not supported');
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
              const { generateUUID } = await import('@/utils/validation');
              const defaultDomain = {
                id: generateUUID(),
                workspace_id: generateUUID(),
                name: request.name || 'Default Domain',
                is_primary: true,
                created_at: new Date().toISOString(),
                last_modified_at: new Date().toISOString(),
              };
              
              const newWorkspace: Workspace = {
                id: generateUUID(),
                name: request.name || 'Untitled Workspace',
                owner_id: 'offline-user',
                created_at: new Date().toISOString(),
                last_modified_at: new Date().toISOString(),
                domains: [defaultDomain],
              };
              
              modelStoreModule.useModelStore.getState().setDomains([defaultDomain]);
              set((state) => ({
                workspaces: [...state.workspaces, newWorkspace],
                currentWorkspaceId: newWorkspace.id,
                isLoading: false,
              }));
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
                console.warn('[WorkspaceStore] Failed to get email from workspace info:', infoError);
              }
            }
            
            if (!userEmail) {
              const errorMsg = 'User email not available. Please ensure you are authenticated and try again.';
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
            console.log('[WorkspaceStore] Creating workspace with email:', userEmail, 'domain:', domain);
            
            let result;
            try {
              result = await workspaceService.createWorkspace(userEmail, domain);
              console.log('[WorkspaceStore] Workspace created successfully:', result);
            } catch (apiError) {
              console.error('[WorkspaceStore] API error creating workspace:', apiError);
              // Re-throw with more context
              if (axios.isAxiosError(apiError)) {
                const apiErrorMessage = apiError.response?.data?.error || 
                                        apiError.response?.data?.message || 
                                        apiError.message || 
                                        'API error creating workspace';
                throw new Error(`API error: ${apiErrorMessage} (Status: ${apiError.response?.status})`);
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
            const errorMessage = error instanceof Error ? error.message : 'Failed to create workspace';
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
            workspaces: state.workspaces.map((w) => (w.id === workspaceId ? { ...w, ...updates } : w)),
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
              currentWorkspaceId: state.currentWorkspaceId === workspaceId ? null : state.currentWorkspaceId,
            }));
            return;
          }
          
          // Online mode - use API
          // Workspace deletion is not supported by the API (email-based workspaces)
          // Use local state update instead
          set((state) => ({
            workspaces: state.workspaces.filter((w) => w.id !== workspaceId),
            currentWorkspaceId: state.currentWorkspaceId === workspaceId ? null : state.currentWorkspaceId,
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
              const { tables, relationships, domains, products, computeAssets, bpmnProcesses, dmnDecisions, systems } = modelStoreModule.useModelStore.getState();
              
              if (getPlatform() === 'electron') {
                const electronFileServiceModule = await import('@/services/storage/electronFileService');
                const electronPlatformModule = await import('@/services/platform/electron');
                
                // Save each domain to its folder
                let allDomainsSaved = true;
                let needsWorkspacePath = false;
                let workspacePath: string | null = null;
                
                for (const domain of domains) {
                  // Determine domain folder path
                  let domainPath: string | null = null;
                  
                  if (domain.folder_path) {
                    // Use stored folder path
                    domainPath = domain.folder_path;
                  } else if (domain.workspace_path) {
                    // Use workspace path + domain name
                    domainPath = `${domain.workspace_path}/${domain.name}`;
                  } else {
                    // Need to prompt for workspace path (only once)
                    if (!workspacePath) {
                      needsWorkspacePath = true;
                      const result = await electronPlatformModule.electronFileService.showOpenDialog({
                        properties: ['openDirectory'],
                        title: 'Select Workspace Folder for Auto-Save',
                        message: 'Select the workspace folder where domains should be saved. This will be remembered for future auto-saves.',
                      });
                      
                      if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
                        // User cancelled - skip auto-save for this cycle
                        allDomainsSaved = false;
                        break;
                      }
                      
                      workspacePath = result.filePaths[0];
                      
                      // Update all domains with workspace path
                      for (const d of domains) {
                        if (!d.workspace_path) {
                          modelStoreModule.useModelStore.getState().updateDomain(d.id, {
                            workspace_path: workspacePath,
                            folder_path: `${workspacePath}/${d.name}`,
                          });
                        }
                      }
                    }
                    
                    domainPath = `${workspacePath}/${domain.name}`;
                  }
                  
                  if (domainPath) {
                    try {
                      // Get all domain assets
                      const domainTables = tables.filter((t) => t.domain_id === domain.id || t.primary_domain_id === domain.id);
                      const domainProducts = products.filter((p) => p.domain_id === domain.id);
                      const domainAssets = computeAssets.filter((a) => a.domain_id === domain.id);
                      const domainBpmnProcesses = bpmnProcesses.filter((p) => p.domain_id === domain.id);
                      const domainDmnDecisions = dmnDecisions.filter((d) => d.domain_id === domain.id);
                      const domainSystems = systems.filter((s) => s.domain_id === domain.id);
                      const domainRelationships = relationships.filter((r) => r.domain_id === domain.id);
                      
                      // Convert domain to DomainType format
                      const domainType = {
                        id: domain.id,
                        workspace_id: domain.workspace_id || '',
                        name: domain.name,
                        description: domain.description,
                        owner: domain.owner,
                        model_type: domain.model_type || 'conceptual',
                        is_primary: domain.is_primary || false,
                        created_at: domain.created_at,
                        last_modified_at: new Date().toISOString(),
                      } as any;
                      
                      // Save domain folder
                      await electronFileServiceModule.electronFileService.saveDomainFolder(
                        domainPath,
                        domainType,
                        domainTables,
                        domainProducts,
                        domainAssets,
                        domainBpmnProcesses,
                        domainDmnDecisions,
                        domainSystems,
                        domainRelationships
                      );
                    } catch (error) {
                      console.error(`Failed to auto-save domain ${domain.name}:`, error);
                      allDomainsSaved = false;
                    }
                  }
                  
                  // Save workspace.yaml with all domain IDs after saving all domains
                  if (allDomainsSaved && workspacePath && workspace.id) {
                    try {
                      const workspaceMetadata = {
                        id: workspace.id,
                        name: workspace.name || workspace.id,
                        created_at: workspace.created_at || new Date().toISOString(),
                        last_modified_at: new Date().toISOString(),
                        domains: domains.map(d => ({
                          id: d.id,
                          name: d.name,
                        })),
                      };
                      await electronFileServiceModule.electronFileService.saveWorkspaceMetadata(workspacePath, workspaceMetadata);
                    } catch (error) {
                      console.error(`Failed to save workspace.yaml:`, error);
                      // Don't fail auto-save if workspace.yaml save fails
                    }
                  }
                }
                
                if (allDomainsSaved && domains.length > 0) {
                  set({ pendingChanges: false, lastSavedAt: new Date().toISOString() });
                  // Silent auto-save - don't show toast to avoid interrupting user
                } else if (domains.length === 0) {
                  // No domains to save - just mark as saved
                  set({ pendingChanges: false, lastSavedAt: new Date().toISOString() });
                }
              } else {
                // Browser: Use IndexedDB for auto-save
                try {
                  const { indexedDBStorage } = await import('@/services/storage/indexedDBStorage');
                  const { localFileService } = await import('@/services/storage/localFileService');
                  
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
                      assets,
                      bpmnProcesses,
                      dmnDecisions,
                    }
                  );
                  
                  // Try to save domain folders to disk if directory handle is cached
                  // This allows auto-save to persist to the same location selected during manual save
                  const { browserFileService } = await import('@/services/platform/browser');
                  const directoryHandle = browserFileService.getCachedDirectoryHandle(workspace.name || workspace.id);
                  
                  if (directoryHandle) {
                    try {
                      // Verify directory handle is still valid by checking permissions
                      const permissionStatus = await directoryHandle.queryPermission({ mode: 'readwrite' });
                      
                      if (permissionStatus === 'granted') {
                        // Save each domain folder using File System Access API
                        for (const domain of domains) {
                          const domainTables = tables.filter(t => t.primary_domain_id === domain.id);
                          const domainProducts = products.filter(p => p.domain_id === domain.id);
                          const domainAssets = assets.filter(a => a.primary_domain_id === domain.id);
                          const domainBpmn = bpmnProcesses.filter(p => p.primary_domain_id === domain.id);
                          const domainDmn = dmnDecisions.filter(d => d.primary_domain_id === domain.id);
                          const domainSystems = systems.filter(s => s.domain_id === domain.id);
                          const domainRelationships = relationships.filter(r => r.domain_id === domain.id);
                          
                          await localFileService.saveDomainFolder(
                            workspace.name || workspace.id,
                            domain,
                            domainTables,
                            domainProducts,
                            domainAssets,
                            domainBpmn,
                            domainDmn,
                            domainSystems,
                            domainRelationships
                          );
                        }
                        
                        // Save workspace.yaml
                        const workspaceMetadata = {
                          id: workspace.id,
                          name: workspace.name || workspace.id,
                          created_at: workspace.created_at || new Date().toISOString(),
                          last_modified_at: new Date().toISOString(),
                          domains: domains.map(d => ({ id: d.id, name: d.name })),
                        };
                        await localFileService.saveWorkspaceMetadata(workspace.name || workspace.id, workspaceMetadata);
                        
                        console.log('[WorkspaceStore] Auto-saved to disk (directory handle cached)');
                      } else if (permissionStatus === 'prompt') {
                        // Permission was revoked - request again
                        console.log('[WorkspaceStore] Directory permission revoked, requesting again...');
                        const newHandle = await browserFileService.requestDirectoryAccess(workspace.name || workspace.id);
                        if (newHandle) {
                          // Retry save with new handle
                          // Note: This will be saved in the next auto-save cycle
                          console.log('[WorkspaceStore] Directory access re-granted, will save in next cycle');
                        }
                      } else {
                        // Permission denied - clear cached handle
                        console.warn('[WorkspaceStore] Directory permission denied, clearing cached handle');
                        // Note: We can't directly clear the cache from here, but it will be handled on next manual save
                      }
                    } catch (error) {
                      // Handle stale directory handle errors
                      console.warn('[WorkspaceStore] Failed to save to disk during auto-save:', error);
                      // Continue - IndexedDB save already succeeded
                    }
                  } else {
                    // No cached directory handle - auto-save only to IndexedDB
                    // User needs to manually save first to grant directory access
                    console.log('[WorkspaceStore] No cached directory handle - auto-save to IndexedDB only');
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
            // Browser mode: Always prompt for directory access
            try {
              const { browserFileService } = await import('@/services/platform/browser');
              const { localFileService } = await import('@/services/storage/localFileService');
              const modelStoreModule = await import('@/stores/modelStore');
              const { tables, relationships, domains, products, computeAssets, bpmnProcesses, dmnDecisions, systems } = modelStoreModule.useModelStore.getState();
              
              // Always request directory access (prompt user)
              const directoryHandle = await browserFileService.requestDirectoryAccess(workspace.name || workspace.id);
              
              if (!directoryHandle) {
                // User cancelled - offer ZIP download instead
                const useZip = window.confirm(
                  'Directory access was cancelled. Would you like to download a ZIP file with all domains instead?'
                );
                
                if (!useZip) {
                  return;
                }
                // Note: Directory handle is not cached if user cancels, so auto-save will use IndexedDB only
              }
              // Directory handle is automatically cached by requestDirectoryAccess if granted
              // This allows auto-save to use the same directory in future saves

              // Save each domain
              for (const domain of domains) {
                const domainTables = tables.filter(t => t.primary_domain_id === domain.id);
                const domainProducts = products.filter(p => p.domain_id === domain.id);
                const domainAssets = computeAssets.filter(a => a.primary_domain_id === domain.id);
                const domainBpmn = bpmnProcesses.filter(p => p.primary_domain_id === domain.id);
                const domainDmn = dmnDecisions.filter(d => d.primary_domain_id === domain.id);
                const domainSystems = systems.filter(s => s.domain_id === domain.id);
                const domainRelationships = relationships.filter(r => r.domain_id === domain.id);

                await localFileService.saveDomainFolder(
                  workspace.name || workspace.id,
                  domain,
                  domainTables,
                  domainProducts,
                  domainAssets,
                  domainBpmn,
                  domainDmn,
                  domainSystems,
                  domainRelationships
                );
              }

              // Save workspace.yaml if we have directory access
              if (directoryHandle) {
                const workspaceMetadata = {
                  id: workspace.id,
                  name: workspace.name || workspace.id,
                  created_at: workspace.created_at || new Date().toISOString(),
                  last_modified_at: new Date().toISOString(),
                  domains: domains.map(d => ({ id: d.id, name: d.name })),
                };
                await localFileService.saveWorkspaceMetadata(workspace.name || workspace.id, workspaceMetadata);
              }

              set({ pendingChanges: false, lastSavedAt: new Date().toISOString() });
              
              uiStoreModule.useUIStore.getState().addToast({
                type: 'success',
                message: directoryHandle
                  ? `Saved all ${domains.length} domain(s) to directory`
                  : `Downloaded all ${domains.length} domain(s) as ZIP files`,
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
              const localWorkspace = state.workspaces.find((w) => w.id === state.currentWorkspaceId);
              
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
    }
  )
);
