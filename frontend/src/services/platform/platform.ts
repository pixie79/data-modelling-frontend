/**
 * Platform abstraction layer
 * Detects and provides platform-specific implementations
 */

export type Platform = 'browser' | 'electron';

let platform: Platform | null = null;

/**
 * Detect the current platform
 */
export function detectPlatform(): Platform {
  if (platform) {
    return platform;
  }

  // Check if running in Electron
  if (typeof window !== 'undefined' && (window as any).electronAPI) {
    platform = 'electron';
  } else {
    platform = 'browser';
  }

  return platform;
}

/**
 * Get the current platform
 */
export function getPlatform(): Platform {
  return detectPlatform();
}

/**
 * Check if running in Electron
 */
export function isElectron(): boolean {
  return detectPlatform() === 'electron';
}

/**
 * Check if running in browser
 */
export function isBrowser(): boolean {
  return detectPlatform() === 'browser';
}

