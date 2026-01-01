/**
 * Home Page
 * Workspace selection and creation
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/components/auth/AuthProvider';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useSDKModeStore } from '@/services/sdk/sdkMode';
import { sdkModeDetector } from '@/services/sdk/sdkMode';
import { OnlineOfflineToggle } from '@/components/common/OnlineOfflineToggle';
import { localFileService } from '@/services/storage/localFileService';
import { useUIStore } from '@/stores/uiStore';
import { isElectron } from '@/services/platform/platform';
import { electronAuthService } from '@/services/api/electronAuthService';

const Home: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, login } = useAuth();
  const { workspaces, setCurrentWorkspace, addWorkspace } = useWorkspaceStore();
  const { mode, initialize } = useSDKModeStore();
  const [modeLoading, setModeLoading] = useState(true);
  const [isCheckingLogin, setIsCheckingLogin] = useState(false);
  const { addToast } = useUIStore();

  // Initialize mode on mount
  useEffect(() => {
    const initMode = async () => {
      await initialize();
      setModeLoading(false);
    };
    initMode();
  }, [initialize]);

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

  // Handle opening local workspace folder in offline mode
  const handleOpenLocalFolder = async () => {
    try {
      const files = await localFileService.pickFolder();
      if (!files || files.length === 0) {
        return; // User cancelled
      }

      addToast({
        type: 'info',
        message: 'Loading workspace from folder...',
      });

      const workspace = await localFileService.loadWorkspaceFromFolder(files);
      
      // Add workspace to store if not already present
      const existingWorkspace = workspaces.find((w) => w.id === workspace.id);
      if (!existingWorkspace) {
        addWorkspace(workspace);
      }
      
      // Set as current workspace
      setCurrentWorkspace(workspace.id);
      
      addToast({
        type: 'success',
        message: `Opened workspace: ${workspace.name}`,
      });

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
              <OnlineOfflineToggle />
            </div>
            <p className="mt-2 text-sm text-gray-600">Offline Mode - Working locally without API</p>
          </div>
        </header>
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="mb-6 flex gap-4">
              <button
                onClick={handleOpenLocalFolder}
                className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Open Workspace Folder
              </button>
              <button
                onClick={() => {
                  // Create a new empty workspace for offline use
                  const newWorkspaceId = `offline-${Date.now()}`;
                  navigate(`/workspace/${newWorkspaceId}`);
                }}
                className="bg-gray-600 text-white py-2 px-4 rounded hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                New Workspace
              </button>
            </div>
            <div className="text-center py-12">
              <p className="text-gray-600 mb-4">Offline mode active</p>
              <p className="text-sm text-gray-500 mb-2">
                Open a workspace folder containing domain subfolders.
              </p>
              <p className="text-xs text-gray-400">
                Expected structure: workspace-folder/domain-folder/tables.yaml and relationships.yaml
              </p>
            </div>
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
          <div className="mb-4">
            <OnlineOfflineToggle />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Data Modelling Application</h1>
          <p className="text-gray-600 mb-6">Online mode requires authentication. Please log in to continue.</p>
          <button
            onClick={async (e) => {
              e.preventDefault();
              if (isCheckingLogin) return; // Prevent multiple clicks
              
              setIsCheckingLogin(true);
              const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8081';
              
              try {
                // First check health endpoint
                const isOnline = await sdkModeDetector.checkOnlineMode();
                
                if (!isOnline) {
                  addToast({
                    type: 'error',
                    message: 'API server is not available. Please start the API server on ' + apiBaseUrl + ' or switch to offline mode.',
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
                    // Dynamically determine the frontend URL (origin + callback path)
                    const frontendOrigin = window.location.origin;
                    const callbackUrl = `${frontendOrigin}/auth/complete`;
                    
                    // Pass redirect_uri as query parameter so API knows where to redirect back
                    const authEndpoint = `${apiBaseUrl}/api/v1/auth/github/login?redirect_uri=${encodeURIComponent(callbackUrl)}`;
                    
                    const response = await fetch(authEndpoint, {
                      method: 'HEAD',
                      signal: AbortSignal.timeout(2000),
                      redirect: 'manual', // Don't follow redirects, just check if endpoint exists
                    });
                    
                    // If we get a redirect (302/301), OK, or even 405 (method not allowed), the endpoint exists
                    if (response.status === 302 || response.status === 301 || response.ok || response.status === 405) {
                      // Endpoint exists, proceed with login
                      window.location.href = authEndpoint;
                    } else if (response.status === 404) {
                      addToast({
                        type: 'error',
                        message: 'GitHub OAuth endpoint not found (404). Please check your API server configuration or switch to offline mode.',
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
                      message: 'Cannot reach authentication endpoint. The API server may not be running or the endpoint is not configured. Please switch to offline mode or start the API server.',
                    });
                    console.error('Auth endpoint check failed:', fetchError);
                    setIsCheckingLogin(false);
                  }
                }
              } catch (error) {
                // Network error or timeout - API is likely not available
                addToast({
                  type: 'error',
                  message: 'Cannot connect to API server. Please start the API server on ' + apiBaseUrl + ' or switch to offline mode.',
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
              Make sure the API server is running on {import.meta.env.VITE_API_BASE_URL || 'http://localhost:8081'}
            </p>
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
            <h1 className="text-3xl font-bold text-gray-900">Data Modelling Application</h1>
            <OnlineOfflineToggle />
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="mb-6">
            <button
              onClick={() => {
                // TODO: Implement workspace creation
                console.log('Create workspace');
              }}
              className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Create Workspace
            </button>
          </div>
          {workspaces.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600 mb-4">No workspaces found.</p>
              <p className="text-sm text-gray-500">Create your first workspace to get started.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {workspaces.map((workspace) => (
                <div
                  key={workspace.id}
                  onClick={() => navigate(`/workspace/${workspace.id}`)}
                  className="bg-white rounded-lg shadow p-6 cursor-pointer hover:shadow-lg transition-shadow"
                >
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{workspace.name}</h3>
                  <p className="text-sm text-gray-500">
                    {workspace.type === 'personal' ? 'Personal' : 'Shared'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Home;

