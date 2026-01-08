import { BrowserRouter, HashRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { useEffect } from 'react';
import { AuthProvider } from './components/auth/AuthProvider';
import { ToastContainer } from './components/common/Toast';
import { GlobalLoading } from './components/common/Loading';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { useUIStore } from './stores/uiStore';
import { useSDKModeStore } from './services/sdk/sdkMode';
import { sdkLoader } from './services/sdk/sdkLoader';
import { getDuckDBService } from './services/database';
import { DUCKDB_CDN_URL } from './types/duckdb';
import { getPlatform } from './services/platform/platform';
import Home from './pages/Home';
import ModelEditor from './pages/ModelEditor';
import AuthCallback from './pages/AuthCallback';
import NotFound from './pages/NotFound';

// Use HashRouter for Electron (file:// protocol) and BrowserRouter for web
const Router =
  typeof window !== 'undefined' && window.location.protocol === 'file:'
    ? HashRouter
    : BrowserRouter;

// Create a client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

function App() {
  const { addToast } = useUIStore();
  const { mode, initialize } = useSDKModeStore();
  const [modeInitialized, setModeInitialized] = React.useState(false);

  // Initialize SDK mode first
  useEffect(() => {
    const initMode = async () => {
      await initialize();
      setModeInitialized(true);
    };
    initMode();
  }, [initialize]);

  // Check WASM availability and preload DuckDB on startup
  useEffect(() => {
    if (!modeInitialized) {
      return; // Wait for mode initialization
    }

    const initializeWASMDependencies = async () => {
      const isElectron = getPlatform() === 'electron';
      const currentMode = mode || 'offline'; // Default to offline if not set
      const isOffline = currentMode === 'offline';

      // === 1. SDK WASM Check (for offline mode) ===
      if (isElectron || isOffline) {
        try {
          await sdkLoader.load();
          const isActuallyLoaded = sdkLoader.isActuallyLoaded();

          if (!isActuallyLoaded) {
            addToast({
              type: 'error',
              message:
                'SDK WASM not loaded - offline functionality will be limited. Check that the SDK was downloaded during build.',
              duration: 15000,
            });
            console.error(
              '[App] SDK WASM not available - offline mode functionality will be limited'
            );
            console.error(
              '[App] For Cloudflare Pages: Check that cloudflare-build.sh downloaded the SDK from GitHub Releases'
            );
          } else {
            console.log('[App] SDK WASM loaded successfully');
          }
        } catch (error) {
          addToast({
            type: 'error',
            message: 'Failed to load SDK WASM - offline functionality will be limited.',
            duration: 15000,
          });
          console.error('[App] Failed to load SDK WASM:', error);
        }
      }

      // === 2. DuckDB-WASM Preload and Cache ===
      // Preload DuckDB-WASM early so it's ready when needed
      try {
        console.log('[App] Preloading DuckDB-WASM...');
        const duckdbService = getDuckDBService();
        const initResult = await duckdbService.initialize();

        if (initResult.success) {
          console.log(
            `[App] DuckDB-WASM initialized successfully (${initResult.storageMode} mode, version: ${initResult.version})`
          );
          if (!isElectron) {
            console.log(`[App] DuckDB-WASM loaded from CDN: ${DUCKDB_CDN_URL}`);
          }
        } else {
          throw new Error(initResult.error || 'DuckDB initialization failed');
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('[App] Failed to initialize DuckDB-WASM:', errorMessage);

        // Show user-friendly error
        addToast({
          type: 'warning',
          message: `DuckDB initialization failed: ${errorMessage}. Some database features may not work.`,
          duration: 10000,
        });

        // Log additional debugging info
        if (!isElectron) {
          console.error(`[App] DuckDB-WASM CDN URL: ${DUCKDB_CDN_URL}`);
          console.error('[App] Check browser console Network tab for failed requests');
          console.error('[App] Ensure Cross-Origin-Embedder-Policy headers are set correctly');
        }
      }
    };

    // Delay slightly to allow app to fully initialize
    const timeoutId = setTimeout(() => {
      initializeWASMDependencies();
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [addToast, mode, modeInitialized]);

  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        // Log to error reporting service in production
        if (import.meta.env.PROD) {
          // TODO: Integrate with error reporting service (e.g., Sentry, LogRocket)
          console.error('Application error:', error, errorInfo);
        }
      }}
    >
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Router>
            <div className="min-h-screen bg-gray-50">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/workspace/:workspaceId" element={<ModelEditor />} />
                <Route path="/auth/complete" element={<AuthCallback />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
              <ToastContainer />
              <GlobalLoading />
            </div>
          </Router>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
