/**
 * Database Storage Adapter
 * Provides database-backed storage for workspace data using SDK 1.13.1+ DuckDB/PostgreSQL
 */

import { databaseService } from '@/services/sdk/databaseService';
import type { Table } from '@/types/table';
import type { ComputeAsset } from '@/types/cads';
import type { Relationship } from '@/types/relationship';
import type { System } from '@/types/system';
import type { Domain } from '@/types/domain';
import type { DataProduct } from '@/types/odps';
import type { FileSyncMetadata } from '@/types/database';

/**
 * LRU Cache for query results
 */
class LRUCache<K, V> {
  private cache = new Map<K, { value: V; timestamp: number }>();
  private maxSize: number;
  private ttlMs: number;

  constructor(maxSize: number = 100, ttlMs: number = 30000) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    // Check if expired
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return undefined;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  set(key: K, value: V): void {
    // Remove oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, { value, timestamp: Date.now() });
  }

  invalidate(key?: K): void {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }

  size(): number {
    return this.cache.size;
  }
}

/**
 * Database Storage Adapter
 */
class DatabaseStorage {
  private queryCache = new LRUCache<string, unknown>(100, 30000);
  private syncMetadata = new Map<string, FileSyncMetadata>();

  /**
   * Check if database storage is available
   */
  isAvailable(): boolean {
    return databaseService.isSupported();
  }

  /**
   * Check if database is initialized for workspace
   */
  isInitialized(workspacePath: string): boolean {
    return databaseService.isInitialized(workspacePath);
  }

  // ============================================
  // Table Operations (O(1) lookups)
  // ============================================

  /**
   * Get table by ID - O(1) lookup using database index
   */
  async getTableById(workspacePath: string, id: string): Promise<Table | null> {
    const cacheKey = `table:${workspacePath}:${id}`;
    const cached = this.queryCache.get(cacheKey);
    if (cached) return cached as Table;

    const result = await databaseService.executeQuery<Table>(
      workspacePath,
      `SELECT * FROM tables WHERE id = '${this.escapeString(id)}' LIMIT 1`
    );

    if (result.success && result.data.length > 0) {
      const table = result.data[0];
      if (table) {
        this.queryCache.set(cacheKey, table);
        return table;
      }
    }
    return null;
  }

  /**
   * Get all tables for a domain
   */
  async getTablesByDomain(workspacePath: string, domainId: string): Promise<Table[]> {
    const cacheKey = `tables:domain:${workspacePath}:${domainId}`;
    const cached = this.queryCache.get(cacheKey);
    if (cached) return cached as Table[];

    const result = await databaseService.executeQuery<Table>(
      workspacePath,
      `SELECT * FROM tables WHERE domain_id = '${this.escapeString(domainId)}' ORDER BY name`
    );

    if (result.success) {
      this.queryCache.set(cacheKey, result.data);
      return result.data;
    }
    return [];
  }

  /**
   * Get tables by tag using database filtering
   */
  async getTablesByTag(workspacePath: string, tag: string): Promise<Table[]> {
    const cacheKey = `tables:tag:${workspacePath}:${tag}`;
    const cached = this.queryCache.get(cacheKey);
    if (cached) return cached as Table[];

    // Use JSON contains for tag matching
    const result = await databaseService.executeQuery<Table>(
      workspacePath,
      `SELECT * FROM tables WHERE tags::text LIKE '%${this.escapeString(tag)}%'`
    );

    if (result.success) {
      this.queryCache.set(cacheKey, result.data);
      return result.data;
    }
    return [];
  }

  /**
   * Get tables by owner
   */
  async getTablesByOwner(workspacePath: string, ownerName: string): Promise<Table[]> {
    const result = await databaseService.executeQuery<Table>(
      workspacePath,
      `SELECT * FROM tables WHERE owner->>'name' = '${this.escapeString(ownerName)}' ORDER BY name`
    );
    return result.success ? result.data : [];
  }

  // ============================================
  // Domain Operations (O(1) lookups)
  // ============================================

