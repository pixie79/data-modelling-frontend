/**
 * Table Service
 * Handles API interactions for table CRUD operations
 */

import { apiClient } from './apiClient';
import type { Table } from '@/types/table';
import type {
  ListTablesResponse,
  GetTableResponse,
  CreateTableRequest,
  CreateTableResponse,
  UpdateTableRequest,
  UpdateTableResponse,
} from '@/types/api';

class TableService {
  /**
   * List all tables for a domain
   * Note: Domain must be loaded first via workspaceService.loadDomain()
   */
  async listTables(domain: string): Promise<Table[]> {
    const response = await apiClient.getClient().get<ListTablesResponse>(
      `/workspace/domains/${domain}/tables`
    );
    return response.data.tables;
  }

  /**
   * Get a single table by ID
   */
  async getTable(domain: string, tableId: string): Promise<Table> {
    const response = await apiClient.getClient().get<GetTableResponse>(
      `/workspace/domains/${domain}/tables/${tableId}`
    );
    return response.data.table;
  }

  /**
   * Create a new table
   */
  async createTable(domain: string, request: CreateTableRequest): Promise<Table> {
    // Validate request
    if (!request.name || request.name.trim().length === 0) {
      throw new Error('Table name is required');
    }

    const response = await apiClient.getClient().post<CreateTableResponse>(
      `/workspace/domains/${domain}/tables`,
      request
    );
    return response.data.table;
  }

  /**
   * Update an existing table
   */
  async updateTable(
    domain: string,
    tableId: string,
    updates: UpdateTableRequest
  ): Promise<Table> {
    const response = await apiClient.getClient().put<UpdateTableResponse>(
      `/workspace/domains/${domain}/tables/${tableId}`,
      updates
    );
    return response.data.table;
  }

  /**
   * Update table position on canvas
   */
  async updateTablePosition(
    domain: string,
    tableId: string,
    position: { x: number; y: number }
  ): Promise<void> {
    await apiClient.getClient().put(
      `/workspace/domains/${domain}/tables/${tableId}/position`,
      { position }
    );
  }

  /**
   * Delete a table
   */
  async deleteTable(domain: string, tableId: string): Promise<void> {
    await apiClient.getClient().delete(`/workspace/domains/${domain}/tables/${tableId}`);
  }
}

// Export singleton instance
export const tableService = new TableService();

