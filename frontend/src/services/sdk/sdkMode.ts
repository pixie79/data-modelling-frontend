/**
 * SDK Mode Detection and Management
 * Determines whether to use API (online) or WASM SDK (offline)
 * Supports manual override via user toggle
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type SDKMode = 'online' | 'offline';

interface SDKModeState {
  mode: SDKMode;
  isManualOverride: boolean; // True if user manually set the mode
  setMode: (mode: SDKMode, manual?: boolean) => void;
  checkOnlineMode: () => Promise<boolean>;
  getMode: () => Promise<SDKMode>;
  initialize: () => Promise<void>;
}

class SDKModeDetector {
  /**
   * Check if we're online and API is available
   */
  async checkOnlineMode(): Promise<boolean> {
    try {
      // Try to ping the API
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8081'}/api/v1/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000), // 2 second timeout
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get current SDK mode (checks API availability if not manually overridden)
   */
  async getMode(): Promise<SDKMode> {
    const state = useSDKModeStore.getState();
    
    // If user manually set mode, use that
    if (state.isManualOverride) {
      return state.mode;
    }
    
    // Otherwise, check API availability
    const isOnline = await this.checkOnlineMode();
    const detectedMode = isOnline ? 'online' : 'offline';
    
    // Update store with detected mode
    useSDKModeStore.setState({ mode: detectedMode, isManualOverride: false });
    
    return detectedMode;
  }

  /**
   * Set mode manually (user override)
   */
  setMode(mode: SDKMode, manual: boolean = true): void {
    useSDKModeStore.setState({ mode, isManualOverride: manual });
  }

  /**
   * Check if WASM SDK is available
   */
  async isWASMAvailable(): Promise<boolean> {
    try {
      // Check if WASM module can be loaded
      // This will be implemented when WASM build is ready
      return false; // Placeholder - will check actual WASM availability
    } catch {
      return false;
    }
  }

  /**
   * Initialize mode on app start
   */
  async initialize(): Promise<void> {
    const state = useSDKModeStore.getState();
    
    // If manual override exists, use it
    if (state.isManualOverride) {
      return;
    }
    
    // Otherwise, detect mode
    await this.getMode();
  }
}

// Zustand store for SDK mode state (persisted to localStorage)
export const useSDKModeStore = create<SDKModeState>()(
  persist(
    (set) => ({
      mode: 'offline', // Default to offline for safety
      isManualOverride: false,
      
      setMode: (mode: SDKMode, manual: boolean = true) => {
        set({ mode, isManualOverride: manual });
      },
      
      checkOnlineMode: async () => {
        const detector = new SDKModeDetector();
        return detector.checkOnlineMode();
      },
      
      getMode: async () => {
        const detector = new SDKModeDetector();
        return detector.getMode();
      },
      
      initialize: async () => {
        const detector = new SDKModeDetector();
        await detector.initialize();
      },
    }),
    {
      name: 'sdk-mode-storage',
      partialize: (state) => ({ 
        mode: state.mode, 
        isManualOverride: state.isManualOverride 
      }),
    }
  )
);

// Singleton instance for backward compatibility
export const sdkModeDetector = new SDKModeDetector();

