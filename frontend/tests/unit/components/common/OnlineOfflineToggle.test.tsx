/**
 * Component tests for Online/Offline Toggle
 * Tests mode switching and authentication requirements
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { OnlineOfflineToggle } from '@/components/common/OnlineOfflineToggle';
import * as sdkModeStore from '@/services/sdk/sdkMode';
import * as authProvider from '@/components/auth/AuthProvider';
import * as uiStore from '@/stores/uiStore';

vi.mock('@/services/sdk/sdkMode', () => ({
  useSDKModeStore: vi.fn(),
}));

vi.mock('@/components/auth/AuthProvider', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/stores/uiStore', () => ({
  useUIStore: vi.fn(),
}));

describe('OnlineOfflineToggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    vi.mocked(sdkModeStore.useSDKModeStore).mockReturnValue({
      mode: 'offline',
      isManualOverride: false,
      setMode: vi.fn(),
      checkOnlineMode: vi.fn().mockResolvedValue(false),
      getMode: vi.fn().mockResolvedValue('offline'),
      initialize: vi.fn().mockResolvedValue(undefined),
    } as any);
    
    vi.mocked(authProvider.useAuth).mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      refreshToken: vi.fn(),
    } as any);
    
    vi.mocked(uiStore.useUIStore).mockReturnValue({
      addToast: vi.fn(),
    } as any);
  });

  it('should render toggle in offline mode', async () => {
    await act(async () => {
      render(<OnlineOfflineToggle />);
    });
    await waitFor(() => {
      expect(screen.getByText('Offline')).toBeInTheDocument();
    });
  });

  it('should render toggle in online mode', () => {
    vi.mocked(sdkModeStore.useSDKModeStore).mockReturnValue({
      mode: 'online',
      isManualOverride: true,
      setMode: vi.fn(),
      checkOnlineMode: vi.fn().mockResolvedValue(true),
      getMode: vi.fn().mockResolvedValue('online'),
      initialize: vi.fn().mockResolvedValue(undefined),
    } as any);
    
    vi.mocked(authProvider.useAuth).mockReturnValue({
      user: { id: 'user-1', name: 'Test User', email: 'test@example.com' },
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      refreshToken: vi.fn(),
    } as any);
    
    render(<OnlineOfflineToggle />);
    expect(screen.getByText('Online')).toBeInTheDocument();
    expect(screen.getByText('(Authenticated)')).toBeInTheDocument();
  });

  it('should switch to offline mode when clicked', async () => {
    const setMode = vi.fn();
    const addToast = vi.fn();
    
    vi.mocked(sdkModeStore.useSDKModeStore).mockReturnValue({
      mode: 'online',
      isManualOverride: true,
      setMode,
      checkOnlineMode: vi.fn().mockResolvedValue(true),
      getMode: vi.fn().mockResolvedValue('online'),
      initialize: vi.fn().mockResolvedValue(undefined),
    } as any);
    
    vi.mocked(uiStore.useUIStore).mockReturnValue({
      addToast,
    } as any);
    
    render(<OnlineOfflineToggle />);
    
    const toggle = screen.getByRole('switch');
    fireEvent.click(toggle);
    
    await waitFor(() => {
      expect(setMode).toHaveBeenCalledWith('offline', true);
      expect(addToast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'info',
          message: expect.stringContaining('offline mode'),
        })
      );
    });
  });

  it('should require authentication when switching to online mode', async () => {
    const setMode = vi.fn();
    const checkOnlineMode = vi.fn().mockResolvedValue(true);
    const addToast = vi.fn();
    
    vi.mocked(sdkModeStore.useSDKModeStore).mockReturnValue({
      mode: 'offline',
      isManualOverride: true,
      setMode,
      checkOnlineMode,
      getMode: vi.fn().mockResolvedValue('offline'),
      initialize: vi.fn().mockResolvedValue(undefined),
    } as any);
    
    vi.mocked(authProvider.useAuth).mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      refreshToken: vi.fn(),
    } as any);
    
    vi.mocked(uiStore.useUIStore).mockReturnValue({
      addToast,
    } as any);
    
    // Mock window.location.href
    const originalLocation = window.location;
    delete (window as any).location;
    window.location = { ...originalLocation, href: '' };
    
    render(<OnlineOfflineToggle />);
    
    const toggle = screen.getByRole('switch');
    fireEvent.click(toggle);
    
    await waitFor(() => {
      expect(checkOnlineMode).toHaveBeenCalled();
      expect(addToast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'info',
          message: expect.stringContaining('Authentication required'),
        })
      );
    });
    
    // Restore window.location
    window.location = originalLocation;
  });

  it('should prevent switching to online if API is unavailable', async () => {
    const setMode = vi.fn();
    const checkOnlineMode = vi.fn().mockResolvedValue(false);
    const addToast = vi.fn();
    
    vi.mocked(sdkModeStore.useSDKModeStore).mockReturnValue({
      mode: 'offline',
      isManualOverride: true,
      setMode,
      checkOnlineMode,
      getMode: vi.fn().mockResolvedValue('offline'),
      initialize: vi.fn().mockResolvedValue(undefined),
    } as any);
    
    vi.mocked(uiStore.useUIStore).mockReturnValue({
      addToast,
    } as any);
    
    render(<OnlineOfflineToggle />);
    
    const toggle = screen.getByRole('switch');
    fireEvent.click(toggle);
    
    await waitFor(() => {
      expect(checkOnlineMode).toHaveBeenCalled();
      expect(addToast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          message: expect.stringContaining('API server is not available'),
        })
      );
      expect(setMode).not.toHaveBeenCalledWith('online', true);
    });
  });
});