  /**
   * Get domain by ID - O(1) lookup
   */
  async getDomainById(workspacePath: string, id: string): Promise<Domain | null> {
    const cacheKey = `domain:${workspacePath}:${id}`;
    const cached = this.queryCache.get(cacheKey);
    if (cached) return cached as Domain;

    const result = await databaseService.executeQuery<Domain>(
      workspacePath,
      `SELECT * FROM domains WHERE id = '${this.escapeString(id)}' LIMIT 1`
    );

    if (result.success && result.data.length > 0) {
      const domain = result.data[0];
      if (domain) {
        this.queryCache.set(cacheKey, domain);
        return domain;
      }
    }
    return null;
  }

  /**
   * Get all domains for a workspace
   */
  async getAllDomains(workspacePath: string): Promise<Domain[]> {
    const cacheKey = `domains:all:${workspacePath}`;
    const cached = this.queryCache.get(cacheKey);
    if (cached) return cached as Domain[];

    const result = await databaseService.executeQuery<Domain>(
      workspacePath,
      `SELECT * FROM domains ORDER BY name`
    );

    if (result.success) {
      this.queryCache.set(cacheKey, result.data);
      return result.data;
    }
    return [];
  }

  // ============================================
  // Relationship Operations (O(1) lookups)
  // ============================================

  /**
   * Get relationship by ID - O(1) lookup
   */
  async getRelationshipById(workspacePath: string, id: string): Promise<Relationship | null> {
    const cacheKey = `relationship:${workspacePath}:${id}`;
    const cached = this.queryCache.get(cacheKey);
    if (cached) return cached as Relationship;

    const result = await databaseService.executeQuery<Relationship>(
      workspacePath,
      `SELECT * FROM relationships WHERE id = '${this.escapeString(id)}' LIMIT 1`
    );

    if (result.success && result.data.length > 0) {
      const rel = result.data[0];
      if (rel) {
        this.queryCache.set(cacheKey, rel);
        return rel;
      }
    }
    return null;
  }

  /**
   * Get relationships for a table - efficient with indexes
   */
  async getRelationshipsForTable(workspacePath: string, tableId: string): Promise<Relationship[]> {
    const cacheKey = `relationships:table:${workspacePath}:${tableId}`;
    const cached = this.queryCache.get(cacheKey);
    if (cached) return cached as Relationship[];

    const result = await databaseService.executeQuery<Relationship>(
      workspacePath,
      `SELECT * FROM relationships
       WHERE source_id = '${this.escapeString(tableId)}'
          OR target_id = '${this.escapeString(tableId)}'`
    );

    if (result.success) {
      this.queryCache.set(cacheKey, result.data);
      return result.data;
    }
    return [];
  }

  /**
   * Get related tables with depth (graph traversal)
   */
  async getRelatedTables(
    workspacePath: string,
    tableId: string,
    depth: number = 1
  ): Promise<Table[]> {
    if (depth < 1) return [];

    // For depth 1, simple query
    if (depth === 1) {
      const relationships = await this.getRelationshipsForTable(workspacePath, tableId);
      const relatedIds = new Set<string>();

      for (const rel of relationships) {
        if (rel.source_id === tableId) {
          relatedIds.add(rel.target_id);
        } else {
          relatedIds.add(rel.source_id);
        }
      }

      const tables: Table[] = [];
      for (const id of relatedIds) {
        const table = await this.getTableById(workspacePath, id);
        if (table) tables.push(table);
      }
      return tables;
    }

    // For deeper traversal, use recursive CTE if supported
    const result = await databaseService.executeQuery<Table>(
      workspacePath,
      `WITH RECURSIVE related AS (
        SELECT target_id as id, 1 as depth FROM relationships WHERE source_id = '${this.escapeString(tableId)}'
        UNION
        SELECT source_id as id, 1 as depth FROM relationships WHERE target_id = '${this.escapeString(tableId)}'
        UNION
        SELECT CASE WHEN r.source_id = rel.id THEN r.target_id ELSE r.source_id END as id, rel.depth + 1
        FROM relationships r
        JOIN related rel ON (r.source_id = rel.id OR r.target_id = rel.id)
        WHERE rel.depth < ${depth}
      )
      SELECT DISTINCT t.* FROM tables t
      JOIN related r ON t.id = r.id
      WHERE t.id != '${this.escapeString(tableId)}'`
    );

    return result.success ? result.data : [];
  }

