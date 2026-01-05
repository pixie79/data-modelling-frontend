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
import { getPlatform } from './services/platform/platform';
import Home from './pages/Home';
import ModelEditor from './pages/ModelEditor';
import AuthCallback from './pages/AuthCallback';
import NotFound from './pages/NotFound';

// Use HashRouter for Electron (file:// protocol) and BrowserRouter for web
const Router = typeof window !== 'undefined' && window.location.protocol === 'file:' 
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

  // Check WASM availability on startup (especially important for offline mode)
  useEffect(() => {
    if (!modeInitialized) {
      return; // Wait for mode initialization
    }

    const checkWASM = async () => {
      // Check WASM in Electron (always needed) or when in offline mode
      const isElectron = getPlatform() === 'electron';
      const currentMode = mode || 'offline'; // Default to offline if not set
      const isOffline = currentMode === 'offline';
      
      if (isElectron || isOffline) {
        // Try to load WASM to check if it's available
        try {
          await sdkLoader.load();
          const isActuallyLoaded = sdkLoader.isActuallyLoaded();
          
          if (!isActuallyLoaded) {
            // WASM failed to load - show warning
            addToast({
              type: 'error',
              message: 'WASM SDK not loaded - offline functionality will be limited. Please ensure WASM files are available in the wasm/ directory.',
              duration: 15000, // Show for 15 seconds
            });
            console.error('[App] WASM SDK not available - offline mode functionality will be limited');
            console.error('[App] Build instructions: cd ../data-modelling-sdk && wasm-pack build --target web --out-dir pkg --features wasm');
            console.error('[App] Then copy pkg/ contents to frontend/public/wasm/');
          } else {
            console.log('[App] WASM SDK loaded successfully');
          }
        } catch (error) {
          // WASM loading failed
          addToast({
            type: 'error',
            message: 'Failed to load WASM SDK - offline functionality will be limited. Some features may not work. Check console for details.',
            duration: 15000,
          });
          console.error('[App] Failed to load WASM SDK:', error);
          console.error('[App] Build instructions: cd ../data-modelling-sdk && wasm-pack build --target web --out-dir pkg --features wasm');
          console.error('[App] Then copy pkg/ contents to frontend/public/wasm/');
        }
      }
    };

    // Delay check slightly to allow app to fully initialize
    const timeoutId = setTimeout(() => {
      checkWASM();
    }, 500);

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
