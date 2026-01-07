/**
 * Unit tests for Decision Service
 * Tests MADR Architecture Decision Records via SDK 1.13.1+
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
    load: vi.fn(),
  },
}));

describe('DecisionService', () => {
  const mockWorkspacePath = '/test/workspace';

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

  const mockDecisionIndex: DecisionIndex = {
    workspace_id: 'workspace-1',
    next_number: 2,
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

  describe('loadDecisions', () => {
    it('should return empty array when SDK is not supported', async () => {
      vi.mocked(sdkLoader.hasDecisionSupport).mockReturnValue(false);

      const result = await decisionService.loadDecisions(mockWorkspacePath);

      expect(result).toEqual([]);
    });

    it('should load decisions successfully', async () => {
      vi.mocked(sdkLoader.hasDecisionSupport).mockReturnValue(true);
      vi.mocked(sdkLoader.load).mockResolvedValue({
        load_decisions: vi.fn().mockReturnValue(JSON.stringify({ decisions: [mockDecision] })),
      } as unknown as ReturnType<typeof sdkLoader.load>);

      const result = await decisionService.loadDecisions(mockWorkspacePath);

      expect(result).toEqual([mockDecision]);
    });

    it('should return empty array when load_decisions method is not available', async () => {
      vi.mocked(sdkLoader.hasDecisionSupport).mockReturnValue(true);
      vi.mocked(sdkLoader.load).mockResolvedValue(
        {} as unknown as ReturnType<typeof sdkLoader.load>
      );

      const result = await decisionService.loadDecisions(mockWorkspacePath);

      expect(result).toEqual([]);
    });

    it('should handle SDK errors gracefully', async () => {
      vi.mocked(sdkLoader.hasDecisionSupport).mockReturnValue(true);
      vi.mocked(sdkLoader.load).mockResolvedValue({
        load_decisions: vi.fn().mockReturnValue(JSON.stringify({ error: 'SDK error' })),
      } as unknown as ReturnType<typeof sdkLoader.load>);

      const result = await decisionService.loadDecisions(mockWorkspacePath);

      expect(result).toEqual([]);
    });
  });

  describe('loadDecision', () => {
    it('should return null when decision is not found', async () => {
      vi.mocked(sdkLoader.hasDecisionSupport).mockReturnValue(true);
      vi.mocked(sdkLoader.load).mockResolvedValue({
        load_decisions: vi.fn().mockReturnValue(JSON.stringify({ decisions: [] })),
      } as unknown as ReturnType<typeof sdkLoader.load>);

      const result = await decisionService.loadDecision(mockWorkspacePath, 'non-existent');

      expect(result).toBeNull();
    });

    it('should return decision when found', async () => {
      vi.mocked(sdkLoader.hasDecisionSupport).mockReturnValue(true);
      vi.mocked(sdkLoader.load).mockResolvedValue({
        load_decisions: vi.fn().mockReturnValue(JSON.stringify({ decisions: [mockDecision] })),
      } as unknown as ReturnType<typeof sdkLoader.load>);

      const result = await decisionService.loadDecision(mockWorkspacePath, 'decision-1');

      expect(result).toEqual(mockDecision);
    });
  });

  describe('loadDecisionIndex', () => {
    it('should return null when SDK is not supported', async () => {
      vi.mocked(sdkLoader.hasDecisionSupport).mockReturnValue(false);

      const result = await decisionService.loadDecisionIndex(mockWorkspacePath);

      expect(result).toBeNull();
    });

    it('should load decision index successfully', async () => {
      vi.mocked(sdkLoader.hasDecisionSupport).mockReturnValue(true);
      vi.mocked(sdkLoader.load).mockResolvedValue({
        load_decision_index: vi.fn().mockReturnValue(JSON.stringify(mockDecisionIndex)),
      } as unknown as ReturnType<typeof sdkLoader.load>);

      const result = await decisionService.loadDecisionIndex(mockWorkspacePath);

      expect(result).toEqual(mockDecisionIndex);
    });
  });

  describe('loadDecisionsByDomain', () => {
    it('should return empty array when SDK is not supported', async () => {
      vi.mocked(sdkLoader.hasDecisionSupport).mockReturnValue(false);

      const result = await decisionService.loadDecisionsByDomain(mockWorkspacePath, 'domain-1');

      expect(result).toEqual([]);
    });

    it('should use SDK method when available', async () => {
      vi.mocked(sdkLoader.hasDecisionSupport).mockReturnValue(true);
      const mockLoadByDomain = vi
        .fn()
        .mockReturnValue(JSON.stringify({ decisions: [mockDecision] }));
      vi.mocked(sdkLoader.load).mockResolvedValue({
        load_decisions_by_domain: mockLoadByDomain,
      } as unknown as ReturnType<typeof sdkLoader.load>);

      const result = await decisionService.loadDecisionsByDomain(mockWorkspacePath, 'domain-1');

      expect(mockLoadByDomain).toHaveBeenCalledWith(mockWorkspacePath, 'domain-1');
      expect(result).toEqual([mockDecision]);
    });

    it('should fallback to client-side filtering when SDK method fails', async () => {
      vi.mocked(sdkLoader.hasDecisionSupport).mockReturnValue(true);
      vi.mocked(sdkLoader.load).mockResolvedValue({
        load_decisions_by_domain: vi.fn().mockImplementation(() => {
          throw new Error('SDK error');
        }),
        load_decisions: vi.fn().mockReturnValue(JSON.stringify({ decisions: [mockDecision] })),
      } as unknown as ReturnType<typeof sdkLoader.load>);

      const result = await decisionService.loadDecisionsByDomain(mockWorkspacePath, 'domain-1');

      expect(result).toEqual([mockDecision]);
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

    beforeEach(() => {
      vi.mocked(sdkLoader.hasDecisionSupport).mockReturnValue(true);
      vi.mocked(sdkLoader.load).mockResolvedValue({
        load_decisions: vi.fn().mockReturnValue(JSON.stringify({ decisions: mockDecisions })),
      } as unknown as ReturnType<typeof sdkLoader.load>);
    });

    it('should filter by status', async () => {
      const result = await decisionService.filterDecisions(mockWorkspacePath, {
        status: [DecisionStatus.Draft],
      });

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('decision-2');
    });

    it('should filter by category', async () => {
      const result = await decisionService.filterDecisions(mockWorkspacePath, {
        category: [DecisionCategory.Security],
      });

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('decision-3');
    });

    it('should filter by domain_id', async () => {
      const result = await decisionService.filterDecisions(mockWorkspacePath, {
        domain_id: 'domain-2',
      });

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('decision-3');
    });

    it('should filter by search term', async () => {
      const result = await decisionService.filterDecisions(mockWorkspacePath, {
        search: 'Database',
      });

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('decision-2');
    });

    it('should combine multiple filters', async () => {
      const result = await decisionService.filterDecisions(mockWorkspacePath, {
        status: [DecisionStatus.Accepted, DecisionStatus.Proposed],
        domain_id: 'domain-1',
      });

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('decision-1');
    });
  });

  describe('saveDecision', () => {
    it('should throw error when SDK is not supported', async () => {
      vi.mocked(sdkLoader.hasDecisionSupport).mockReturnValue(false);

      await expect(decisionService.saveDecision(mockWorkspacePath, mockDecision)).rejects.toThrow(
        'Decision features require SDK 1.13.1+'
      );
    });

    it('should save decision successfully', async () => {
      vi.mocked(sdkLoader.hasDecisionSupport).mockReturnValue(true);
      const mockSaveDecision = vi.fn().mockReturnValue(JSON.stringify({ success: true }));
      vi.mocked(sdkLoader.load).mockResolvedValue({
        save_decision: mockSaveDecision,
      } as unknown as ReturnType<typeof sdkLoader.load>);

      await decisionService.saveDecision(mockWorkspacePath, mockDecision);

      expect(mockSaveDecision).toHaveBeenCalledWith(
        JSON.stringify(mockDecision),
        mockWorkspacePath
      );
    });

    it('should throw error on save failure', async () => {
      vi.mocked(sdkLoader.hasDecisionSupport).mockReturnValue(true);
      vi.mocked(sdkLoader.load).mockResolvedValue({
        save_decision: vi
          .fn()
          .mockReturnValue(JSON.stringify({ success: false, error: 'Save failed' })),
      } as unknown as ReturnType<typeof sdkLoader.load>);

      await expect(decisionService.saveDecision(mockWorkspacePath, mockDecision)).rejects.toThrow(
        'Save failed'
      );
    });
  });

  describe('createDecision', () => {
    it('should create decision with auto-generated fields', async () => {
      vi.mocked(sdkLoader.hasDecisionSupport).mockReturnValue(true);
      vi.mocked(sdkLoader.load).mockResolvedValue({
        load_decision_index: vi.fn().mockReturnValue(JSON.stringify(mockDecisionIndex)),
        save_decision: vi.fn().mockReturnValue(JSON.stringify({ success: true })),
        save_decision_index: vi.fn().mockReturnValue(JSON.stringify({ success: true })),
      } as unknown as ReturnType<typeof sdkLoader.load>);

      const result = await decisionService.createDecision(mockWorkspacePath, {
        title: 'New Decision',
        category: DecisionCategory.Architecture,
        context: 'Test context',
        decision: 'Test decision',
      });

      expect(result.id).toBeDefined();
      expect(result.number).toBe(2); // next_number from index
      expect(result.title).toBe('New Decision');
      expect(result.status).toBe(DecisionStatus.Draft);
      expect(result.created_at).toBeDefined();
      expect(result.updated_at).toBeDefined();
    });
  });

  describe('updateDecision', () => {
    it('should throw error when decision is not found', async () => {
      vi.mocked(sdkLoader.hasDecisionSupport).mockReturnValue(true);
      vi.mocked(sdkLoader.load).mockResolvedValue({
        load_decisions: vi.fn().mockReturnValue(JSON.stringify({ decisions: [] })),
      } as unknown as ReturnType<typeof sdkLoader.load>);

      await expect(
        decisionService.updateDecision(mockWorkspacePath, 'non-existent', { title: 'Updated' })
      ).rejects.toThrow('Decision not found: non-existent');
    });

    it('should update decision preserving id and number', async () => {
      vi.mocked(sdkLoader.hasDecisionSupport).mockReturnValue(true);
      const mockSaveDecision = vi.fn().mockReturnValue(JSON.stringify({ success: true }));
      vi.mocked(sdkLoader.load).mockResolvedValue({
        load_decisions: vi.fn().mockReturnValue(JSON.stringify({ decisions: [mockDecision] })),
        save_decision: mockSaveDecision,
        load_decision_index: vi.fn().mockReturnValue(JSON.stringify(mockDecisionIndex)),
        save_decision_index: vi.fn().mockReturnValue(JSON.stringify({ success: true })),
      } as unknown as ReturnType<typeof sdkLoader.load>);

      const result = await decisionService.updateDecision(mockWorkspacePath, 'decision-1', {
        title: 'Updated Title',
      });

      expect(result.id).toBe('decision-1');
      expect(result.number).toBe(1);
      expect(result.title).toBe('Updated Title');
    });
  });

  describe('changeStatus', () => {
    it('should throw error for invalid status transition', async () => {
      vi.mocked(sdkLoader.hasDecisionSupport).mockReturnValue(true);
      vi.mocked(sdkLoader.load).mockResolvedValue({
        load_decisions: vi.fn().mockReturnValue(JSON.stringify({ decisions: [mockDecision] })),
      } as unknown as ReturnType<typeof sdkLoader.load>);

      await expect(
        decisionService.changeStatus(mockWorkspacePath, 'decision-1', DecisionStatus.Draft)
      ).rejects.toThrow('Invalid status transition');
    });

    it('should require supersededById when superseding', async () => {
      const draftDecision = { ...mockDecision, status: DecisionStatus.Accepted };
      vi.mocked(sdkLoader.hasDecisionSupport).mockReturnValue(true);
      vi.mocked(sdkLoader.load).mockResolvedValue({
        load_decisions: vi.fn().mockReturnValue(JSON.stringify({ decisions: [draftDecision] })),
      } as unknown as ReturnType<typeof sdkLoader.load>);

      await expect(
        decisionService.changeStatus(mockWorkspacePath, 'decision-1', DecisionStatus.Superseded)
      ).rejects.toThrow('supersededById is required');
    });

    it('should change status successfully', async () => {
      const proposedDecision = { ...mockDecision, status: DecisionStatus.Proposed };
      vi.mocked(sdkLoader.hasDecisionSupport).mockReturnValue(true);
      vi.mocked(sdkLoader.load).mockResolvedValue({
        load_decisions: vi.fn().mockReturnValue(JSON.stringify({ decisions: [proposedDecision] })),
        save_decision: vi.fn().mockReturnValue(JSON.stringify({ success: true })),
        load_decision_index: vi.fn().mockReturnValue(JSON.stringify(mockDecisionIndex)),
        save_decision_index: vi.fn().mockReturnValue(JSON.stringify({ success: true })),
      } as unknown as ReturnType<typeof sdkLoader.load>);

      const result = await decisionService.changeStatus(
        mockWorkspacePath,
        'decision-1',
        DecisionStatus.Accepted
      );

      expect(result.status).toBe(DecisionStatus.Accepted);
      expect(result.decided_at).toBeDefined();
    });
  });

  describe('exportToMarkdown', () => {
    it('should throw error when decision is not found', async () => {
      vi.mocked(sdkLoader.hasDecisionSupport).mockReturnValue(true);
      vi.mocked(sdkLoader.load).mockResolvedValue({
        load_decisions: vi.fn().mockReturnValue(JSON.stringify({ decisions: [] })),
      } as unknown as ReturnType<typeof sdkLoader.load>);

      await expect(
        decisionService.exportToMarkdown(mockWorkspacePath, 'non-existent')
      ).rejects.toThrow('Decision not found');
    });

    it('should use SDK export when available', async () => {
      const mockExport = vi.fn().mockReturnValue('# ADR Markdown');
      vi.mocked(sdkLoader.hasDecisionSupport).mockReturnValue(true);
      vi.mocked(sdkLoader.load).mockResolvedValue({
        load_decisions: vi.fn().mockReturnValue(JSON.stringify({ decisions: [mockDecision] })),
        export_decision_markdown: mockExport,
      } as unknown as ReturnType<typeof sdkLoader.load>);

      const result = await decisionService.exportToMarkdown(mockWorkspacePath, 'decision-1');

      expect(result).toBe('# ADR Markdown');
    });

    it('should fallback to client-side markdown generation', async () => {
      vi.mocked(sdkLoader.hasDecisionSupport).mockReturnValue(true);
      vi.mocked(sdkLoader.load).mockResolvedValue({
        load_decisions: vi.fn().mockReturnValue(JSON.stringify({ decisions: [mockDecision] })),
      } as unknown as ReturnType<typeof sdkLoader.load>);

      const result = await decisionService.exportToMarkdown(mockWorkspacePath, 'decision-1');

      expect(result).toContain('# 0001. Use React for Frontend');
      expect(result).toContain('**Status:** accepted');
      expect(result).toContain('## Context');
      expect(result).toContain('## Decision');
    });
  });

  describe('helper methods', () => {
    beforeEach(() => {
      vi.mocked(sdkLoader.hasDecisionSupport).mockReturnValue(true);
      vi.mocked(sdkLoader.load).mockResolvedValue({
        load_decisions: vi.fn().mockReturnValue(
          JSON.stringify({
            decisions: [
              { ...mockDecision, id: '1', status: DecisionStatus.Accepted },
              { ...mockDecision, id: '2', status: DecisionStatus.Draft },
              { ...mockDecision, id: '3', status: DecisionStatus.Proposed },
            ],
          })
        ),
      } as unknown as ReturnType<typeof sdkLoader.load>);
    });

    it('should get decisions by status', async () => {
      const result = await decisionService.getDecisionsByStatus(
        mockWorkspacePath,
        DecisionStatus.Draft
      );

      expect(result).toHaveLength(1);
      expect(result[0]?.status).toBe(DecisionStatus.Draft);
    });

    it('should get accepted decisions', async () => {
      const result = await decisionService.getAcceptedDecisions(mockWorkspacePath);

      expect(result).toHaveLength(1);
      expect(result[0]?.status).toBe(DecisionStatus.Accepted);
    });

    it('should get draft decisions', async () => {
      const result = await decisionService.getDraftDecisions(mockWorkspacePath);

      expect(result).toHaveLength(1);
      expect(result[0]?.status).toBe(DecisionStatus.Draft);
    });

    it('should get proposed decisions', async () => {
      const result = await decisionService.getProposedDecisions(mockWorkspacePath);

      expect(result).toHaveLength(1);
      expect(result[0]?.status).toBe(DecisionStatus.Proposed);
    });
  });
});
