import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './components/auth/AuthProvider';
import { ToastContainer } from './components/common/Toast';
import { GlobalLoading } from './components/common/Loading';
import Home from './pages/Home';
import ModelEditor from './pages/ModelEditor';
import AuthCallback from './pages/AuthCallback';
import NotFound from './pages/NotFound';

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
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
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
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
