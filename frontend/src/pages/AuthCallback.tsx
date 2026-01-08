/**
 * OAuth Callback Handler
 * Handles GitHub OAuth callback and exchanges code for tokens
 */

import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/components/auth/AuthProvider';
import { useUIStore } from '@/stores/uiStore';
import { useSDKModeStore } from '@/services/sdk/sdkMode';

interface EmailOption {
  email: string;
  verified: boolean;
  primary: boolean;
}

const AuthCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const { addToast } = useUIStore();
  const { setMode } = useSDKModeStore();
  const [status, setStatus] = useState<'processing' | 'selecting-email' | 'success' | 'error'>(
    'processing'
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasProcessed, setHasProcessed] = useState(false);
  const [availableEmails, setAvailableEmails] = useState<EmailOption[]>([]);
  const [authCode, setAuthCode] = useState<string | null>(null);
  const [sessionCode, setSessionCode] = useState<string | null>(null); // Session code from API response

  useEffect(() => {
    // Prevent multiple executions
    if (hasProcessed) {
      return;
    }

    // Workaround: If we're on the API server's origin (wrong port), redirect to frontend
    // This happens when the API redirects to a relative URL instead of the full URL
    const currentOrigin = window.location.origin;
    const currentPath = window.location.pathname;
    const currentSearch = window.location.search;

    // Check if we're on the API server (port 8081) instead of the frontend (port 5173)
    if (currentOrigin.includes(':8081') && currentPath === '/auth/complete') {
      console.warn('[AuthCallback] Detected redirect to API server, redirecting to frontend...');
      const frontendOrigin = currentOrigin.replace(':8081', ':5173');
      window.location.href = `${frontendOrigin}${currentPath}${currentSearch}`;
      return;
    }

    const handleCallback = async () => {
      setHasProcessed(true);
      try {
        // Get the auth code from URL
        const code = searchParams.get('code');
        const error = searchParams.get('error');

        // Note: select_email=true in the URL is informational (GitHub required email selection)
        // The API auto-selects an email and proceeds with authentication
        // Email selection for workspace creation happens later via /auth/select-email endpoint

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
        // API 1.1.2+ design issue: Returns empty tokens with select_email=true but no session code
        // We'll do initial exchange and handle email selection in the response
        console.log('[AuthCallback] Exchanging code for tokens...');
        const response = await fetch('/api/v1/auth/exchange', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ code }),
        });

        console.log(
          '[AuthCallback] Exchange response status:',
          response.status,
          response.statusText
        );
        console.log(
          '[AuthCallback] Exchange response headers:',
          Object.fromEntries(response.headers.entries())
        );

        if (!response.ok) {
          let errorMessage = `Failed to exchange code: ${response.status} ${response.statusText}`;
          let errorData: any = null;
          try {
            const responseText = await response.text();
            console.log('[AuthCallback] Error response text:', responseText);
            errorData = JSON.parse(responseText);
            errorMessage = errorData.error || errorData.message || errorMessage;
          } catch {
            // If response is not JSON, use status text
            const text = await response.text().catch(() => '');
            if (text) {
              errorMessage = text;
            }
          }
          console.error('[AuthCallback] Exchange failed:', errorMessage, errorData);
          throw new Error(errorMessage);
        }

        const responseText = await response.text();
        console.log('[AuthCallback] Exchange response text:', responseText);

        let data: any;
        try {
          data = JSON.parse(responseText);
        } catch (parseError) {
          console.error('[AuthCallback] Failed to parse response as JSON:', parseError);
          throw new Error(
            `Invalid JSON response from authentication server: ${responseText.substring(0, 200)}`
          );
        }

        // Log the response for debugging
        console.log('[AuthCallback] Exchange response data:', {
          hasAccessToken: !!data.access_token,
          hasRefreshToken: !!data.refresh_token,
          hasAccessTokenCamel: !!data.accessToken,
          hasRefreshTokenCamel: !!data.refreshToken,
          allKeys: Object.keys(data),
          tokenKeys: Object.keys(data).filter((k) => k.toLowerCase().includes('token')),
        });

        // Check if email selection is required
        if (
          data.select_email === true &&
          data.emails &&
          Array.isArray(data.emails) &&
          data.emails.length > 0
        ) {
          console.log('[AuthCallback] Email selection required, showing email selection UI');

          // Check if API provided a session code (API 1.1.2+ should provide this)
          const sessionCodeValue = data.code || data.session_code || data.session_id;
          if (sessionCodeValue && typeof sessionCodeValue === 'string') {
            console.log('[AuthCallback] Found session code in response:', sessionCodeValue);
            setSessionCode(sessionCodeValue);
            setAuthCode(code); // Store OAuth code as backup
          } else {
            console.warn(
              '[AuthCallback] No session code found in response. API response keys:',
              Object.keys(data)
            );
            console.warn(
              '[AuthCallback] API 1.1.2+ should provide a session code for email selection.'
            );
            console.warn(
              '[AuthCallback] Without a session code, email selection may not work properly.'
            );

            // Store OAuth code - we'll try to use it, but it may already be consumed
            setAuthCode(code);

            // If there's only one email or a primary email, we could auto-select it
            // But the user explicitly requested email selection, so we should show the UI
            // The API design is broken - we can't select email without a session code
          }

          // Extract emails (handle both string and object formats)
          const emails: EmailOption[] = data.emails.map((email: string | EmailOption) => {
            if (typeof email === 'string') {
              return { email, verified: true, primary: false };
            }
            return email;
          });
          setAvailableEmails(emails);
          setStatus('selecting-email');
          return;
        }

        // Validate response has required fields
        // Check for both snake_case and camelCase variants
        const accessToken = data.access_token || data.accessToken;
        const refreshToken = data.refresh_token || data.refreshToken;

        if (!accessToken || !refreshToken) {
          console.error(
            '[AuthCallback] Invalid response structure - full data:',
            JSON.stringify(data, null, 2)
          );
          throw new Error(
            `Invalid response from authentication server: missing tokens. Response keys: ${Object.keys(data).join(', ')}. Response: ${JSON.stringify(data).substring(0, 500)}`
          );
        }

        // Login with tokens (handle both snake_case and camelCase)
        await login({
          access_token: accessToken,
          refresh_token: refreshToken,
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
  }, [searchParams, navigate, login, addToast, setMode, hasProcessed]);

  // Handle email selection
  const handleEmailSelection = async (selectedEmail: string) => {
    try {
      console.log('[AuthCallback] User selected email:', selectedEmail);

      // API 1.1.2+ provides a session code in the exchange response
      // Use session code if available, otherwise fall back to OAuth code
      const codeToUse = sessionCode || authCode;

      if (!codeToUse) {
        throw new Error('No code available for email selection');
      }

      console.log(
        '[AuthCallback] Using code for email selection:',
        codeToUse === sessionCode ? 'session code' : 'OAuth code'
      );

      // API 1.1.2+ should accept the session code for email selection
      // Try with session code in body first (API 1.1.2+ format)
      let selectResponse = await fetch('/api/v1/auth/select-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: selectedEmail,
          code: codeToUse, // Use session code or OAuth code
        }),
      });

      if (!selectResponse.ok) {
        // Try with code as query parameter (alternative format)
        console.log('[AuthCallback] Trying select-email with code as query parameter...');
        selectResponse = await fetch(
          `/api/v1/auth/select-email?code=${encodeURIComponent(codeToUse)}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: selectedEmail,
            }),
          }
        );
      }

      if (!selectResponse.ok) {
        const errorText = await selectResponse.text();
        console.error('[AuthCallback] select-email failed:', selectResponse.status, errorText);

        // If select-email fails, try to exchange with selected_email directly (API 1.1.2+ should support this)
        console.log('[AuthCallback] Attempting to exchange code with selected_email parameter...');
        const exchangeResponse = await fetch('/api/v1/auth/exchange', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            code: authCode, // Use original OAuth code
            selected_email: selectedEmail,
          }),
        });

        if (!exchangeResponse.ok) {
          const exchangeErrorText = await exchangeResponse.text();
          console.error(
            '[AuthCallback] Exchange with selected_email failed:',
            exchangeResponse.status,
            exchangeErrorText
          );
          throw new Error(
            `Failed to complete email selection: ${exchangeErrorText || selectResponse.statusText}`
          );
        }

        const exchangeData = await exchangeResponse.json();
        const accessToken = exchangeData.access_token || exchangeData.accessToken;
        const refreshToken = exchangeData.refresh_token || exchangeData.refreshToken;

        if (!accessToken || !refreshToken) {
          throw new Error('Invalid response from authentication server: missing tokens');
        }

        // Login with tokens
        await login({
          access_token: accessToken,
          refresh_token: refreshToken,
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
        return;
      }

      // If select-email succeeded, the API should return tokens or redirect us to get tokens
      const selectData = await selectResponse.json();
      console.log('[AuthCallback] select-email response:', selectData);

      // Check if select-email returned tokens directly (API 1.1.2+ might do this)
      const accessToken = selectData.access_token || selectData.accessToken;
      const refreshToken = selectData.refresh_token || selectData.refreshToken;

      if (accessToken && refreshToken) {
        // Login with tokens from select-email response
        await login({
          access_token: accessToken,
          refresh_token: refreshToken,
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
        return;
      }

      // If no tokens in select-email response, try to exchange again
      // API 1.1.2+ should allow re-exchange after email selection
      console.log('[AuthCallback] No tokens in select-email response, attempting exchange...');
      const exchangeResponse = await fetch('/api/v1/auth/exchange', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: authCode,
          selected_email: selectedEmail,
        }),
      });

      if (!exchangeResponse.ok) {
        const errorText = await exchangeResponse.text();
        throw new Error(
          `Failed to exchange code after email selection: ${errorText || exchangeResponse.statusText}`
        );
      }

      const exchangeData = await exchangeResponse.json();
      const finalAccessToken = exchangeData.access_token || exchangeData.accessToken;
      const finalRefreshToken = exchangeData.refresh_token || exchangeData.refreshToken;

      if (!finalAccessToken || !finalRefreshToken) {
        throw new Error('Invalid response from authentication server: missing tokens');
      }

      // Login with tokens
      await login({
        access_token: finalAccessToken,
        refresh_token: finalRefreshToken,
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
      console.error('[AuthCallback] Email selection error:', error);
      setStatus('error');
      setErrorMessage(
        error instanceof Error ? error.message : 'Failed to complete email selection'
      );
      addToast({
        type: 'error',
        message: `Email selection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  };

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
        {status === 'selecting-email' && (
          <>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Select Your Email</h2>
            <p className="text-gray-600 mb-6">
              Please select which email address you want to use for this session:
            </p>
            <div className="space-y-2">
              {availableEmails.map((emailOption) => (
                <button
                  key={emailOption.email}
                  onClick={() => handleEmailSelection(emailOption.email)}
                  className="w-full py-3 px-4 rounded-lg border-2 border-gray-200 bg-white text-gray-900 hover:border-blue-300 hover:bg-blue-50 transition-colors text-left"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{emailOption.email}</div>
                      {emailOption.primary && (
                        <span className="text-xs text-gray-500">Primary</span>
                      )}
                      {!emailOption.verified && (
                        <span className="text-xs text-orange-500 ml-2">Unverified</span>
                      )}
                    </div>
                    {emailOption.primary && (
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        Primary
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
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
            <p className="text-gray-600 mb-4">
              {errorMessage || 'An error occurred during authentication'}
            </p>
            {errorMessage &&
              (errorMessage.includes('API limitation') ||
                errorMessage.includes('API design issue')) && (
                <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-left">
                  <p className="text-sm text-yellow-800 font-semibold mb-2">
                    ⚠️ API Design Issue Detected
                  </p>
                  <p className="text-sm text-yellow-700 mb-2">
                    The API requires email selection but doesn&apos;t provide the necessary
                    endpoints or session codes.
                  </p>
                  <p className="text-sm text-yellow-700">
                    This is a known issue with API 1.1.2. Please report this to the API maintainers.
                  </p>
                </div>
              )}
            <p className="text-sm text-gray-500 mt-4">Redirecting you back to the home page...</p>
          </>
        )}
      </div>
    </div>
  );
};

export default AuthCallback;
