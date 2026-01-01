/**
 * Unit tests for Relationship Service
 * Tests API interactions for relationship CRUD operations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { relationshipService } from '@/services/api/relationshipService';
import { apiClient } from '@/services/api/apiClient';
import type { Relationship } from '@/types/relationship';
import type { CreateRelationshipRequest, UpdateRelationshipRequest } from '@/types/api';

vi.mock('@/services/api/apiClient');

describe('RelationshipService', () => {
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

  describe('listRelationships', () => {
    it('should list all relationships for a domain', async () => {
      const mockRelationships: Relationship[] = [
        {
          id: 'rel-1',
          workspace_id: 'workspace-1',
          domain_id: 'domain-1',
          source_table_id: 'table-1',
          target_table_id: 'table-2',
          type: 'one-to-many',
          source_cardinality: '1',
          target_cardinality: 'N',
          model_type: 'conceptual',
          is_circular: false,
          created_at: '2025-01-01T00:00:00Z',
          last_modified_at: '2025-01-01T00:00:00Z',
        },
      ];

      mockClient.get.mockResolvedValue({
        data: { relationships: mockRelationships },
      });

      const result = await relationshipService.listRelationships('domain-1');
      expect(result).toEqual(mockRelationships);
      expect(mockClient.get).toHaveBeenCalledWith('/workspace/domains/domain-1/relationships');
    });
  });

  describe('getRelationship', () => {
    it('should get a single relationship by ID', async () => {
      const mockRelationship: Relationship = {
        id: 'rel-1',
        workspace_id: 'workspace-1',
        domain_id: 'domain-1',
        source_table_id: 'table-1',
        target_table_id: 'table-2',
        type: 'one-to-many',
        source_cardinality: '1',
        target_cardinality: 'N',
        model_type: 'conceptual',
        is_circular: false,
        created_at: '2025-01-01T00:00:00Z',
        last_modified_at: '2025-01-01T00:00:00Z',
      };

      mockClient.get.mockResolvedValue({
        data: { relationship: mockRelationship },
      });

      const result = await relationshipService.getRelationship('domain-1', 'rel-1');
      expect(result).toEqual(mockRelationship);
      expect(mockClient.get).toHaveBeenCalledWith('/workspace/domains/domain-1/relationships/rel-1');
    });
  });

  describe('createRelationship', () => {
    it('should create a new relationship', async () => {
      const mockRelationship: Relationship = {
        id: 'rel-1',
        workspace_id: 'workspace-1',
        domain_id: 'domain-1',
        source_table_id: 'table-1',
        target_table_id: 'table-2',
        type: 'one-to-many',
        source_cardinality: '1',
        target_cardinality: 'N',
        model_type: 'conceptual',
        is_circular: false,
        created_at: '2025-01-01T00:00:00Z',
        last_modified_at: '2025-01-01T00:00:00Z',
      };

      const request: CreateRelationshipRequest = {
        source_table_id: 'table-1',
        target_table_id: 'table-2',
        type: 'one-to-many',
      };

      mockClient.post.mockResolvedValue({
        data: { relationship: mockRelationship },
      });

      const result = await relationshipService.createRelationship('domain-1', request);
      expect(result).toEqual(mockRelationship);
      expect(mockClient.post).toHaveBeenCalledWith('/workspace/domains/domain-1/relationships', request);
    });

    it('should reject self-referencing relationships', async () => {
      const request: CreateRelationshipRequest = {
        source_table_id: 'table-1',
        target_table_id: 'table-1',
        type: 'one-to-one',
      };

      await expect(relationshipService.createRelationship('domain-1', request)).rejects.toThrow('Source and target tables must be different');
    });
  });

  describe('checkCircularDependency', () => {
    it('should check for circular dependencies', async () => {
      const mockResponse = {
        is_circular: true,
        path: ['table-1', 'table-2', 'table-1'],
      };

      mockClient.post.mockResolvedValue({
        data: mockResponse,
      });

      const result = await relationshipService.checkCircularDependency('domain-1', 'table-1', 'table-2');
      expect(result).toEqual(mockResponse);
      expect(mockClient.post).toHaveBeenCalledWith('/workspace/domains/domain-1/relationships/check-circular', {
        source_table_id: 'table-1',
        target_table_id: 'table-2',
      });
    });
  });

  describe('updateRelationship', () => {
    it('should update an existing relationship', async () => {
      const mockRelationship: Relationship = {
        id: 'rel-1',
        workspace_id: 'workspace-1',
        domain_id: 'domain-1',
        source_table_id: 'table-1',
        target_table_id: 'table-2',
        type: 'many-to-many',
        source_cardinality: 'N',
        target_cardinality: 'N',
        model_type: 'conceptual',
        is_circular: false,
        created_at: '2025-01-01T00:00:00Z',
        last_modified_at: '2025-01-01T00:00:00Z',
      };

      const updates: UpdateRelationshipRequest = {
        type: 'many-to-many',
      };

      mockClient.put.mockResolvedValue({
        data: { relationship: mockRelationship },
      });

      const result = await relationshipService.updateRelationship('domain-1', 'rel-1', updates);
      expect(result).toEqual(mockRelationship);
      expect(mockClient.put).toHaveBeenCalledWith('/workspace/domains/domain-1/relationships/rel-1', updates);
    });
  });

  describe('deleteRelationship', () => {
    it('should delete a relationship', async () => {
      mockClient.delete.mockResolvedValue({ data: {} });

      await relationshipService.deleteRelationship('domain-1', 'rel-1');
      expect(mockClient.delete).toHaveBeenCalledWith('/workspace/domains/domain-1/relationships/rel-1');
    });
  });
});
