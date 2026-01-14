/**
 * Home Page
 * Workspace selection and creation
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import packageJson from '../../package.json';
import { useAuth } from '@/components/auth/AuthProvider';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useSDKModeStore } from '@/services/sdk/sdkMode';
import { sdkModeDetector } from '@/services/sdk/sdkMode';
import { localFileService } from '@/services/storage/localFileService';
import { useUIStore } from '@/stores/uiStore';
import { isElectron, getAssetPath } from '@/services/platform/platform';
import { electronAuthService } from '@/services/api/electronAuthService';
import { WorkspaceList } from '@/components/workspace/WorkspaceList';
import { WorkspaceSelector } from '@/components/workspace/WorkspaceSelector';
import { workspaceService } from '@/services/api/workspaceService';
import { apiClient } from '@/services/api/apiClient';
import { authService } from '@/services/api/authService';
import {
  getAvailableExamples,
  loadExampleWorkspace,
  markExamplesLoaded,
  type ExampleWorkspaceInfo,
} from '@/services/exampleWorkspaces';

const Home: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, login } = useAuth();
  const {
    workspaces,
    setCurrentWorkspace,
    addWorkspace,
    fetchWorkspaces,
    isLoading: workspacesLoading,
    createWorkspace,
  } = useWorkspaceStore();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const { mode, initialize } = useSDKModeStore();
  const [modeLoading, setModeLoading] = useState(true);
  const [isCheckingLogin, setIsCheckingLogin] = useState(false);
  const [hasFetchedWorkspaces, setHasFetchedWorkspaces] = useState(false);
  const [selectedProfileEmail, setSelectedProfileEmail] = useState<string | null>(null);
  const [availableProfiles, setAvailableProfiles] = useState<
    Array<{ email: string; domains: string[] }>
  >([]);
  const [availableEmails, setAvailableEmails] = useState<string[]>([]);
  const [exampleWorkspaces, setExampleWorkspaces] = useState<ExampleWorkspaceInfo[]>([]);
  const [loadingExample, setLoadingExample] = useState<string | null>(null);
  const { addToast } = useUIStore();

  // Initialize mode on mount
  useEffect(() => {
    const initMode = async () => {
      await initialize();
      setModeLoading(false);
    };
    initMode();
  }, [initialize]);

  // Load example workspaces
  useEffect(() => {
    const loadExamples = async () => {
      try {
        const examples = await getAvailableExamples();
        setExampleWorkspaces(examples);
      } catch (error) {
        console.warn('Failed to load example workspaces:', error);
      }
    };
    loadExamples();
  }, []);

  // Load available emails from session when authenticated and online (only once)
  // This happens right after authentication, before workspace selection
  useEffect(() => {
    if (
      isAuthenticated &&
      mode === 'online' &&
      availableEmails.length === 0 &&
      !selectedProfileEmail
    ) {
      const loadEmails = async () => {
        try {
          // Get available emails from auth status (session)
          const emails = await authService.getAvailableEmails();
          if (emails && emails.length > 0) {
            setAvailableEmails(emails);
            // If only one email, auto-select it and proceed
            if (emails.length === 1 && emails[0]) {
              setSelectedProfileEmail(emails[0]);
            }
            // If multiple emails, show selection UI (don't proceed yet)
          } else {
            // No emails available, proceed normally
            setHasFetchedWorkspaces(true);
            fetchWorkspaces();
          }
        } catch (error) {
          console.error('Failed to load available emails:', error);
          // On error, proceed normally
          setHasFetchedWorkspaces(true);
          fetchWorkspaces();
        }
      };
      loadEmails();
    }
  }, [isAuthenticated, mode, availableEmails.length, selectedProfileEmail, fetchWorkspaces]);

  // Load profiles when email is selected (for workspace selection)
  useEffect(() => {
    if (
      isAuthenticated &&
      mode === 'online' &&
      selectedProfileEmail &&
      !hasFetchedWorkspaces &&
      !workspacesLoading &&
      availableProfiles.length === 0
    ) {
      const loadProfiles = async () => {
        try {
          const profiles = await workspaceService.listProfiles();
          if (profiles && profiles.length > 0) {
            setAvailableProfiles(profiles);
          }
          // Fetch workspaces after profiles are loaded
          setHasFetchedWorkspaces(true);
          fetchWorkspaces();
        } catch (error) {
          console.error('Failed to load profiles:', error);
          // On error, proceed normally
          setHasFetchedWorkspaces(true);
          fetchWorkspaces();
        }
      };
      loadProfiles();
    }
  }, [
    isAuthenticated,
    mode,
    selectedProfileEmail,
    hasFetchedWorkspaces,
    workspacesLoading,
    availableProfiles.length,
    fetchWorkspaces,
  ]);

  // When email is selected, proceed to workspace selection
  // This triggers profile loading and workspace fetching
  useEffect(() => {
    if (selectedProfileEmail && !hasFetchedWorkspaces && !workspacesLoading) {
      // Email is selected, now we can fetch workspaces
      // The profile loading effect will handle this
    }
  }, [selectedProfileEmail, hasFetchedWorkspaces, workspacesLoading]);

  // Show loading while checking mode and auth
  if (isLoading || modeLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Handle opening an example workspace
  const handleOpenExample = async (example: ExampleWorkspaceInfo) => {
    setLoadingExample(example.id);
    try {
      addToast({
        type: 'info',
        message: `Loading example: ${example.name}...`,
      });

      const workspace = await loadExampleWorkspace(example);

      // Pre-import all stores BEFORE populating data to avoid race conditions
      const [{ useModelStore }, { useKnowledgeStore }, { useDecisionStore }] = await Promise.all([
        import('@/stores/modelStore'),
        import('@/stores/knowledgeStore'),
        import('@/stores/decisionStore'),
      ]);

      const modelStore = useModelStore.getState();
      const knowledgeStore = useKnowledgeStore.getState();
      const decisionStore = useDecisionStore.getState();

      // Now populate all stores synchronously
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
        // Clear filter first to prevent stale domain_id filtering out new articles
        knowledgeStore.setFilter({});
        knowledgeStore.setArticles((workspace as any).knowledgeArticles);
      }
      if ((workspace as any).decisionRecords) {
        decisionStore.setDecisions((workspace as any).decisionRecords);
      }

      // Select first domain if available
      if ((workspace as any).domains && (workspace as any).domains.length > 0) {
        modelStore.setSelectedDomain((workspace as any).domains[0].id);
      }

      // Add workspace to store
      const existingWorkspace = workspaces.find((w) => w.id === workspace.id);
      if (!existingWorkspace) {
        addWorkspace(workspace);
      }

      setCurrentWorkspace(workspace.id);
      markExamplesLoaded();

      addToast({
        type: 'success',
        message: `Opened example: ${example.name}`,
      });

      navigate(`/workspace/${workspace.id}`);
    } catch (error) {
      console.error('Failed to open example workspace:', error);
      addToast({
        type: 'error',
        message: `Failed to open example: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    } finally {
      setLoadingExample(null);
    }
  };

  // Handle opening local workspace folder in offline mode
  const handleOpenLocalFolder = async () => {
    try {
      let files: FileList | File[] | null = null;
      let directoryHandle: FileSystemDirectoryHandle | null = null;

      // Try to use File System Access API for better sync support
      if ('showDirectoryPicker' in window) {
        try {
          directoryHandle = await (window as any).showDirectoryPicker({
            mode: 'readwrite',
            startIn: 'documents',
          });

          // Read files from the directory handle
          const { browserFileService } = await import('@/services/platform/browser');
          files = await browserFileService.readFilesFromHandle(directoryHandle!);
        } catch (error) {
          if ((error as Error).name === 'AbortError') {
            return; // User cancelled
          }
          console.warn('[Home] showDirectoryPicker failed, falling back to file input:', error);
          // Fall back to file input
          files = await localFileService.pickFolder();
        }
      } else {
        // Browser doesn't support File System Access API
        files = await localFileService.pickFolder();
      }

      if (!files || files.length === 0) {
        return; // User cancelled
      }

      addToast({
        type: 'info',
        message: 'Loading workspace from folder...',
      });

      // Convert File[] to FileList-like object if needed
      const fileList = Array.isArray(files)
        ? ({
            length: files.length,
            item: (index: number) => files[index] || null,
            [Symbol.iterator]: function* () {
              for (let i = 0; i < files.length; i++) {
                yield files[i];
              }
            },
          } as FileList)
        : files;

      const workspace = await localFileService.loadWorkspaceFromFolder(fileList);

      // Save directory handle for future sync (if we have one)
      if (directoryHandle && workspace.id) {
        const { browserFileService } = await import('@/services/platform/browser');
        await browserFileService.saveDirectoryHandle(workspace.id, directoryHandle);
        console.log('[Home] Saved directory handle for workspace:', workspace.id);
      }

      // Populate model store with loaded data
      const { useModelStore } = await import('@/stores/modelStore');
      const modelStore = useModelStore.getState();

      // Set domains
      if ((workspace as any).domains) {
        modelStore.setDomains((workspace as any).domains);
      }

      // Set tables
      if ((workspace as any).tables) {
        modelStore.setTables((workspace as any).tables);
      }

      // Set relationships
      if ((workspace as any).relationships) {
        modelStore.setRelationships((workspace as any).relationships);
      }

      // Set systems
      if ((workspace as any).systems) {
        modelStore.setSystems((workspace as any).systems);
      }

      // Set products
      if ((workspace as any).products) {
        modelStore.setProducts((workspace as any).products);
      }

      // Set assets
      if ((workspace as any).assets) {
        modelStore.setComputeAssets((workspace as any).assets);
      }

      // Set BPMN processes
      if ((workspace as any).bpmnProcesses) {
        modelStore.setBPMNProcesses((workspace as any).bpmnProcesses);
      }

      // Set DMN decisions
      if ((workspace as any).dmnDecisions) {
        modelStore.setDMNDecisions((workspace as any).dmnDecisions);
      }

      // Set knowledge articles
      if ((workspace as any).knowledgeArticles) {
        const { useKnowledgeStore } = await import('@/stores/knowledgeStore');
        console.log(
          '[Home] Setting knowledge articles:',
          (workspace as any).knowledgeArticles.length,
          'article(s)'
        );
        // Clear filter first to prevent stale domain_id filtering out new articles
        useKnowledgeStore.getState().setFilter({});
        useKnowledgeStore.getState().setArticles((workspace as any).knowledgeArticles);
      }

      // Set decision records (ADRs)
      if ((workspace as any).decisionRecords) {
        const { useDecisionStore } = await import('@/stores/decisionStore');
        console.log(
          '[Home] Setting decision records:',
          (workspace as any).decisionRecords.length,
          'record(s)'
        );
        useDecisionStore.getState().setDecisions((workspace as any).decisionRecords);
      }

      // Select first domain if available
      if ((workspace as any).domains && (workspace as any).domains.length > 0) {
        const firstDomainId = (workspace as any).domains[0].id;
        modelStore.setSelectedDomain(firstDomainId);
      }

      // Check for legacy structure using migration utilities
      const { detectLegacyStructure, getMigrationGuidance } = await import('@/utils/migration');
      const legacyStructure = detectLegacyStructure(workspace);
      const hasLegacyDataFlow = legacyStructure.hasLegacyDataFlow;
      const hasLegacyModelTypes = legacyStructure.hasLegacyModelTypes;

      // Add workspace to store if not already present
      const existingWorkspace = workspaces.find((w) => w.id === workspace.id);
      if (!existingWorkspace) {
        addWorkspace(workspace);
      }

      // Set as current workspace
      setCurrentWorkspace(workspace.id);

      // Show migration notice if legacy structure detected
      if (hasLegacyDataFlow || hasLegacyModelTypes) {
        const guidance = getMigrationGuidance(legacyStructure);
        addToast({
          type: 'warning',
          message: `Legacy workspace structure detected:\n\n${guidance}\n\nPlease use the migration wizard to reorganize your workspace.`,
          duration: 15000, // Show for 15 seconds
        });
      } else {
        addToast({
          type: 'success',
          message: `Opened workspace: ${workspace.name}`,
        });
      }

      // Navigate to workspace editor
      navigate(`/workspace/${workspace.id}`);
    } catch (error) {
      console.error('Failed to open local folder:', error);
      addToast({
        type: 'error',
        message: `Failed to open folder: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  };

  // In offline mode, skip authentication requirement
  if (mode === 'offline') {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow">
          <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-bold text-gray-900">Data Modelling Application</h1>
            </div>
            <p className="mt-2 text-sm text-gray-600">Offline Mode - Working locally without API</p>
          </div>
        </header>
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="mb-6 flex gap-4 items-center">
              <WorkspaceSelector />
              <button
                onClick={handleOpenLocalFolder}
                className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Open Workspace Folder
              </button>
              <button
                onClick={() => setShowCreateDialog(true)}
                className="bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                New Workspace
              </button>
            </div>

            {/* Workspace List */}
            <WorkspaceList
              onWorkspaceSelect={(workspaceId) => navigate(`/workspace/${workspaceId}`)}
            />

            {/* Example Workspaces */}
            {exampleWorkspaces.length > 0 && (
              <div className="mt-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Example Workspaces</h2>
                <p className="text-sm text-gray-600 mb-4">
                  Get started quickly with these pre-built example workspaces. Examples are
                  refreshed with each new release.
                </p>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {exampleWorkspaces.map((example) => (
                    <div
                      key={example.id}
                      className="bg-white rounded-lg border border-gray-200 p-4 hover:border-blue-500 hover:shadow-md transition-all"
                    >
                      <h3 className="text-lg font-medium text-gray-900 mb-2">{example.name}</h3>
                      <p className="text-sm text-gray-600 mb-3">{example.description}</p>
                      <div className="flex flex-wrap gap-1 mb-3">
                        {example.features.slice(0, 4).map((feature, idx) => (
                          <span
                            key={idx}
                            className="inline-block px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded"
                          >
                            {feature}
                          </span>
                        ))}
                      </div>
                      <button
                        onClick={() => handleOpenExample(example)}
                        disabled={loadingExample === example.id}
                        className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loadingExample === example.id ? (
                          <span className="flex items-center justify-center gap-2">
                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                                fill="none"
                              />
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                              />
                            </svg>
                            Loading...
                          </span>
                        ) : (
                          'Open Example'
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Version Footer */}
            <footer className="mt-12 pt-6 border-t border-gray-200 text-center text-sm text-gray-500">
              Version {packageJson.version}
            </footer>

            {/* Create Workspace Dialog for offline mode */}
            {showCreateDialog && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 max-w-md w-full">
                  <h2 className="text-xl font-bold mb-4">Create New Workspace</h2>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const formData = new FormData(e.target as HTMLFormElement);
                      const name = formData.get('name') as string;

                      try {
                        // Always use UUIDs for workspace IDs
                        const { generateUUID } = await import('@/utils/validation');
                        const workspace = {
                          id: generateUUID(),
                          name,
                          owner_id: 'offline-user',
                          created_at: new Date().toISOString(),
                          last_modified_at: new Date().toISOString(),
                        };
                        addWorkspace(workspace);
                        setShowCreateDialog(false);
                        navigate(`/workspace/${workspace.id}`);
                      } catch {
                        addToast({
                          type: 'error',
                          message: 'Failed to create workspace',
                        });
                      }
                    }}
                  >
                    <div className="mb-4">
                      <label
                        htmlFor="workspace-name-offline"
                        className="block text-sm font-medium text-gray-700 mb-2"
                      >
                        Workspace Name
                      </label>
                      <input
                        id="workspace-name-offline"
                        name="name"
                        type="text"
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowCreateDialog(false)}
                        className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        Create
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    );
  }

  // In online mode, require authentication
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Data Modelling Application</h1>
          <p className="text-gray-600 mb-6">
            Online mode requires authentication. Please log in to continue.
          </p>
          <button
            onClick={async (e) => {
              e.preventDefault();
              if (isCheckingLogin) return; // Prevent multiple clicks

              setIsCheckingLogin(true);

              try {
                // First check health endpoint
                const isOnline = await sdkModeDetector.checkOnlineMode();

                if (!isOnline) {
                  addToast({
                    type: 'error',
                    message:
                      'API server is not available. Please switch to offline mode or ensure the API server is running.',
                  });
                  setIsCheckingLogin(false);
                  return;
                }

                // Use desktop OAuth flow for Electron, web flow for browser
                if (isElectron()) {
                  try {
                    addToast({
                      type: 'info',
                      message: 'Opening GitHub authentication in your browser...',
                    });

                    // Use desktop OAuth flow
                    const tokens = await electronAuthService.completeDesktopAuth();

                    // Login with tokens
                    await login(tokens);

                    addToast({
                      type: 'success',
                      message: 'Successfully authenticated!',
                    });
                  } catch (authError) {
                    addToast({
                      type: 'error',
                      message: `Authentication failed: ${authError instanceof Error ? authError.message : 'Unknown error'}`,
                    });
                    console.error('Desktop auth failed:', authError);
                  } finally {
                    setIsCheckingLogin(false);
                  }
                } else {
                  // Browser: Use web OAuth flow
                  try {
                    // Dynamically determine the frontend URL (origin only - API will append /auth/complete)
                    const frontendOrigin = window.location.origin;

                    // Use relative URL which will be proxied by Nginx
                    // Pass only the origin - API will append /auth/complete to it
                    const authEndpoint = `/api/v1/auth/github/login?redirect_uri=${encodeURIComponent(frontendOrigin)}`;

                    const response = await fetch(authEndpoint, {
                      method: 'HEAD',
                      signal: AbortSignal.timeout(2000),
                      redirect: 'manual', // Don't follow redirects, just check if endpoint exists
                    });

                    // If we get a redirect (302/301), OK, or even 405 (method not allowed), the endpoint exists
                    if (
                      response.status === 302 ||
                      response.status === 301 ||
                      response.ok ||
                      response.status === 405
                    ) {
                      // Endpoint exists, proceed with login
                      window.location.href = authEndpoint;
                    } else if (response.status === 404) {
                      addToast({
                        type: 'error',
                        message:
                          'GitHub OAuth endpoint not found (404). Please check your API server configuration or switch to offline mode.',
                      });
                      setIsCheckingLogin(false);
                    } else {
                      // Other error - try anyway, might work
                      console.warn('Unexpected response from auth endpoint:', response.status);
                      window.location.href = authEndpoint;
                    }
                  } catch (fetchError) {
                    // Fetch failed - endpoint doesn't exist or server error
                    addToast({
                      type: 'error',
                      message:
                        'Cannot reach authentication endpoint. The API server may not be running or the endpoint is not configured. Please switch to offline mode or start the API server.',
                    });
                    console.error('Auth endpoint check failed:', fetchError);
                    setIsCheckingLogin(false);
                  }
                }
              } catch (error) {
                // Network error or timeout - API is likely not available
                addToast({
                  type: 'error',
                  message:
                    'Cannot connect to API server. Please switch to offline mode or ensure the API server is running.',
                });
                console.error('API check failed:', error);
                setIsCheckingLogin(false);
              }
            }}
            disabled={isCheckingLogin}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isCheckingLogin ? 'Checking API...' : 'Login with GitHub'}
          </button>
          <p className="mt-4 text-sm text-gray-500 text-center">
            Or switch to offline mode to work without authentication
          </p>
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
            <p className="font-semibold mb-1">API Server Required</p>
            <p className="text-xs">
              Make sure the API server is running on{' '}
              {import.meta.env.VITE_API_BASE_URL || 'http://localhost:8081'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show email alias selection if multiple email aliases available and none selected
  // Use emails from session (availableEmails) instead of profiles
  const shouldShowEmailSelection =
    isAuthenticated && availableEmails.length > 1 && !selectedProfileEmail;

  if (shouldShowEmailSelection) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Select Your Email Alias</h2>
          <p className="text-gray-600 mb-6">
            Please select which email alias you want to use for this session:
          </p>
          <div className="space-y-2">
            {availableEmails.map((email) => (
              <button
                key={email}
                onClick={async () => {
                  setSelectedProfileEmail(email);
                  // Call /auth/select-email to set the email for workspace operations
                  // Note: This endpoint may have authentication issues, so we proceed even if it fails
                  // The selected email is stored locally and will be used for workspace operations
                  try {
                    const token = apiClient.getAccessToken();
                    console.log(
                      '[Home] Calling select-email with token:',
                      token ? `Bearer ${token.substring(0, 20)}...` : 'NO TOKEN'
                    );
                    const response = await apiClient
                      .getClient()
                      .post('/api/v1/auth/select-email', { email });
                    console.log('[Home] select-email response:', response.status, response.data);
                  } catch (err: any) {
                    // API endpoint may have authentication issues - log but don't block user flow
                    console.warn(
                      '[Home] select-email endpoint returned error (this may be an API issue):',
                      err.response?.status,
                      err.response?.data || err.message
                    );
                    console.log('[Home] Continuing with locally selected email:', email);
                    // Store selected email in localStorage as fallback
                    localStorage.setItem('selected_email', email);
                  }
                }}
                className="w-full py-3 px-4 rounded-lg border-2 border-gray-200 bg-white text-gray-900 hover:border-blue-300 hover:bg-blue-50 transition-colors text-left"
              >
                <div className="font-medium">{email}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img
                src={getAssetPath('/logo.svg')}
                alt="Open Data Modelling"
                className="h-10 w-auto"
                style={{ maxHeight: '40px' }}
              />
              <h1 className="text-3xl font-bold text-gray-900">Open Data Modelling</h1>
            </div>
          </div>
          {selectedProfileEmail && (
            <p className="mt-2 text-sm text-gray-600">Using profile: {selectedProfileEmail}</p>
          )}
        </div>
      </header>
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="mb-6 flex gap-4 items-center">
            <WorkspaceSelector />
            <button
              onClick={() => setShowCreateDialog(true)}
              className="bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              New Workspace
            </button>
          </div>

          {/* Workspace List */}
          <WorkspaceList
            onWorkspaceSelect={(workspaceId) => navigate(`/workspace/${workspaceId}`)}
          />

          {/* Version Footer */}
          <footer className="mt-12 pt-6 border-t border-gray-200 text-center text-sm text-gray-500">
            Version {packageJson.version}
          </footer>

          {/* Create Workspace Dialog */}
          {showCreateDialog && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 max-w-md w-full">
                <h2 className="text-xl font-bold mb-4">Create New Workspace</h2>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const formData = new FormData(e.target as HTMLFormElement);
                    const name = formData.get('name') as string;

                    try {
                      const workspace = await createWorkspace({
                        name,
                      });
                      setShowCreateDialog(false);
                      navigate(`/workspace/${workspace.id}`);
                    } catch (error) {
                      console.error('Workspace creation error:', error);
                      const errorMessage =
                        error instanceof Error ? error.message : 'Failed to create workspace';
                      addToast({
                        type: 'error',
                        message: errorMessage,
                      });
                    }
                  }}
                >
                  <div className="mb-4">
                    <label
                      htmlFor="workspace-name"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      Workspace Name
                    </label>
                    <input
                      id="workspace-name"
                      name="name"
                      type="text"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowCreateDialog(false)}
                      className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Create
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Home;
