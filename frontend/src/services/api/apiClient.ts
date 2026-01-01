/**
 * API Client wrapper using Axios
 * Handles authentication, error handling, and request/response interceptors
 */

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import type { ApiError } from '@/types/api';
import { useSDKModeStore } from '@/services/sdk/sdkMode';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8081';

class ApiClient {
  private client: AxiosInstance;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000, // 30 seconds
    });

    // Request interceptor: Check mode and add auth token
    this.client.interceptors.request.use(
      async (config: InternalAxiosRequestConfig) => {
        // Check if we're in offline mode
        const mode = await useSDKModeStore.getState().getMode();
        if (mode === 'offline') {
          // Reject API calls in offline mode
          return Promise.reject(
            new Error('API calls are disabled in offline mode. Switch to online mode to use API features.')
          );
        }
        
        // Add auth token if available
        if (this.accessToken && config.headers) {
          config.headers.Authorization = `Bearer ${this.accessToken}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor: Handle errors and token refresh
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError<ApiError>) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

        // Handle 401 Unauthorized - try to refresh token
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            await this.refreshAccessToken();
            if (this.accessToken && originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${this.accessToken}`;
            }
            return this.client(originalRequest);
          } catch (refreshError) {
            // Refresh failed - clear tokens and redirect to login
            this.clearTokens();
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  /**
   * Set access token
   */
  setAccessToken(token: string | null): void {
    this.accessToken = token;
    if (token) {
      localStorage.setItem('access_token', token);
    } else {
      localStorage.removeItem('access_token');
    }
  }

  /**
   * Set refresh token
   */
  setRefreshToken(token: string | null): void {
    this.refreshToken = token;
    if (token) {
      localStorage.setItem('refresh_token', token);
    } else {
      localStorage.removeItem('refresh_token');
    }
  }

  /**
   * Get access token
   */
  getAccessToken(): string | null {
    return this.accessToken || localStorage.getItem('access_token');
  }

  /**
   * Get refresh token
   */
  getRefreshToken(): string | null {
    return this.refreshToken || localStorage.getItem('refresh_token');
  }

  /**
   * Clear all tokens
   */
  clearTokens(): void {
    this.accessToken = null;
    this.refreshToken = null;
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(): Promise<void> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await axios.post<{
        access_token: string;
        refresh_token: string;
        access_token_expires_at: number;
        refresh_token_expires_at: number;
        token_type: string;
      }>(`${API_BASE_URL}/api/v1/auth/refresh`, {
        refresh_token: refreshToken,
      });

      this.setAccessToken(response.data.access_token);
      this.setRefreshToken(response.data.refresh_token);
    } catch (error) {
      this.clearTokens();
      throw error;
    }
  }

  /**
   * Get the underlying Axios instance
   */
  getClient(): AxiosInstance {
    return this.client;
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

