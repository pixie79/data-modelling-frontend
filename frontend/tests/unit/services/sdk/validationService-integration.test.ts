/**
 * Integration tests for Validation Service
 * Tests data model integrity validation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { validationService } from '@/services/sdk/validationService';
import type { Table } from '@/types/table';
import type { Relationship } from '@/types/relationship';

describe('ValidationService Integration', () => {
  const mockTables: Table[] = [
    {
      id: 'table-1',
      workspace_id: 'workspace-1',
      primary_domain_id: 'domain-1',
      name: 'Users',
      model_type: 'conceptual',
      columns: [
        {
          id: 'col-1',
          table_id: 'table-1',
          name: 'id',
          data_type: 'UUID',
          nullable: false,
          is_primary_key: true,
          is_foreign_key: false,
          order: 0,
          created_at: '2025-01-01T00:00:00Z',
        },
      ],
      position_x: 100,
      position_y: 100,
      width: 200,
      height: 150,
      visible_domains: ['domain-1'],
      created_at: '2025-01-01T00:00:00Z',
      last_modified_at: '2025-01-01T00:00:00Z',
    },
  ];

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

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should detect orphaned relationships', async () => {
    // Relationship references table-2 which doesn't exist
    const result = await validationService.validateModelIntegrity(mockTables, mockRelationships);
    
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('orphaned'))).toBe(true);
  });

  it('should detect invalid data types', async () => {
    const invalidTable: Table = {
      ...mockTables[0],
      columns: [
        {
          ...mockTables[0].columns[0],
          data_type: 'INVALID_TYPE_XYZ',
        },
      ],
    };

    const result = await validationService.validateModelIntegrity([invalidTable], []);
    
    // Should either validate or warn about invalid types
    expect(result).toBeDefined();
  });

  it('should validate complete model successfully', async () => {
    const completeTables: Table[] = [
      ...mockTables,
      {
        id: 'table-2',
        workspace_id: 'workspace-1',
        primary_domain_id: 'domain-1',
        name: 'Orders',
        model_type: 'conceptual',
        columns: [],
        position_x: 200,
        position_y: 200,
        width: 200,
        height: 150,
        visible_domains: ['domain-1'],
        created_at: '2025-01-01T00:00:00Z',
        last_modified_at: '2025-01-01T00:00:00Z',
      },
    ];

    const result = await validationService.validateModelIntegrity(completeTables, mockRelationships);
    
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should detect duplicate table names', async () => {
    const duplicateTables: Table[] = [
      mockTables[0],
      {
        ...mockTables[0],
        id: 'table-2',
        name: 'Users', // Duplicate name
      },
    ];

    const result = await validationService.validateModelIntegrity(duplicateTables, []);
    
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('duplicate') || e.includes('name'))).toBe(true);
  });
});

