/**
 * IndexedDB Storage Service
 * Provides persistent storage for workspace data in browser mode
 */

const DB_NAME = 'data-modelling-workspace';
const DB_VERSION = 1;
const STORE_NAME = 'workspaces';

interface WorkspaceData {
  id: string;
  name: string;
  data: any; // Workspace object
  lastSaved: string;
}

class IndexedDBStorage {
  private db: IDBDatabase | null = null;

  /**
   * Initialize IndexedDB database
   */
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('[IndexedDBStorage] Failed to open database:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('[IndexedDBStorage] Database opened successfully');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          objectStore.createIndex('name', 'name', { unique: false });
          objectStore.createIndex('lastSaved', 'lastSaved', { unique: false });
          console.log('[IndexedDBStorage] Object store created');
        }
      };
    });
  }

  /**
   * Save workspace data to IndexedDB
   */
  async saveWorkspace(workspaceId: string, workspaceName: string, data: any): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const workspaceData: WorkspaceData = {
        id: workspaceId,
        name: workspaceName,
        data,
        lastSaved: new Date().toISOString(),
      };

      const request = store.put(workspaceData);

      request.onsuccess = () => {
        console.log(`[IndexedDBStorage] Saved workspace: ${workspaceName}`);
        resolve();
      };

      request.onerror = () => {
        console.error('[IndexedDBStorage] Failed to save workspace:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Load workspace data from IndexedDB
   */
  async loadWorkspace(workspaceId: string): Promise<any | null> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(workspaceId);

      request.onsuccess = () => {
        const result = request.result;
        if (result) {
          console.log(`[IndexedDBStorage] Loaded workspace: ${result.name}`);
          resolve(result.data);
        } else {
          console.log(`[IndexedDBStorage] Workspace not found: ${workspaceId}`);
          resolve(null);
        }
      };

      request.onerror = () => {
        console.error('[IndexedDBStorage] Failed to load workspace:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * List all saved workspaces
   */
  async listWorkspaces(): Promise<Array<{ id: string; name: string; lastSaved: string }>> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const workspaces = request.result.map((w: WorkspaceData) => ({
          id: w.id,
          name: w.name,
          lastSaved: w.lastSaved,
        }));
        resolve(workspaces);
      };

      request.onerror = () => {
        console.error('[IndexedDBStorage] Failed to list workspaces:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Delete workspace from IndexedDB
   */
  async deleteWorkspace(workspaceId: string): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(workspaceId);

      request.onsuccess = () => {
        console.log(`[IndexedDBStorage] Deleted workspace: ${workspaceId}`);
        resolve();
      };

      request.onerror = () => {
        console.error('[IndexedDBStorage] Failed to delete workspace:', request.error);
        reject(request.error);
      };
    });
  }
}

export const indexedDBStorage = new IndexedDBStorage();

