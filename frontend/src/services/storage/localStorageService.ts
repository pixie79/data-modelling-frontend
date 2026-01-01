/**
 * LocalStorage Service
 * Provides typed access to browser localStorage
 */

class LocalStorageService {
  private prefix = 'dm_';

  /**
   * Set a value in localStorage
   */
  set<T>(key: string, value: T): void {
    try {
      const serialized = JSON.stringify(value);
      localStorage.setItem(this.prefix + key, serialized);
    } catch (error) {
      console.error(`Failed to set localStorage key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Get a value from localStorage
   */
  get<T>(key: string): T | null {
    try {
      const item = localStorage.getItem(this.prefix + key);
      if (item === null) {
        return null;
      }
      return JSON.parse(item) as T;
    } catch (error) {
      console.error(`Failed to get localStorage key ${key}:`, error);
      return null;
    }
  }

  /**
   * Remove a value from localStorage
   */
  remove(key: string): void {
    try {
      localStorage.removeItem(this.prefix + key);
    } catch (error) {
      console.error(`Failed to remove localStorage key ${key}:`, error);
    }
  }

  /**
   * Clear all prefixed keys
   */
  clear(): void {
    try {
      const keys = Object.keys(localStorage);
      for (const key of keys) {
        if (key.startsWith(this.prefix)) {
          localStorage.removeItem(key);
        }
      }
    } catch (error) {
      console.error('Failed to clear localStorage:', error);
    }
  }

  /**
   * Check if a key exists
   */
  has(key: string): boolean {
    return localStorage.getItem(this.prefix + key) !== null;
  }
}

// Export singleton instance
export const localStorageService = new LocalStorageService();

