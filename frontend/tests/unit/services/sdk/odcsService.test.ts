/**
 * Unit tests for ODCS Service
 * Tests ODCS format parsing and conversion
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { odcsService } from '@/services/sdk/odcsService';
import { sdkLoader } from '@/services/sdk/sdkLoader';
import { sdkModeDetector } from '@/services/sdk/sdkMode';
import { apiClient } from '@/services/api/apiClient';
import type { Table } from '@/types/table';

vi.mock('@/services/sdk/sdkLoader');
vi.mock('@/services/sdk/sdkMode');
vi.mock('@/services/api/apiClient');

describe('ODCSService', () => {
  const mockTables: Table[] = [
    {
      id: 'table-1',
      workspace_id: 'workspace-1',
      primary_domain_id: 'domain-1',
      name: 'Users',
      model_type: 'conceptual',
      columns: [],
      position_x: 0,
      position_y: 0,
      width: 200,
      height: 150,
      visible_domains: ['domain-1'],
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
        data: 'workspace:\n  name: Test Workspace\n  tables: []',
      }),
    } as any);
  });

  describe('parseYAML', () => {
    it('should parse ODCS YAML content to workspace object', async () => {
      const yamlContent = 'workspace:\n  name: Test Workspace\n  tables: []';

      vi.mocked(sdkModeDetector.getMode).mockResolvedValue('online');
      
      const result = await odcsService.parseYAML(yamlContent);
      
      expect(result).toBeDefined();
      expect(result.tables).toBeDefined();
      expect(apiClient.getClient().post).toHaveBeenCalledWith(
        '/api/v1/import/odcl/text',
        { odcl_text: yamlContent }
      );
    });

    it('should handle invalid YAML format', async () => {
      const invalidYaml = 'invalid: yaml: content: [';

      vi.mocked(sdkModeDetector.getMode).mockResolvedValue('online');
      vi.mocked(apiClient.getClient().post).mockRejectedValue(new Error('Invalid YAML format'));
      
      await expect(odcsService.parseYAML(invalidYaml)).rejects.toThrow('Failed to parse ODCS YAML via API');
    });
  });

  describe('toYAML', () => {
    it('should convert workspace object to ODCS YAML format', async () => {
      const workspace = {
        workspace_id: 'workspace-1',
        domain_id: 'domain-1',
        name: 'Test Workspace',
        tables: mockTables,
      };

      vi.mocked(sdkModeDetector.getMode).mockResolvedValue('online');
      
      const result = await odcsService.toYAML(workspace as any);
      
      expect(typeof result).toBe('string');
      expect(apiClient.getClient().get).toHaveBeenCalledWith(
        `/api/v1/workspaces/${workspace.workspace_id}/domains/${workspace.domain_id}/export`,
        expect.objectContaining({
          params: expect.objectContaining({ format: 'odcl' }),
        })
      );
    });
  });

  describe('validate', () => {
    it('should validate ODCS format', async () => {
      const odcsContent = 'workspace:\n  name: Test';

      vi.mocked(sdkModeDetector.getMode).mockResolvedValue('online');
      
      const result = await odcsService.validate(odcsContent);
      
      expect(result.valid).toBe(true);
      expect(Array.isArray(result.errors)).toBe(true);
    });

    it('should return errors for invalid ODCS format', async () => {
      const invalidContent = 'invalid content';

      vi.mocked(sdkModeDetector.getMode).mockResolvedValue('online');
      vi.mocked(apiClient.getClient().post).mockRejectedValue(new Error('Invalid format'));
      
      const result = await odcsService.validate(invalidContent);
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  // Note: importFromFormat and exportToFormat methods don't exist in odcsService
  // These are handled by importExportService instead
});

