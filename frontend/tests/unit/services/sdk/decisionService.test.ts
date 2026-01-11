/**
 * Unit tests for Decision Service
 * Tests MADR Architecture Decision Records via SDK 1.14.0+
 * Updated for in-memory API (WASM works with YAML strings, not file paths)
 * Updated for type converter patterns (SDK camelCase ↔ frontend snake_case)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { decisionService } from '@/services/sdk/decisionService';
import { sdkLoader } from '@/services/sdk/sdkLoader';
import { DecisionStatus, DecisionCategory } from '@/types/decision';
import type { Decision, DecisionIndex } from '@/types/decision';

// Mock sdkLoader
vi.mock('@/services/sdk/sdkLoader', () => ({
  sdkLoader: {
    hasDecisionSupport: vi.fn(),
    hasMarkdownExport: vi.fn(),
    hasPDFExport: vi.fn(),
    load: vi.fn(),
  },
}));

describe('DecisionService', () => {
  // Frontend format (snake_case) - what the service returns
  const mockDecision: Decision = {
    id: 'decision-1',
    number: 1,
    title: 'Use React for Frontend',
    status: DecisionStatus.Accepted,
    category: DecisionCategory.Technology,
    context: 'We need to choose a frontend framework',
    decision: 'We will use React for our frontend',
    consequences: 'Need to train team on React',
    options: [
      {
        title: 'React',
        description: 'Popular component library',
        pros: ['Large ecosystem', 'Good documentation'],
        cons: ['Learning curve'],
      },
    ],
    domain_id: 'domain-1',
    authors: ['John Doe'],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  // SDK format (camelCase) - what the SDK returns
  const mockSDKDecision = {
    id: 'decision-1',
    number: 1,
    title: 'Use React for Frontend',
    status: 'accepted',
    category: 'technology',
    context: 'We need to choose a frontend framework',
    decision: 'We will use React for our frontend',
    consequences: 'Need to train team on React',
    options: [
      {
        name: 'React',
        description: 'Popular component library',
        pros: ['Large ecosystem', 'Good documentation'],
        cons: ['Learning curve'],
      },
    ],
    domainId: 'domain-1',
    workspaceId: null,
    supersededBy: null,
    supersedes: null,
    relatedDecisions: [],
    relatedKnowledge: [],
    authors: ['John Doe'],
    deciders: [],
    consulted: [],
    informed: [],
    tags: [],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    decidedAt: null,
  };

  // Frontend format (snake_case)
  const mockDecisionIndex: DecisionIndex = {
    workspace_id: 'workspace-1',
    decisions: [
      {
        id: 'decision-1',
        number: 1,
        title: 'Use React for Frontend',
        status: DecisionStatus.Accepted,
        category: DecisionCategory.Technology,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
    ],
    last_updated: '2024-01-01T00:00:00Z',
  };

  // SDK format (camelCase)
  const mockSDKDecisionIndex = {
    workspaceId: 'workspace-1',
    decisions: [
      {
        id: 'decision-1',
        number: 1,
        title: 'Use React for Frontend',
        status: 'accepted',
        category: 'technology',
        domainId: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
    ],
    lastUpdated: '2024-01-01T00:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isSupported', () => {
    it('should return true when SDK has decision support', () => {
      vi.mocked(sdkLoader.hasDecisionSupport).mockReturnValue(true);
      expect(decisionService.isSupported()).toBe(true);
    });

    it('should return false when SDK does not have decision support', () => {
      vi.mocked(sdkLoader.hasDecisionSupport).mockReturnValue(false);
      expect(decisionService.isSupported()).toBe(false);
    });
  });

  describe('parseDecisionYaml', () => {
    it('should return null when SDK is not supported', async () => {
      vi.mocked(sdkLoader.hasDecisionSupport).mockReturnValue(false);

      const result = await decisionService.parseDecisionYaml('yaml content');

      expect(result).toBeNull();
    });

    it('should parse decision YAML successfully', async () => {
      vi.mocked(sdkLoader.hasDecisionSupport).mockReturnValue(true);
      // SDK returns camelCase data
      vi.mocked(sdkLoader.load).mockResolvedValue({
        parse_decision_yaml: vi.fn().mockReturnValue(JSON.stringify(mockSDKDecision)),
      } as unknown as ReturnType<typeof sdkLoader.load>);

      const result = await decisionService.parseDecisionYaml('yaml content');

      // Service converts to snake_case
      expect(result?.id).toBe('decision-1');
      expect(result?.title).toBe('Use React for Frontend');
      expect(result?.status).toBe(DecisionStatus.Accepted);
      expect(result?.domain_id).toBe('domain-1');
      expect(result?.created_at).toBe('2024-01-01T00:00:00Z');
    });

    it('should return null when parse method is not available', async () => {
      vi.mocked(sdkLoader.hasDecisionSupport).mockReturnValue(true);
      vi.mocked(sdkLoader.load).mockResolvedValue(
        {} as unknown as ReturnType<typeof sdkLoader.load>
      );

      const result = await decisionService.parseDecisionYaml('yaml content');

      expect(result).toBeNull();
    });

    it('should return null on parse error', async () => {
      vi.mocked(sdkLoader.hasDecisionSupport).mockReturnValue(true);
      vi.mocked(sdkLoader.load).mockResolvedValue({
        parse_decision_yaml: vi.fn().mockReturnValue(JSON.stringify({ error: 'Parse error' })),
      } as unknown as ReturnType<typeof sdkLoader.load>);

      const result = await decisionService.parseDecisionYaml('invalid yaml');

      expect(result).toBeNull();
    });
  });

  describe('parseDecisionIndexYaml', () => {
    it('should return null when SDK is not supported', async () => {
      vi.mocked(sdkLoader.hasDecisionSupport).mockReturnValue(false);

      const result = await decisionService.parseDecisionIndexYaml('yaml content');

      expect(result).toBeNull();
    });

    it('should parse decision index YAML successfully', async () => {
      vi.mocked(sdkLoader.hasDecisionSupport).mockReturnValue(true);
      // SDK returns camelCase data
      vi.mocked(sdkLoader.load).mockResolvedValue({
        parse_decision_index_yaml: vi.fn().mockReturnValue(JSON.stringify(mockSDKDecisionIndex)),
      } as unknown as ReturnType<typeof sdkLoader.load>);

      const result = await decisionService.parseDecisionIndexYaml('yaml content');

      // Service converts to snake_case
      expect(result?.workspace_id).toBe('workspace-1');
      expect(result?.last_updated).toBe('2024-01-01T00:00:00Z');
      expect(result?.decisions).toHaveLength(1);
      expect(result?.decisions[0]?.id).toBe('decision-1');
    });
  });

  describe('exportDecisionToYaml', () => {
    it('should throw error when SDK is not supported', async () => {
      vi.mocked(sdkLoader.hasDecisionSupport).mockReturnValue(false);

      await expect(decisionService.exportDecisionToYaml(mockDecision)).rejects.toThrow(
        'Decision features require SDK 1.14.0+'
      );
    });

    it('should export decision to YAML successfully', async () => {
      vi.mocked(sdkLoader.hasDecisionSupport).mockReturnValue(true);
      const mockExport = vi.fn().mockReturnValue('decision: yaml');
      vi.mocked(sdkLoader.load).mockResolvedValue({
        export_decision_to_yaml: mockExport,
      } as unknown as ReturnType<typeof sdkLoader.load>);

      const result = await decisionService.exportDecisionToYaml(mockDecision);

      expect(result).toBe('decision: yaml');
      // Service converts to camelCase for SDK
      expect(mockExport).toHaveBeenCalled();
      // Verify it was called with a JSON string containing camelCase keys
      const calledArg = mockExport.mock.calls[0][0];
      const parsedArg = JSON.parse(calledArg);
      expect(parsedArg.domainId).toBeDefined(); // camelCase key
    });
  });

  describe('exportDecisionToMarkdown', () => {
    it('should use SDK export when available', async () => {
      vi.mocked(sdkLoader.hasDecisionSupport).mockReturnValue(true);
      vi.mocked(sdkLoader.hasMarkdownExport).mockReturnValue(true);
      const mockExport = vi.fn().mockReturnValue('# ADR Markdown');
      vi.mocked(sdkLoader.load).mockResolvedValue({
        export_decision_to_markdown: mockExport,
      } as unknown as ReturnType<typeof sdkLoader.load>);

      const result = await decisionService.exportDecisionToMarkdown(mockDecision);

      expect(result).toBe('# ADR Markdown');
    });

    it('should fallback to client-side markdown generation when SDK not available', async () => {
      vi.mocked(sdkLoader.hasDecisionSupport).mockReturnValue(false);
      vi.mocked(sdkLoader.hasMarkdownExport).mockReturnValue(false);

      const result = await decisionService.exportDecisionToMarkdown(mockDecision);

      expect(result).toContain('# 0001. Use React for Frontend');
      expect(result).toContain('**Status:** accepted');
      expect(result).toContain('## Context');
      expect(result).toContain('## Decision');
    });

    it('should fallback to client-side on SDK export failure', async () => {
      vi.mocked(sdkLoader.hasDecisionSupport).mockReturnValue(true);
      vi.mocked(sdkLoader.hasMarkdownExport).mockReturnValue(true);
      vi.mocked(sdkLoader.load).mockResolvedValue({
        export_decision_to_markdown: vi.fn().mockImplementation(() => {
          throw new Error('SDK error');
        }),
      } as unknown as ReturnType<typeof sdkLoader.load>);

      const result = await decisionService.exportDecisionToMarkdown(mockDecision);

      expect(result).toContain('# 0001. Use React for Frontend');
    });
  });

  describe('findDecisionById', () => {
    const decisions = [mockDecision, { ...mockDecision, id: 'decision-2', number: 2 }];

    it('should find decision by ID', () => {
      const result = decisionService.findDecisionById(decisions, 'decision-1');
      expect(result?.id).toBe('decision-1');
    });

    it('should return null for non-existent ID', () => {
      const result = decisionService.findDecisionById(decisions, 'non-existent');
      expect(result).toBeNull();
    });
  });

  describe('filterDecisions', () => {
    const mockDecisions: Decision[] = [
      {
        ...mockDecision,
        id: 'decision-1',
        status: DecisionStatus.Accepted,
        category: DecisionCategory.Technology,
      },
      {
        ...mockDecision,
        id: 'decision-2',
        status: DecisionStatus.Draft,
        category: DecisionCategory.Architecture,
        title: 'Database Choice',
      },
      {
        ...mockDecision,
        id: 'decision-3',
        status: DecisionStatus.Proposed,
        category: DecisionCategory.Security,
        domain_id: 'domain-2',
      },
    ];

    it('should filter by status', () => {
      const result = decisionService.filterDecisions(mockDecisions, {
        status: [DecisionStatus.Draft],
      });

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('decision-2');
    });

    it('should filter by category', () => {
      const result = decisionService.filterDecisions(mockDecisions, {
        category: [DecisionCategory.Security],
      });

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('decision-3');
    });

    it('should filter by domain_id', () => {
      const result = decisionService.filterDecisions(mockDecisions, {
        domain_id: 'domain-2',
      });

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('decision-3');
    });

    it('should filter by search term', () => {
      const result = decisionService.filterDecisions(mockDecisions, {
        search: 'Database',
      });

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('decision-2');
    });

    it('should combine multiple filters', () => {
      const result = decisionService.filterDecisions(mockDecisions, {
        status: [DecisionStatus.Accepted, DecisionStatus.Proposed],
        domain_id: 'domain-1',
      });

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('decision-1');
    });
  });

  describe('createDecision', () => {
    it('should create decision with auto-generated fields', () => {
      const result = decisionService.createDecision(
        {
          title: 'New Decision',
          category: DecisionCategory.Architecture,
          context: 'Test context',
          decision: 'Test decision',
        },
        5
      );

      expect(result.id).toBeDefined();
      expect(result.number).toBe(5);
      expect(result.title).toBe('New Decision');
      expect(result.status).toBe(DecisionStatus.Draft);
      expect(result.created_at).toBeDefined();
      expect(result.updated_at).toBeDefined();
    });

    it('should generate timestamp-based number when not provided', () => {
      const result = decisionService.createDecision({
        title: 'New Decision',
        category: DecisionCategory.Architecture,
        context: 'Test context',
        decision: 'Test decision',
      });

      // Number should be timestamp-based (YYMMDDHHmm format - 10 digits)
      expect(result.number).toBeGreaterThan(2000000000);
      expect(result.number.toString()).toHaveLength(10);
    });
  });

  describe('updateDecision', () => {
    it('should update decision preserving id and number', () => {
      const result = decisionService.updateDecision(mockDecision, {
        title: 'Updated Title',
      });

      expect(result.id).toBe('decision-1');
      expect(result.number).toBe(1);
      expect(result.title).toBe('Updated Title');
      expect(result.updated_at).not.toBe(mockDecision.updated_at);
    });

    it('should preserve created_at', () => {
      const result = decisionService.updateDecision(mockDecision, {
        title: 'Updated Title',
        created_at: '2025-01-01T00:00:00Z', // Attempt to override
      });

      expect(result.created_at).toBe(mockDecision.created_at);
    });
  });

  describe('changeStatus', () => {
    it('should throw error for invalid status transition', () => {
      // Accepted -> Draft is not valid
      expect(() => decisionService.changeStatus(mockDecision, DecisionStatus.Draft)).toThrow(
        'Invalid status transition'
      );
    });

    it('should require supersededById when superseding', () => {
      expect(() => decisionService.changeStatus(mockDecision, DecisionStatus.Superseded)).toThrow(
        'supersededById is required'
      );
    });

    it('should change status successfully', () => {
      const proposedDecision = { ...mockDecision, status: DecisionStatus.Proposed };

      const result = decisionService.changeStatus(proposedDecision, DecisionStatus.Accepted);

      expect(result.status).toBe(DecisionStatus.Accepted);
      expect(result.decided_at).toBeDefined();
    });

    it('should set superseded_by when superseding', () => {
      const result = decisionService.changeStatus(
        mockDecision,
        DecisionStatus.Superseded,
        'decision-2'
      );

      expect(result.status).toBe(DecisionStatus.Superseded);
      expect(result.superseded_by).toBe('decision-2');
    });
  });

  describe('createIndexEntry', () => {
    it('should create index entry from decision', () => {
      const result = decisionService.createIndexEntry(mockDecision);

      expect(result.id).toBe(mockDecision.id);
      expect(result.number).toBe(mockDecision.number);
      expect(result.title).toBe(mockDecision.title);
      expect(result.status).toBe(mockDecision.status);
      expect(result.category).toBe(mockDecision.category);
    });
  });

  describe('helper methods', () => {
    const mockDecisions: Decision[] = [
      { ...mockDecision, id: '1', status: DecisionStatus.Accepted },
      { ...mockDecision, id: '2', status: DecisionStatus.Draft },
      { ...mockDecision, id: '3', status: DecisionStatus.Proposed },
    ];

    it('should get decisions by status', () => {
      const result = decisionService.getDecisionsByStatus(mockDecisions, DecisionStatus.Draft);

      expect(result).toHaveLength(1);
      expect(result[0]?.status).toBe(DecisionStatus.Draft);
    });

    it('should get accepted decisions', () => {
      const result = decisionService.getAcceptedDecisions(mockDecisions);

      expect(result).toHaveLength(1);
      expect(result[0]?.status).toBe(DecisionStatus.Accepted);
    });

    it('should get draft decisions', () => {
      const result = decisionService.getDraftDecisions(mockDecisions);

      expect(result).toHaveLength(1);
      expect(result[0]?.status).toBe(DecisionStatus.Draft);
    });

    it('should get proposed decisions', () => {
      const result = decisionService.getProposedDecisions(mockDecisions);

      expect(result).toHaveLength(1);
      expect(result[0]?.status).toBe(DecisionStatus.Proposed);
    });
  });

  describe('SDK integration methods', () => {
    describe('createDecisionViaSDK', () => {
      it('should return null when SDK is not supported', async () => {
        vi.mocked(sdkLoader.hasDecisionSupport).mockReturnValue(false);

        const result = await decisionService.createDecisionViaSDK(
          1,
          'Title',
          'Context',
          'Decision'
        );

        expect(result).toBeNull();
      });

      it('should create decision via SDK', async () => {
        vi.mocked(sdkLoader.hasDecisionSupport).mockReturnValue(true);
        // SDK returns camelCase
        vi.mocked(sdkLoader.load).mockResolvedValue({
          create_decision: vi.fn().mockReturnValue(JSON.stringify(mockSDKDecision)),
        } as unknown as ReturnType<typeof sdkLoader.load>);

        const result = await decisionService.createDecisionViaSDK(
          1,
          'Title',
          'Context',
          'Decision'
        );

        // Service converts to snake_case
        expect(result?.id).toBe('decision-1');
        expect(result?.domain_id).toBe('domain-1');
        expect(result?.created_at).toBe('2024-01-01T00:00:00Z');
      });
    });

    describe('addDecisionToIndex', () => {
      it('should return null when SDK is not supported', async () => {
        vi.mocked(sdkLoader.hasDecisionSupport).mockReturnValue(false);

        const result = await decisionService.addDecisionToIndex(
          mockDecisionIndex,
          mockDecision,
          'adr-0001.yaml'
        );

        expect(result).toBeNull();
      });

      it('should add decision to index via SDK', async () => {
        // SDK returns camelCase
        const updatedSDKIndex = { ...mockSDKDecisionIndex };
        vi.mocked(sdkLoader.hasDecisionSupport).mockReturnValue(true);
        vi.mocked(sdkLoader.load).mockResolvedValue({
          add_decision_to_index: vi.fn().mockReturnValue(JSON.stringify(updatedSDKIndex)),
        } as unknown as ReturnType<typeof sdkLoader.load>);

        const result = await decisionService.addDecisionToIndex(
          mockDecisionIndex,
          mockDecision,
          'adr-0001.yaml'
        );

        // Service converts to snake_case
        expect(result?.workspace_id).toBe('workspace-1');
        expect(result?.last_updated).toBe('2024-01-01T00:00:00Z');
      });
    });
  });
});
