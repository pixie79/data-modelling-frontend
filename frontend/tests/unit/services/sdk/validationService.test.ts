/**
 * Unit tests for Validation Service
 * Tests data model validation using SDK
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { validationService } from '@/services/sdk/validationService';
import { sdkLoader } from '@/services/sdk/sdkLoader';
import type { Table } from '@/types/table';
import type { Relationship } from '@/types/relationship';

vi.mock('@/services/sdk/sdkLoader');

describe('ValidationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(sdkLoader.load).mockResolvedValue({
      init: vi.fn(),
    } as any);
  });

  describe('validateTable', () => {
    it('should validate a valid table', async () => {
      const table: Table = {
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

      const result = await validationService.validateTable(table);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject table with empty name', async () => {
      const table: Table = {
        id: 'table-1',
        workspace_id: 'workspace-1',
        primary_domain_id: 'domain-1',
        name: '',
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

      const result = await validationService.validateTable(table);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'name')).toBe(true);
    });

    it('should require at least one column for physical model', async () => {
      const table: Table = {
        id: 'table-1',
        workspace_id: 'workspace-1',
        primary_domain_id: 'domain-1',
        name: 'Users',
        model_type: 'physical',
        columns: [],
        position_x: 100,
        position_y: 100,
        width: 200,
        height: 150,
        visible_domains: ['domain-1'],
        created_at: '2025-01-01T00:00:00Z',
        last_modified_at: '2025-01-01T00:00:00Z',
      };

      const result = await validationService.validateTable(table);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'columns')).toBe(true);
    });
  });

  describe('validateRelationship', () => {
    it('should validate a valid relationship', async () => {
      const relationship: Relationship = {
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

      const result = await validationService.validateRelationship(relationship);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject self-referencing relationship', async () => {
      const relationship: Relationship = {
        id: 'rel-1',
        workspace_id: 'workspace-1',
        domain_id: 'domain-1',
        source_table_id: 'table-1',
        target_table_id: 'table-1', // Same table
        type: 'one-to-one',
        source_cardinality: '1',
        target_cardinality: '1',
        model_type: 'conceptual',
        is_circular: false,
        created_at: '2025-01-01T00:00:00Z',
        last_modified_at: '2025-01-01T00:00:00Z',
      };

      const result = await validationService.validateRelationship(relationship);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'SELF_REFERENCE')).toBe(true);
    });
  });

  describe('detectCircularRelationships', () => {
    it('should detect circular relationships', async () => {
      const relationships: Relationship[] = [
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
        {
          id: 'rel-2',
          workspace_id: 'workspace-1',
          domain_id: 'domain-1',
          source_table_id: 'table-2',
          target_table_id: 'table-1', // Creates cycle
          type: 'many-to-one',
          source_cardinality: 'N',
          target_cardinality: '1',
          model_type: 'conceptual',
          is_circular: true,
          created_at: '2025-01-01T00:00:00Z',
          last_modified_at: '2025-01-01T00:00:00Z',
        },
      ];

      const result = await validationService.detectCircularRelationships(relationships);
      expect(result.isCircular).toBe(true);
    });

    it('should not detect cycles in acyclic relationships', async () => {
      const relationships: Relationship[] = [
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
        {
          id: 'rel-2',
          workspace_id: 'workspace-1',
          domain_id: 'domain-1',
          source_table_id: 'table-2',
          target_table_id: 'table-3', // No cycle
          type: 'one-to-many',
          source_cardinality: '1',
          target_cardinality: 'N',
          model_type: 'conceptual',
          is_circular: false,
          created_at: '2025-01-01T00:00:00Z',
          last_modified_at: '2025-01-01T00:00:00Z',
        },
      ];

      const result = await validationService.detectCircularRelationships(relationships);
      expect(result.isCircular).toBe(false);
    });
  });
});

