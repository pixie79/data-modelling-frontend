/**
 * Unit tests for Model Store
 * Tests Zustand store state management for tables, relationships, and domains
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useModelStore } from '@/stores/modelStore';
import type { Table } from '@/types/table';
import type { Relationship } from '@/types/relationship';
import type { Domain } from '@/types/workspace';

describe('ModelStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useModelStore.getState().setTables([]);
    useModelStore.getState().setRelationships([]);
    useModelStore.getState().setDomains([]);
    useModelStore.getState().setSelectedTable(null);
    useModelStore.getState().setSelectedRelationship(null);
    useModelStore.getState().setSelectedDomain(null);
  });

  describe('Table management', () => {
    it('should add a table', () => {
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

      useModelStore.getState().addTable(table);
      expect(useModelStore.getState().tables).toHaveLength(1);
      expect(useModelStore.getState().tables[0]).toEqual(table);
    });

    it('should update a table', () => {
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

      useModelStore.getState().addTable(table);
      useModelStore.getState().updateTable('table-1', { position_x: 200, position_y: 200 });

      const updated = useModelStore.getState().tables.find((t) => t.id === 'table-1');
      expect(updated?.position_x).toBe(200);
      expect(updated?.position_y).toBe(200);
    });

    it('should remove a table', () => {
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

      useModelStore.getState().addTable(table);
      useModelStore.getState().setSelectedTable('table-1');
      useModelStore.getState().removeTable('table-1');

      expect(useModelStore.getState().tables).toHaveLength(0);
      expect(useModelStore.getState().selectedTableId).toBeNull();
    });
  });

  describe('Relationship management', () => {
    it('should add a relationship', () => {
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

      useModelStore.getState().addRelationship(relationship);
      expect(useModelStore.getState().relationships).toHaveLength(1);
      expect(useModelStore.getState().relationships[0]).toEqual(relationship);
    });

    it('should update a relationship', () => {
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

      useModelStore.getState().addRelationship(relationship);
      useModelStore.getState().updateRelationship('rel-1', { type: 'many-to-many', source_cardinality: 'N', target_cardinality: 'N' });

      const updated = useModelStore.getState().relationships.find((r) => r.id === 'rel-1');
      expect(updated?.type).toBe('many-to-many');
      expect(updated?.source_cardinality).toBe('N');
    });

    it('should remove a relationship', () => {
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

      useModelStore.getState().addRelationship(relationship);
      useModelStore.getState().setSelectedRelationship('rel-1');
      useModelStore.getState().removeRelationship('rel-1');

      expect(useModelStore.getState().relationships).toHaveLength(0);
      expect(useModelStore.getState().selectedRelationshipId).toBeNull();
    });
  });

  describe('Domain management', () => {
    it('should set domains', () => {
      const domains: Domain[] = [
        {
          id: 'domain-1',
          workspace_id: 'workspace-1',
          name: 'Conceptual',
          model_type: 'conceptual',
          is_primary: true,
          created_at: '2025-01-01T00:00:00Z',
          last_modified_at: '2025-01-01T00:00:00Z',
        },
      ];

      useModelStore.getState().setDomains(domains);
      expect(useModelStore.getState().domains).toEqual(domains);
    });
  });

  describe('Selection management', () => {
    it('should set selected table', () => {
      useModelStore.getState().setSelectedTable('table-1');
      expect(useModelStore.getState().selectedTableId).toBe('table-1');
    });

    it('should set selected relationship', () => {
      useModelStore.getState().setSelectedRelationship('rel-1');
      expect(useModelStore.getState().selectedRelationshipId).toBe('rel-1');
    });

    it('should set selected domain', () => {
      useModelStore.getState().setSelectedDomain('domain-1');
      expect(useModelStore.getState().selectedDomainId).toBe('domain-1');
    });
  });
});

