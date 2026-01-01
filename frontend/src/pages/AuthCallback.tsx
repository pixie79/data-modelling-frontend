/**
 * OAuth Callback Handler
 * Handles GitHub OAuth callback and exchanges code for tokens
 */

import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/components/auth/AuthProvider';
import { useUIStore } from '@/stores/uiStore';
import { useSDKModeStore } from '@/services/sdk/sdkMode';

const AuthCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const { addToast } = useUIStore();
  const { setMode } = useSDKModeStore();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get the auth code from URL
        const code = searchParams.get('code');
        const error = searchParams.get('error');
        
        // Note: select_email parameter indicates user needs to select email
        // This is handled by the API, we just need to exchange the code

        // Check for error first
        if (error) {
          setStatus('error');
          setErrorMessage(error || 'Authentication failed');
          addToast({
            type: 'error',
            message: `Authentication failed: ${error}`,
          });
          setTimeout(() => navigate('/'), 3000);
          return;
        }

        // Check if we have a code
        if (!code) {
          setStatus('error');
          setErrorMessage('No authorization code received');
          addToast({
            type: 'error',
            message: 'No authorization code received',
          });
          setTimeout(() => navigate('/'), 3000);
          return;
        }

        // Exchange code for tokens
        const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8081';
        const response = await fetch(`${apiBaseUrl}/api/v1/auth/exchange`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ code }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(errorData.error || `Failed to exchange code: ${response.statusText}`);
        }

        const data = await response.json();
        
        // Login with tokens
        await login({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        });

        // Switch to online mode
        setMode('online', true);

        setStatus('success');
        addToast({
          type: 'success',
          message: 'Successfully authenticated!',
        });

        // Redirect to home page
        setTimeout(() => navigate('/'), 1500);
      } catch (error) {
        console.error('Auth callback error:', error);
        setStatus('error');
        setErrorMessage(error instanceof Error ? error.message : 'Unknown error');
        addToast({
          type: 'error',
          message: `Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
        setTimeout(() => navigate('/'), 3000);
      }
    };

    handleCallback();
  }, [searchParams, navigate, login, addToast, setMode]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
        {status === 'processing' && (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Completing Authentication</h2>
            <p className="text-gray-600">Please wait while we complete your login...</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="text-green-600 text-5xl mb-4">✓</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Authentication Successful</h2>
            <p className="text-gray-600">Redirecting you to the application...</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="text-red-600 text-5xl mb-4">✗</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Authentication Failed</h2>
            <p className="text-gray-600 mb-4">{errorMessage || 'An error occurred during authentication'}</p>
            <p className="text-sm text-gray-500">Redirecting you back to the home page...</p>
          </>
        )}
      </div>
    </div>
  );
};

export default AuthCallback;