  /**
   * Get all relationships for a domain
   */
  async getRelationshipsByDomain(workspacePath: string, domainId: string): Promise<Relationship[]> {
    const cacheKey = `relationships:domain:${workspacePath}:${domainId}`;
    const cached = this.queryCache.get(cacheKey);
    if (cached) return cached as Relationship[];

    const result = await databaseService.executeQuery<Relationship>(
      workspacePath,
      `SELECT * FROM relationships WHERE domain_id = '${this.escapeString(domainId)}'`
    );

    if (result.success) {
      this.queryCache.set(cacheKey, result.data);
      return result.data;
    }
    return [];
  }

  // ============================================
  // System Operations (O(1) lookups)
  // ============================================

  /**
   * Get system by ID - O(1) lookup
   */
  async getSystemById(workspacePath: string, id: string): Promise<System | null> {
    const cacheKey = `system:${workspacePath}:${id}`;
    const cached = this.queryCache.get(cacheKey);
    if (cached) return cached as System;

    const result = await databaseService.executeQuery<System>(
      workspacePath,
      `SELECT * FROM systems WHERE id = '${this.escapeString(id)}' LIMIT 1`
    );

    if (result.success && result.data.length > 0) {
      const system = result.data[0];
      if (system) {
        this.queryCache.set(cacheKey, system);
        return system;
      }
    }
    return null;
  }

  /**
   * Get systems by domain
   */
  async getSystemsByDomain(workspacePath: string, domainId: string): Promise<System[]> {
    const cacheKey = `systems:domain:${workspacePath}:${domainId}`;
    const cached = this.queryCache.get(cacheKey);
    if (cached) return cached as System[];

    const result = await databaseService.executeQuery<System>(
      workspacePath,
      `SELECT * FROM systems WHERE domain_id = '${this.escapeString(domainId)}' ORDER BY name`
    );

    if (result.success) {
      this.queryCache.set(cacheKey, result.data);
      return result.data;
    }
    return [];
  }

  // ============================================
  // Compute Asset Operations (O(1) lookups)
  // ============================================

  /**
   * Get compute asset by ID - O(1) lookup
   */
  async getComputeAssetById(workspacePath: string, id: string): Promise<ComputeAsset | null> {
    const cacheKey = `asset:${workspacePath}:${id}`;
    const cached = this.queryCache.get(cacheKey);
    if (cached) return cached as ComputeAsset;

    const result = await databaseService.executeQuery<ComputeAsset>(
      workspacePath,
      `SELECT * FROM compute_assets WHERE id = '${this.escapeString(id)}' LIMIT 1`
    );

    if (result.success && result.data.length > 0) {
      const asset = result.data[0];
      if (asset) {
        this.queryCache.set(cacheKey, asset);
        return asset;
      }
    }
    return null;
  }

  /**
   * Get compute assets by domain
   */
  async getComputeAssetsByDomain(workspacePath: string, domainId: string): Promise<ComputeAsset[]> {
    const cacheKey = `assets:domain:${workspacePath}:${domainId}`;
    const cached = this.queryCache.get(cacheKey);
    if (cached) return cached as ComputeAsset[];

    const result = await databaseService.executeQuery<ComputeAsset>(
      workspacePath,
      `SELECT * FROM compute_assets WHERE domain_id = '${this.escapeString(domainId)}' ORDER BY name`
    );

    if (result.success) {
      this.queryCache.set(cacheKey, result.data);
      return result.data;
    }
    return [];
  }

