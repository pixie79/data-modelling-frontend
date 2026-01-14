/**
 * WorkspaceV2Loader Tests
 * Tests for loading flat file format (workspace/v2) workspaces
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkspaceV2Loader } from '@/services/storage/workspaceV2Loader';

// Mock the SDK services
vi.mock('@/services/sdk/odcsService', () => ({
  odcsService: {
    parseYAML: vi.fn().mockImplementation(async (content: string) => {
      // Simple YAML parsing simulation for ODCS files
      const lines = content.split('\n');
      const idLine = lines.find((l) => l.startsWith('id:'));
      const nameLine = lines.find((l) => l.startsWith('name:'));
      const tagsLine = lines.find((l) => l.startsWith('tags:'));

      const id = idLine?.replace('id:', '').trim() || 'test-id';
      const name = nameLine?.replace('name:', '').trim() || 'test-table';

      // Parse tags array
      const tags: string[] = [];
      if (tagsLine) {
        const tagsIndex = lines.indexOf(tagsLine);
        for (let i = tagsIndex + 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line.startsWith('-')) {
            tags.push(line.replace('-', '').trim());
          } else if (!line.startsWith(' ')) {
            break;
          }
        }
      }

      return {
        tables: [
          {
            id,
            name,
            tags,
            columns: [],
            data_level: tags
              .find((t) => t.toLowerCase().startsWith('dm_level:'))
              ?.split(':')[1]
              ?.toLowerCase(),
          },
        ],
      };
    }),
  },
}));

vi.mock('@/services/sdk/odpsService', () => ({
  odpsService: {
    parseYAML: vi.fn().mockResolvedValue({ id: 'test-product', name: 'Test Product' }),
  },
}));

vi.mock('@/services/sdk/cadsService', () => ({
  cadsService: {
    parseYAML: vi.fn().mockResolvedValue({ id: 'test-asset', name: 'Test Asset' }),
  },
}));

vi.mock('@/services/sdk/bpmnService', () => ({
  bpmnService: {
    parseXML: vi.fn().mockResolvedValue({ id: 'test-process', name: 'Test Process' }),
  },
}));

vi.mock('@/services/sdk/dmnService', () => ({
  dmnService: {
    parseXML: vi.fn().mockResolvedValue({ id: 'test-dmn', name: 'Test DMN' }),
  },
}));

vi.mock('@/services/sdk/knowledgeService', () => ({
  knowledgeService: {
    parseKnowledgeYaml: vi.fn().mockResolvedValue({ id: 'test-kb', title: 'Test KB' }),
  },
}));

vi.mock('@/services/sdk/decisionService', () => ({
  decisionService: {
    parseDecisionYaml: vi.fn().mockResolvedValue({ id: 'test-adr', title: 'Test ADR' }),
  },
}));

describe('WorkspaceV2Loader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loadFromStringFiles', () => {
    it('should load systems with table_ids from workspace.yaml', async () => {
      const files = [
        {
          name: 'test.workspace.yaml',
          content: `
id: workspace-123
name: test-workspace
domains:
  - id: domain-123
    name: test-domain
    systems:
      - id: system-123
        name: Test System
        table_ids:
          - table-123
          - table-456
`,
        },
        {
          name: 'odcs/test-workspace_test-domain_table1.odcs.yaml',
          content: `
id: table-123
name: Table 1
tags:
  - dm_level:Gold
`,
        },
        {
          name: 'odcs/test-workspace_test-domain_table2.odcs.yaml',
          content: `
id: table-456
name: Table 2
tags:
  - dm_level:Bronze
`,
        },
      ];

      const workspace = await WorkspaceV2Loader.loadFromStringFiles(files);

      // Verify systems are loaded with table_ids
      expect(workspace.systems).toBeDefined();
      expect((workspace as any).systems).toHaveLength(1);
      expect((workspace as any).systems[0].table_ids).toEqual(['table-123', 'table-456']);
      expect((workspace as any).systems[0].domain_id).toBe('domain-123');
    });

    it('should set domain_id on systems correctly', async () => {
      const files = [
        {
          name: 'test.workspace.yaml',
          content: `
id: workspace-123
name: test-workspace
domains:
  - id: domain-abc
    name: my-domain
    systems:
      - id: system-xyz
        name: My System
        table_ids:
          - table-1
`,
        },
        {
          name: 'odcs/test-workspace_my-domain_table.odcs.yaml',
          content: `
id: table-1
name: Test Table
`,
        },
      ];

      const workspace = await WorkspaceV2Loader.loadFromStringFiles(files);

      expect((workspace as any).systems[0].domain_id).toBe('domain-abc');
    });

    it('should load view_positions from workspace.yaml into domains', async () => {
      const files = [
        {
          name: 'test.workspace.yaml',
          content: `
id: workspace-123
name: test-workspace
domains:
  - id: domain-123
    name: test-domain
    systems:
      - id: system-123
        name: Test System
        table_ids: []
    view_positions:
      systems:
        system-123:
          x: 100
          y: 200
      process:
        table-123:
          x: 300
          y: 400
`,
        },
      ];

      const workspace = await WorkspaceV2Loader.loadFromStringFiles(files);

      // Verify view_positions are loaded into domains
      expect(workspace.domains).toBeDefined();
      expect(workspace.domains).toHaveLength(1);
      expect(workspace.domains[0].view_positions).toBeDefined();
      expect(workspace.domains[0].view_positions?.systems?.['system-123']).toEqual({
        x: 100,
        y: 200,
      });
      expect(workspace.domains[0].view_positions?.process?.['table-123']).toEqual({
        x: 300,
        y: 400,
      });
    });

    it('should load knowledge articles from kb subdirectory', async () => {
      const files = [
        {
          name: 'test.workspace.yaml',
          content: `
id: workspace-123
name: test-workspace
domains:
  - id: domain-123
    name: test-domain
    systems: []
`,
        },
        {
          name: 'kb/test-workspace_test-domain_article.kb.yaml',
          content: `
id: kb-123
title: Test Article
`,
        },
      ];

      const workspace = await WorkspaceV2Loader.loadFromStringFiles(files);

      expect((workspace as any).knowledgeArticles).toBeDefined();
      expect((workspace as any).knowledgeArticles).toHaveLength(1);
    });

    it('should load ADR decision records from adr subdirectory', async () => {
      const files = [
        {
          name: 'test.workspace.yaml',
          content: `
id: workspace-123
name: test-workspace
domains:
  - id: domain-123
    name: test-domain
    systems: []
`,
        },
        {
          name: 'adr/test-workspace_test-domain_decision.adr.yaml',
          content: `
id: adr-123
title: Test Decision
`,
        },
      ];

      const workspace = await WorkspaceV2Loader.loadFromStringFiles(files);

      expect((workspace as any).decisionRecords).toBeDefined();
      expect((workspace as any).decisionRecords).toHaveLength(1);
    });

    it('should set primary_system_id on tables when linked to a system', async () => {
      const files = [
        {
          name: 'test.workspace.yaml',
          content: `
id: workspace-123
name: test-workspace
domains:
  - id: domain-123
    name: test-domain
    systems:
      - id: system-123
        name: Test System
        table_ids:
          - table-123
`,
        },
        {
          name: 'odcs/test-workspace_test-domain_table.odcs.yaml',
          content: `
id: table-123
name: Test Table
`,
        },
      ];

      const workspace = await WorkspaceV2Loader.loadFromStringFiles(files);

      // Verify tables have primary_system_id set
      expect((workspace as any).tables).toHaveLength(1);
      expect((workspace as any).tables[0].primary_system_id).toBe('system-123');
    });

    it('should preserve data_level extracted from dm_level tag', async () => {
      const files = [
        {
          name: 'test.workspace.yaml',
          content: `
id: workspace-123
name: test-workspace
domains:
  - id: domain-123
    name: test-domain
    systems: []
`,
        },
        {
          name: 'odcs/test-workspace_test-domain_gold_table.odcs.yaml',
          content: `
id: table-gold
name: Gold Table
tags:
  - dm_level:Gold
`,
        },
        {
          name: 'odcs/test-workspace_test-domain_bronze_table.odcs.yaml',
          content: `
id: table-bronze
name: Bronze Table
tags:
  - dm_level:Bronze
`,
        },
      ];

      const workspace = await WorkspaceV2Loader.loadFromStringFiles(files);

      expect((workspace as any).tables).toHaveLength(2);
      const goldTable = (workspace as any).tables.find((t: any) => t.id === 'table-gold');
      const bronzeTable = (workspace as any).tables.find((t: any) => t.id === 'table-bronze');

      expect(goldTable?.data_level).toBe('gold');
      expect(bronzeTable?.data_level).toBe('bronze');
    });
  });
});
