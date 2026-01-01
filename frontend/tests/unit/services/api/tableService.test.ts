/**
 * Unit tests for Table Service
 * Tests API interactions for table CRUD operations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { tableService } from '@/services/api/tableService';
import { apiClient } from '@/services/api/apiClient';
import type { Table } from '@/types/table';
import type { CreateTableRequest, UpdateTableRequest } from '@/types/api';

vi.mock('@/services/api/apiClient');

describe('TableService', () => {
  const mockClient = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient.getClient).mockReturnValue(mockClient as any);
  });

  describe('listTables', () => {
    it('should list all tables for a domain', async () => {
      const mockTables: Table[] = [
        {
          id: 'table-1',
          workspace_id: 'workspace-1',
          primary_domain_id: 'domain-1',
          name: 'Users',
          model_type: 'conceptual',
          columns: [],
          position_x: 100,
          position_y: 100,
          width: 200,
          height: 150,
          visible_domains: ['domain-1'],
          created_at: '2025-01-01T00:00:00Z',
          last_modified_at: '2025-01-01T00:00:00Z',
        },
      ];

      mockClient.get.mockResolvedValue({
        data: { tables: mockTables },
      });

      const result = await tableService.listTables('domain-1');
      expect(result).toEqual(mockTables);
      expect(mockClient.get).toHaveBeenCalledWith('/workspace/domains/domain-1/tables');
    });
  });

  describe('getTable', () => {
    it('should get a single table by ID', async () => {
      const mockTable: Table = {
        id: 'table-1',
        workspace_id: 'workspace-1',
        primary_domain_id: 'domain-1',
        name: 'Users',
        model_type: 'conceptual',
        columns: [],
        position_x: 100,
        position_y: 100,
        width: 200,
        height: 150,
        visible_domains: ['domain-1'],
        created_at: '2025-01-01T00:00:00Z',
        last_modified_at: '2025-01-01T00:00:00Z',
      };

      mockClient.get.mockResolvedValue({
        data: { table: mockTable },
      });

      const result = await tableService.getTable('domain-1', 'table-1');
      expect(result).toEqual(mockTable);
      expect(mockClient.get).toHaveBeenCalledWith('/workspace/domains/domain-1/tables/table-1');
    });
  });

  describe('createTable', () => {
    it('should create a new table', async () => {
      const mockTable: Table = {
        id: 'table-1',
        workspace_id: 'workspace-1',
        primary_domain_id: 'domain-1',
        name: 'Users',
        model_type: 'conceptual',
        columns: [],
        position_x: 100,
        position_y: 100,
        width: 200,
        height: 150,
        visible_domains: ['domain-1'],
        created_at: '2025-01-01T00:00:00Z',
        last_modified_at: '2025-01-01T00:00:00Z',
      };

      const request: CreateTableRequest = {
        name: 'Users',
        columns: [],
        model_type: 'conceptual',
      };

      mockClient.post.mockResolvedValue({
        data: { table: mockTable },
      });

      const result = await tableService.createTable('domain-1', request);
      expect(result).toEqual(mockTable);
      expect(mockClient.post).toHaveBeenCalledWith('/workspace/domains/domain-1/tables', request);
    });

    it('should validate table name', async () => {
      const request: CreateTableRequest = {
        name: '',
        columns: [],
        model_type: 'conceptual',
      };

      await expect(tableService.createTable('domain-1', request)).rejects.toThrow('Table name is required');
    });
  });

  describe('updateTable', () => {
    it('should update an existing table', async () => {
      const mockTable: Table = {
        id: 'table-1',
        workspace_id: 'workspace-1',
        primary_domain_id: 'domain-1',
        name: 'Updated Users',
        model_type: 'conceptual',
        columns: [],
        position_x: 100,
        position_y: 100,
        width: 200,
        height: 150,
        visible_domains: ['domain-1'],
        created_at: '2025-01-01T00:00:00Z',
        last_modified_at: '2025-01-01T00:00:00Z',
      };

      const updates: UpdateTableRequest = {
        name: 'Updated Users',
      };

      mockClient.put.mockResolvedValue({
        data: { table: mockTable },
      });

      const result = await tableService.updateTable('domain-1', 'table-1', updates);
      expect(result).toEqual(mockTable);
      expect(mockClient.put).toHaveBeenCalledWith('/workspace/domains/domain-1/tables/table-1', updates);
    });
  });

  describe('updateTablePosition', () => {
    it('should update table position on canvas', async () => {
      mockClient.put.mockResolvedValue({ data: {} });

      await tableService.updateTablePosition('domain-1', 'table-1', { x: 200, y: 300 });
      expect(mockClient.put).toHaveBeenCalledWith('/workspace/domains/domain-1/tables/table-1/position', {
        position: { x: 200, y: 300 },
      });
    });
  });

  describe('deleteTable', () => {
    it('should delete a table', async () => {
      mockClient.delete.mockResolvedValue({ data: {} });

      await tableService.deleteTable('domain-1', 'table-1');
      expect(mockClient.delete).toHaveBeenCalledWith('/workspace/domains/domain-1/tables/table-1');
    });
  });
});
