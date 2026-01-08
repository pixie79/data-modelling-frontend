/**
 * IndexedDB Service
 * Provides typed access to IndexedDB for offline caching
 */

const DB_NAME = 'data_modelling_db';
const DB_VERSION = 1;

interface DBSchema {
  workspaces: { key: string; value: unknown };
  tables: { key: string; value: unknown };
  relationships: { key: string; value: unknown };
  cache: { key: string; value: unknown };
}

class IndexedDBService {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<IDBDatabase> | null = null;

  /**
   * Initialize IndexedDB database
   */
  async init(): Promise<IDBDatabase> {
    if (this.db) {
      return this.db;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(new Error(`Failed to open IndexedDB: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object stores
        if (!db.objectStoreNames.contains('workspaces')) {
          db.createObjectStore('workspaces', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('tables')) {
          db.createObjectStore('tables', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('relationships')) {
          db.createObjectStore('relationships', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('cache')) {
          db.createObjectStore('cache', { keyPath: 'key' });
        }
      };
    });

    return this.initPromise;
  }

  /**
   * Get database instance
   */
  private async getDB(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.init();
    }
    if (!this.db) {
      throw new Error('IndexedDB not initialized');
    }
    return this.db;
  }

  /**
   * Store a value in IndexedDB
   */
  async set<T>(storeName: keyof DBSchema, key: string, value: T): Promise<void> {
    const db = await this.getDB();
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);

    return new Promise((resolve, reject) => {
      const request = store.put({ id: key, ...value });
      request.onsuccess = () => resolve();
      request.onerror = () =>
        reject(new Error(`Failed to set ${storeName}: ${request.error?.message}`));
    });
  }

  /**
   * Get a value from IndexedDB
   */
  async get<T>(storeName: keyof DBSchema, key: string): Promise<T | null> {
    const db = await this.getDB();
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);

    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => {
        const result = request.result;
        if (result) {
          // Remove the id key that was added during storage

          const { id: _id, ...value } = result;
          resolve(value as T);
        } else {
          resolve(null);
        }
      };
      request.onerror = () =>
        reject(new Error(`Failed to get ${storeName}: ${request.error?.message}`));
    });
  }

  /**
   * Remove a value from IndexedDB
   */
  async remove(storeName: keyof DBSchema, key: string): Promise<void> {
    const db = await this.getDB();
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);

    return new Promise((resolve, reject) => {
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () =>
        reject(new Error(`Failed to remove ${storeName}: ${request.error?.message}`));
    });
  }

  /**
   * Get all values from a store
   */
  async getAll<T>(storeName: keyof DBSchema): Promise<T[]> {
    const db = await this.getDB();
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const results = request.result.map((item: { id: string }) => {
          const { id: _id, ...value } = item;
          return value;
        });
        resolve(results as T[]);
      };
      request.onerror = () =>
        reject(new Error(`Failed to get all ${storeName}: ${request.error?.message}`));
    });
  }

  /**
   * Clear a store
   */
  async clear(storeName: keyof DBSchema): Promise<void> {
    const db = await this.getDB();
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);

    return new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () =>
        reject(new Error(`Failed to clear ${storeName}: ${request.error?.message}`));
    });
  }
}

// Export singleton instance
export const indexedDBService = new IndexedDBService();
