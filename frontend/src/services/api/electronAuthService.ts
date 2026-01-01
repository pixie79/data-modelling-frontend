/**
 * Electron-specific authentication service
 * Handles desktop OAuth flow with polling
 */

import { isElectron } from '@/services/platform/platform';
import type { AuthTokens } from './authService';

interface DesktopAuthInitResponse {
  state_id: string;
  auth_url: string;
}

interface PollAuthResponse {
  status: 'pending' | 'completed' | 'expired';
  code?: string;
  error?: string;
}

class ElectronAuthService {
  /**
   * Initiate desktop OAuth flow
   * Returns the auth URL to open in system browser
   */
  async initiateDesktopAuth(): Promise<{ stateId: string; authUrl: string }> {
    if (!isElectron()) {
      throw new Error('Desktop auth flow is only available in Electron');
    }

    // For desktop, we still need a callback URL for the API to redirect to
    // Use a custom protocol or localhost - the API will handle this differently for desktop
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8081';
    
    // For desktop OAuth, we can use a special redirect_uri or let the API handle it
    // The desktop flow uses polling, so the redirect_uri is less critical
    const response = await fetch(`${apiBaseUrl}/api/v1/auth/github/login/desktop`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to initiate desktop auth: ${response.statusText}`);
    }

    const data: DesktopAuthInitResponse = await response.json();
    return {
      stateId: data.state_id,
      authUrl: data.auth_url,
    };
  }

  /**
   * Poll for auth completion
   * Returns the auth code when completed
   */
  async pollAuthStatus(stateId: string, timeout: number = 300000): Promise<string> {
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8081';
    const startTime = Date.now();
    const pollInterval = 2000; // Poll every 2 seconds

    return new Promise((resolve, reject) => {
      const poll = async () => {
        try {
          const response = await fetch(`${apiBaseUrl}/api/v1/auth/poll/${stateId}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          });

          if (!response.ok) {
            if (response.status === 404) {
              reject(new Error('Auth state expired or not found'));
              return;
            }
            throw new Error(`Failed to poll auth status: ${response.statusText}`);
          }

          const data: PollAuthResponse = await response.json();

          if (data.status === 'completed' && data.code) {
            resolve(data.code);
            return;
          }

          if (data.status === 'expired' || data.error) {
            reject(new Error(data.error || 'Auth flow expired'));
            return;
          }

          // Check timeout
          if (Date.now() - startTime > timeout) {
            reject(new Error('Auth flow timed out'));
            return;
          }

          // Continue polling
          setTimeout(poll, pollInterval);
        } catch (error) {
          reject(error);
        }
      };

      // Start polling
      poll();
    });
  }

  /**
   * Exchange auth code for tokens
   */
  async exchangeCodeForTokens(code: string): Promise<AuthTokens> {
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8081';
    const response = await fetch(`${apiBaseUrl}/api/v1/auth/exchange`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code }),
    });

    if (!response.ok) {
      throw new Error(`Failed to exchange code: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      access_token_expires_at: data.access_token_expires_at,
      refresh_token_expires_at: data.refresh_token_expires_at,
      token_type: data.token_type || 'Bearer',
    };
  }

  /**
   * Complete desktop OAuth flow
   * 1. Initiate desktop auth
   * 2. Open auth URL in system browser
   * 3. Poll for completion
   * 4. Exchange code for tokens
   */
  async completeDesktopAuth(): Promise<AuthTokens> {
    // Step 1: Initiate desktop auth
    const { stateId, authUrl } = await this.initiateDesktopAuth();

    // Step 2: Open auth URL in system browser
    // In Electron, we need to use shell.openExternal
    if (typeof window !== 'undefined' && (window as any).electronAPI?.openExternal) {
      await (window as any).electronAPI.openExternal(authUrl);
    } else {
      // Fallback: open in current window (not ideal, but works)
      window.open(authUrl, '_blank');
    }

    // Step 3: Poll for completion
    const code = await this.pollAuthStatus(stateId);

    // Step 4: Exchange code for tokens
    return this.exchangeCodeForTokens(code);
  }
}

export const electronAuthService = new ElectronAuthService();

