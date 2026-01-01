/**
 * Authentication service
 * Handles login, logout, and token management
 */

import { apiClient } from './apiClient';
import type { RefreshTokenRequest, RefreshTokenResponse } from '@/types/api';

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  access_token_expires_at: number;
  refresh_token_expires_at: number;
  token_type: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
}

class AuthService {
  /**
   * Initialize auth tokens from localStorage
   */
  initialize(): void {
    const accessToken = apiClient.getAccessToken();
    const refreshToken = apiClient.getRefreshToken();
    if (accessToken) {
      apiClient.setAccessToken(accessToken);
    }
    if (refreshToken) {
      apiClient.setRefreshToken(refreshToken);
    }
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!apiClient.getAccessToken();
  }

  /**
   * Set authentication tokens
   */
  setTokens(tokens: AuthTokens): void {
    apiClient.setAccessToken(tokens.access_token);
    apiClient.setRefreshToken(tokens.refresh_token);
  }

  /**
   * Clear authentication tokens
   */
  clearTokens(): void {
    apiClient.clearTokens();
  }

  /**
   * Refresh access token
   */
  async refreshToken(): Promise<RefreshTokenResponse> {
    const refreshToken = apiClient.getRefreshToken();
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const request: RefreshTokenRequest = {
      refresh_token: refreshToken,
    };

    const response = await apiClient.getClient().post<RefreshTokenResponse>(
      '/api/v1/auth/refresh',
      request
    );

    this.setTokens({
      access_token: response.data.access_token,
      refresh_token: response.data.refresh_token,
      access_token_expires_at: response.data.access_token_expires_at,
      refresh_token_expires_at: response.data.refresh_token_expires_at,
      token_type: response.data.token_type,
    });

    return response.data;
  }

  /**
   * Logout
   */
  async logout(): Promise<void> {
    try {
      await apiClient.getClient().post('/api/v1/auth/logout');
    } catch (error) {
      // Ignore errors during logout
      console.error('Logout error:', error);
    } finally {
      this.clearTokens();
    }
  }

  /**
   * Get current user (if available)
   */
  async getCurrentUser(): Promise<User | null> {
    try {
      const response = await apiClient.getClient().get<{ user: User }>('/api/v1/auth/me');
      return response.data.user;
    } catch (error) {
      return null;
    }
  }
}

// Export singleton instance
export const authService = new AuthService();