  /**
   * Get compute assets by tag
   */
  async getComputeAssetsByTag(workspacePath: string, tag: string): Promise<ComputeAsset[]> {
    const result = await databaseService.executeQuery<ComputeAsset>(
      workspacePath,
      `SELECT * FROM compute_assets WHERE tags::text LIKE '%${this.escapeString(tag)}%'`
    );
    return result.success ? result.data : [];
  }

  // ============================================
  // Data Product Operations
  // ============================================

  /**
   * Get data product by ID
   */
  async getDataProductById(workspacePath: string, id: string): Promise<DataProduct | null> {
    const cacheKey = `product:${workspacePath}:${id}`;
    const cached = this.queryCache.get(cacheKey);
    if (cached) return cached as DataProduct;

    const result = await databaseService.executeQuery<DataProduct>(
      workspacePath,
      `SELECT * FROM data_products WHERE id = '${this.escapeString(id)}' LIMIT 1`
    );

    if (result.success && result.data.length > 0) {
      const product = result.data[0];
      if (product) {
        this.queryCache.set(cacheKey, product);
        return product;
      }
    }
    return null;
  }

  /**
   * Get data products by domain
   */
  async getDataProductsByDomain(workspacePath: string, domainId: string): Promise<DataProduct[]> {
    const result = await databaseService.executeQuery<DataProduct>(
      workspacePath,
      `SELECT * FROM data_products WHERE domain_id = '${this.escapeString(domainId)}' ORDER BY name`
    );
    return result.success ? result.data : [];
  }

  // ============================================
  // Sync Metadata Tracking
  // ============================================

  /**
   * Get sync metadata for a file
   */
  getSyncMetadata(filePath: string): FileSyncMetadata | undefined {
    return this.syncMetadata.get(filePath);
  }

  /**
   * Update sync metadata for a file
   */
  updateSyncMetadata(filePath: string, metadata: FileSyncMetadata): void {
    this.syncMetadata.set(filePath, metadata);
  }

  /**
   * Check if a file is out of sync
   */
  isOutOfSync(filePath: string, currentHash: string): boolean {
    const metadata = this.syncMetadata.get(filePath);
    if (!metadata) return true; // Never synced
    return metadata.file_hash !== currentHash;
  }

  /**
   * Get all out-of-sync files
   */
  getOutOfSyncFiles(): string[] {
    const outOfSync: string[] = [];
    for (const [path, metadata] of this.syncMetadata.entries()) {
      if (metadata.sync_status === 'modified' || metadata.sync_status === 'new') {
        outOfSync.push(path);
      }
    }
    return outOfSync;
  }

  /**
   * Mark file as synced
   */
  markAsSynced(filePath: string, hash: string): void {
    const existing = this.syncMetadata.get(filePath);
    this.syncMetadata.set(filePath, {
      file_path: filePath,
      file_hash: hash,
      last_sync: new Date().toISOString(),
      sync_status: 'synced',
      entity_type: existing?.entity_type || 'table',
      entity_id: existing?.entity_id,
    });
  }

  /**
   * Mark file as modified (needs sync)
   */
  markAsModified(filePath: string): void {
    const existing = this.syncMetadata.get(filePath);
    if (existing) {
      existing.sync_status = 'modified';
      this.syncMetadata.set(filePath, existing);
    }
  }

  // ============================================
  // Cache Management
  // ============================================

  /**
   * Invalidate cache for a specific entity
   */
  invalidateCache(_entityType?: string, _entityId?: string): void {
    // For specific invalidation, we'd need to track which cache keys
    // relate to which entities. For now, invalidate all.
    this.queryCache.invalidate();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number } {
    return { size: this.queryCache.size() };
  }

  // ============================================
  // Utility Methods
  // ============================================

  /**
   * Escape string for SQL to prevent injection
   */
  private escapeString(str: string): string {
    return str.replace(/'/g, "''");
  }

  /**
   * Clear all state (for workspace close)
   */
  clearState(): void {
    this.queryCache.invalidate();
    this.syncMetadata.clear();
  }
}

// Export singleton instance
export const databaseStorage = new DatabaseStorage();
