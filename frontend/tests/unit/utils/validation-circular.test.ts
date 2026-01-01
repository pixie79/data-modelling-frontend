/**
 * Unit tests for Circular Relationship Detection
 * Tests validation utilities for detecting circular relationships
 */

import { describe, it, expect } from 'vitest';
import {
  detectCircularRelationship,
  checkCircularRelationshipWarning,
} from '@/utils/validation';
import type { Relationship } from '@/types/relationship';

describe('Circular Relationship Detection', () => {
  describe('detectCircularRelationship', () => {
    it('should detect circular relationship', () => {
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

      const result = detectCircularRelationship(relationships, 'table-1', 'table-2');
      expect(result.isCircular).toBe(true);
    });

    it('should not detect cycle in acyclic relationships', () => {
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

      const result = detectCircularRelationship(relationships, 'table-3', 'table-4');
      expect(result.isCircular).toBe(false);
    });

    it('should detect multi-hop circular relationship', () => {
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
          target_table_id: 'table-3',
          type: 'one-to-many',
          source_cardinality: '1',
          target_cardinality: 'N',
          model_type: 'conceptual',
          is_circular: false,
          created_at: '2025-01-01T00:00:00Z',
          last_modified_at: '2025-01-01T00:00:00Z',
        },
      ];

      // Adding table-3 -> table-1 creates a cycle
      const result = detectCircularRelationship(relationships, 'table-3', 'table-1');
      expect(result.isCircular).toBe(true);
    });
  });

  describe('checkCircularRelationshipWarning', () => {
    it('should return warning message for circular relationship', () => {
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
      ];

      const warning = checkCircularRelationshipWarning(relationships, 'table-2', 'table-1');
      expect(warning).toContain('circular dependency');
    });

    it('should return null for non-circular relationship', () => {
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
      ];

      const warning = checkCircularRelationshipWarning(relationships, 'table-2', 'table-3');
      expect(warning).toBeNull();
    });
  });
});

