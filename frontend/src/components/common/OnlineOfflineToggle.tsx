/**
 * Online/Offline Mode Toggle Component
 * Allows users to manually switch between online and offline modes
 */

import React, { useState, useEffect } from 'react';
import { useSDKModeStore } from '@/services/sdk/sdkMode';
import { useAuth } from '@/components/auth/AuthProvider';
import { useUIStore } from '@/stores/uiStore';
import { HelpText } from './HelpText';
import { isElectron } from '@/services/platform/platform';
import { electronAuthService } from '@/services/api/electronAuthService';

export const OnlineOfflineToggle: React.FC = () => {
  const { mode, isManualOverride, setMode, checkOnlineMode } = useSDKModeStore();
  const { isAuthenticated, login } = useAuth();
  const { addToast } = useUIStore();
  const [isChecking, setIsChecking] = useState(false);

  // Check API availability when component mounts
  useEffect(() => {
    // Skip all API checks if manually set to offline mode
    if (isManualOverride && mode === 'offline') {
      return;
    }

    const checkAvailability = async () => {
      // Double-check manual override before making API call
      const currentState = useSDKModeStore.getState();
      if (currentState.isManualOverride && currentState.mode === 'offline') {
        return;
      }

      if (!currentState.isManualOverride) {
        setIsChecking(true);
        const isOnline = await checkOnlineMode();
        if (isOnline && mode === 'offline') {
          setMode('online', false);
        } else if (!isOnline && mode === 'online') {
          setMode('offline', false);
        }
        setIsChecking(false);
      }
    };

    // Only check if not manually set to offline
    if (!(isManualOverride && mode === 'offline')) {
      checkAvailability();
    }

    // Check periodically (every 30 seconds) - but skip if manually set to offline
    const interval = setInterval(() => {
      // Double-check manual override before making API call
      const currentState = useSDKModeStore.getState();
      if (!(currentState.isManualOverride && currentState.mode === 'offline')) {
        checkAvailability();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [mode, isManualOverride, checkOnlineMode, setMode]);

  const handleToggle = async () => {
    if (mode === 'offline') {
      // Switching to online mode - check API availability first
      setIsChecking(true);
      try {
        const isOnline = await checkOnlineMode();
        if (!isOnline) {
          addToast({
            type: 'error',
            message: 'Cannot switch to online mode: API server is not available',
          });
          setIsChecking(false);
          return;
        }

        // API is available - require authentication
        if (!isAuthenticated) {
          addToast({
            type: 'info',
            message: 'Authentication required for online mode',
          });

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
              setIsChecking(false);
              return;
            }
          } else {
            // Browser: Use web OAuth flow
            // Dynamically determine the frontend URL (origin only - API will append /auth/complete)
            const frontendOrigin = window.location.origin;

            // Use relative URL which will be proxied by Nginx in Docker
            // Pass only the origin - API will append /auth/complete to it
            window.location.href = `/api/v1/auth/github/login?redirect_uri=${encodeURIComponent(frontendOrigin)}`;
          }

          setIsChecking(false);
          return;
        }

        // Switch to online mode
        setMode('online', true);
        addToast({
          type: 'success',
          message: 'Switched to online mode',
        });
      } catch {
        addToast({
          type: 'error',
          message: 'Failed to check API availability',
        });
      } finally {
        setIsChecking(false);
      }
    } else {
      // Switching to offline mode - no auth required
      setMode('offline', true);
      addToast({
        type: 'info',
        message: 'Switched to offline mode. API calls disabled.',
      });
    }
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-700">Mode:</span>
        <button
          onClick={handleToggle}
          disabled={isChecking}
          className={`
            relative inline-flex h-6 w-11 items-center rounded-full transition-colors
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
            disabled:opacity-50 disabled:cursor-not-allowed
            ${mode === 'online' ? 'bg-blue-600' : 'bg-gray-300'}
          `}
          role="switch"
          aria-checked={mode === 'online'}
          aria-label={`Switch to ${mode === 'online' ? 'offline' : 'online'} mode`}
        >
          <span
            className={`
              inline-block h-4 w-4 transform rounded-full bg-white transition-transform
              ${mode === 'online' ? 'translate-x-6' : 'translate-x-1'}
            `}
          />
        </button>
        <span
          className={`text-sm font-medium ${mode === 'online' ? 'text-blue-600' : 'text-gray-600'}`}
        >
          {mode === 'online' ? 'Online' : 'Offline'}
        </span>
        {isChecking && <span className="text-xs text-gray-500">Checking...</span>}
        {!isAuthenticated && mode === 'offline' && (
          <span className="text-xs text-gray-500">(Auth not required)</span>
        )}
        {isAuthenticated && mode === 'online' && (
          <span className="text-xs text-green-600">(Authenticated)</span>
        )}
      </div>
      <HelpText
        text={
          mode === 'online'
            ? 'Online mode: Uses API server for collaboration and cloud storage. Authentication required.'
            : 'Offline mode: Works locally using WASM SDK. No authentication required. API calls are disabled.'
        }
        title="Mode Information"
      />
    </div>
  );
};
