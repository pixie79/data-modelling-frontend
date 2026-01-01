/**
 * Integration tests for ODCS Service
 * Tests ODCS format save/load operations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { odcsService } from '@/services/sdk/odcsService';
import { sdkLoader } from '@/services/sdk/sdkLoader';
import { sdkModeDetector } from '@/services/sdk/sdkMode';
import { apiClient } from '@/services/api/apiClient';
import type { Table } from '@/types/table';
import type { Relationship } from '@/types/relationship';

vi.mock('@/services/sdk/sdkLoader');
vi.mock('@/services/sdk/sdkMode');
vi.mock('@/services/api/apiClient');

describe('ODCSService Integration', () => {
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
    
    // Mock API client
    vi.mocked(apiClient.getClient).mockReturnValue({
      post: vi.fn().mockResolvedValue({
        data: {
          tables: mockTables,
          errors: [],
        },
      }),
      get: vi.fn().mockResolvedValue({
        data: 'workspace:\n  name: Test Workspace\n  tables:\n    - name: Users',
      }),
    } as any);
  });

  it('should save workspace to ODCS 3.1.0 format', async () => {
    const workspace = {
      workspace_id: 'workspace-1',
      domain_id: 'domain-1',
      tables: mockTables,
      relationships: mockRelationships,
    };

    vi.mocked(sdkModeDetector.getMode).mockResolvedValue('online');
    
    const yaml = await odcsService.toYAML(workspace);
    
    expect(yaml).toBeDefined();
    expect(typeof yaml).toBe('string');
    expect(apiClient.getClient().get).toHaveBeenCalled();
  });

  it('should load workspace from ODCS 3.1.0 format', async () => {
    const yamlContent = `
workspace:
  name: Test Workspace
  id: workspace-1
tables:
  - name: Users
    id: table-1
    columns:
      - name: id
        data_type: UUID
    `;

    vi.mocked(sdkModeDetector.getMode).mockResolvedValue('online');
    
    const result = await odcsService.parseYAML(yamlContent);
    
    expect(result).toBeDefined();
    expect(result.tables).toBeDefined();
    expect(result.tables.length).toBeGreaterThan(0);
    expect(apiClient.getClient().post).toHaveBeenCalledWith(
      '/api/v1/import/odcl/text',
      { odcl_text: yamlContent }
    );
  });

  it('should validate ODCS format before loading', async () => {
    const invalidYaml = 'invalid: yaml: [';

    vi.mocked(sdkModeDetector.getMode).mockResolvedValue('online');
    vi.mocked(apiClient.getClient().post).mockRejectedValue(new Error('Invalid YAML format'));
    
    await expect(odcsService.parseYAML(invalidYaml)).rejects.toThrow('Failed to parse ODCS YAML via API');
  });
});

