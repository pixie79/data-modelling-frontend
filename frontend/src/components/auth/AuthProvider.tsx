/**
 * Authentication Provider Component
 * Manages authentication state and provides auth context
 */

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { authService, type User } from '@/services/api/authService';
import { useSDKModeStore } from '@/services/sdk/sdkMode';
import { useUIStore } from '@/stores/uiStore';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (tokens: { access_token: string; refresh_token: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { addToast } = useUIStore();

  // Initialize auth on mount (skip if offline mode)
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Check current mode
        const mode = await useSDKModeStore.getState().getMode();
        
        // Skip auth initialization in offline mode
        if (mode === 'offline') {
          setIsLoading(false);
          return;
        }
        
        // Initialize auth only in online mode
        authService.initialize();
        
        if (authService.isAuthenticated()) {
          const currentUser = await authService.getCurrentUser();
          setUser(currentUser);
        }
      } catch (error) {
        console.error('Failed to initialize auth:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  // Set up token refresh interval (only in online mode)
  useEffect(() => {
    const setupTokenRefresh = async () => {
      // Check if we're in online mode
      const mode = await useSDKModeStore.getState().getMode();
      if (mode === 'offline' || !authService.isAuthenticated()) {
        return;
      }

      const refreshInterval = setInterval(async () => {
        try {
          // Check mode again before refresh
          const currentMode = await useSDKModeStore.getState().getMode();
          if (currentMode === 'offline') {
            clearInterval(refreshInterval);
            return;
          }
          
          await authService.refreshToken();
        } catch (error) {
          console.error('Token refresh failed:', error);
          // Token refresh failed - user will need to re-authenticate
          await logout();
        }
      }, 15 * 60 * 1000); // Refresh every 15 minutes

      return () => clearInterval(refreshInterval);
    };

    const cleanup = setupTokenRefresh();
    return () => {
      cleanup.then((fn) => fn && fn());
    };
  }, [authService.isAuthenticated()]);

  const login = async (tokens: { access_token: string; refresh_token: string }) => {
    try {
      authService.setTokens({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        access_token_expires_at: Date.now() + 3600000, // 1 hour
        refresh_token_expires_at: Date.now() + 86400000, // 24 hours
        token_type: 'Bearer',
      });

      const currentUser = await authService.getCurrentUser();
      setUser(currentUser);
      addToast({
        type: 'success',
        message: 'Successfully logged in',
      });
    } catch (error) {
      console.error('Login failed:', error);
      addToast({
        type: 'error',
        message: 'Failed to log in',
      });
      throw error;
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      addToast({
        type: 'info',
        message: 'Logged out successfully',
      });
    }
  };

  const refreshToken = async () => {
    try {
      await authService.refreshToken();
    } catch (error) {
      console.error('Token refresh failed:', error);
      await logout();
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    refreshToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

