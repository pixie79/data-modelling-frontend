/**
 * Unit tests for Decision Store
 * Tests Zustand store for MADR Architecture Decision Records
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useDecisionStore } from '@/stores/decisionStore';
import { decisionService } from '@/services/sdk/decisionService';
import { DecisionStatus, DecisionCategory } from '@/types/decision';
import type { Decision, DecisionIndex } from '@/types/decision';

// Mock decisionService
vi.mock('@/services/sdk/decisionService', () => ({
  decisionService: {
    loadDecisions: vi.fn(),
    loadDecisionIndex: vi.fn(),
    loadDecisionsByDomain: vi.fn(),
    createDecision: vi.fn(),
    updateDecision: vi.fn(),
    changeStatus: vi.fn(),
    deleteDecision: vi.fn(),
    exportToMarkdown: vi.fn(),
  },
}));

describe('useDecisionStore', () => {
  const mockWorkspacePath = '/test/workspace';

  const mockDecision: Decision = {
    id: 'decision-1',
    number: 1,
    title: 'Use React for Frontend',
    status: DecisionStatus.Accepted,
    category: DecisionCategory.Technology,
    context: 'We need to choose a frontend framework',
    decision: 'We will use React',
    consequences: 'Need to train team',
    options: [],
    domain_id: 'domain-1',
    authors: ['John Doe'],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  const mockDecision2: Decision = {
    ...mockDecision,
    id: 'decision-2',
    number: 2,
    title: 'Use PostgreSQL',
    status: DecisionStatus.Draft,
    category: DecisionCategory.Data,
    domain_id: 'domain-2',
  };

  const mockDecisionIndex: DecisionIndex = {
    workspace_id: 'workspace-1',
    next_number: 3,
    decisions: [],
    last_updated: '2024-01-01T00:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store state
    useDecisionStore.getState().reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const state = useDecisionStore.getState();

      expect(state.decisions).toEqual([]);
      expect(state.selectedDecision).toBeNull();
      expect(state.decisionIndex).toBeNull();
      expect(state.filter).toEqual({});
      expect(state.isLoading).toBe(false);
      expect(state.isSaving).toBe(false);
      expect(state.error).toBeNull();
      expect(state.filteredDecisions).toEqual([]);
    });
  });

  describe('setters', () => {
    it('should set decisions and update filtered decisions', () => {
      const store = useDecisionStore.getState();

      store.setDecisions([mockDecision, mockDecision2]);

      const state = useDecisionStore.getState();
      expect(state.decisions).toHaveLength(2);
      expect(state.filteredDecisions).toHaveLength(2);
    });

    it('should set selected decision', () => {
      const store = useDecisionStore.getState();

      store.setSelectedDecision(mockDecision);

      expect(useDecisionStore.getState().selectedDecision).toEqual(mockDecision);
    });

    it('should set decision index', () => {
      const store = useDecisionStore.getState();

      store.setDecisionIndex(mockDecisionIndex);

      expect(useDecisionStore.getState().decisionIndex).toEqual(mockDecisionIndex);
    });

    it('should set filter and update filtered decisions', () => {
      const store = useDecisionStore.getState();
      store.setDecisions([mockDecision, mockDecision2]);

      store.setFilter({ status: [DecisionStatus.Draft] });

      const state = useDecisionStore.getState();
      expect(state.filter).toEqual({ status: [DecisionStatus.Draft] });
      expect(state.filteredDecisions).toHaveLength(1);
      expect(state.filteredDecisions[0]?.id).toBe('decision-2');
    });

    it('should set loading state', () => {
      const store = useDecisionStore.getState();

      store.setLoading(true);

      expect(useDecisionStore.getState().isLoading).toBe(true);
    });

    it('should set saving state', () => {
      const store = useDecisionStore.getState();

      store.setSaving(true);

      expect(useDecisionStore.getState().isSaving).toBe(true);
    });

    it('should set and clear error', () => {
      const store = useDecisionStore.getState();

      store.setError('Test error');
      expect(useDecisionStore.getState().error).toBe('Test error');

      store.clearError();
      expect(useDecisionStore.getState().error).toBeNull();
    });
  });

  describe('loadDecisions', () => {
    it('should load decisions successfully', async () => {
      vi.mocked(decisionService.loadDecisions).mockResolvedValue([mockDecision, mockDecision2]);
      vi.mocked(decisionService.loadDecisionIndex).mockResolvedValue(mockDecisionIndex);

      const store = useDecisionStore.getState();
      await store.loadDecisions(mockWorkspacePath);

      const state = useDecisionStore.getState();
      expect(state.decisions).toHaveLength(2);
      expect(state.decisionIndex).toEqual(mockDecisionIndex);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should handle load errors', async () => {
      vi.mocked(decisionService.loadDecisions).mockRejectedValue(new Error('Load failed'));

      const store = useDecisionStore.getState();
      await store.loadDecisions(mockWorkspacePath);

      const state = useDecisionStore.getState();
      expect(state.error).toBe('Load failed');
      expect(state.isLoading).toBe(false);
    });

    it('should set loading state during load', async () => {
      vi.mocked(decisionService.loadDecisions).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve([]), 100))
      );
      vi.mocked(decisionService.loadDecisionIndex).mockResolvedValue(null);

      const loadPromise = useDecisionStore.getState().loadDecisions(mockWorkspacePath);

      // Check loading state is set
      expect(useDecisionStore.getState().isLoading).toBe(true);

      await loadPromise;

      expect(useDecisionStore.getState().isLoading).toBe(false);
    });
  });

  describe('loadDecisionsByDomain', () => {
    it('should load decisions for specific domain', async () => {
      vi.mocked(decisionService.loadDecisionsByDomain).mockResolvedValue([mockDecision]);

      const store = useDecisionStore.getState();
      await store.loadDecisionsByDomain(mockWorkspacePath, 'domain-1');

      const state = useDecisionStore.getState();
      expect(state.decisions).toHaveLength(1);
      expect(state.filter.domain_id).toBe('domain-1');
      expect(state.isLoading).toBe(false);
    });
  });

  describe('createDecision', () => {
    it('should create decision and add to state', async () => {
      const newDecision = { ...mockDecision, id: 'new-decision' };
      vi.mocked(decisionService.createDecision).mockResolvedValue(newDecision);

      const store = useDecisionStore.getState();
      const result = await store.createDecision(mockWorkspacePath, {
        title: 'New Decision',
        category: DecisionCategory.Architecture,
        context: 'Context',
        decision: 'Decision',
      });

      expect(result).toEqual(newDecision);
      const state = useDecisionStore.getState();
      expect(state.decisions).toContainEqual(newDecision);
      expect(state.selectedDecision).toEqual(newDecision);
      expect(state.isSaving).toBe(false);
    });

    it('should handle create errors', async () => {
      vi.mocked(decisionService.createDecision).mockRejectedValue(new Error('Create failed'));

      const store = useDecisionStore.getState();

      await expect(
        store.createDecision(mockWorkspacePath, {
          title: 'New',
          category: DecisionCategory.Architecture,
          context: 'Context',
          decision: 'Decision',
        })
      ).rejects.toThrow('Create failed');

      expect(useDecisionStore.getState().error).toBe('Create failed');
    });
  });

  describe('updateDecision', () => {
    it('should update decision in state', async () => {
      const updatedDecision = { ...mockDecision, title: 'Updated Title' };
      vi.mocked(decisionService.updateDecision).mockResolvedValue(updatedDecision);

      const store = useDecisionStore.getState();
      store.setDecisions([mockDecision]);
      store.setSelectedDecision(mockDecision);

      await store.updateDecision(mockWorkspacePath, 'decision-1', { title: 'Updated Title' });

      const state = useDecisionStore.getState();
      expect(state.decisions[0]?.title).toBe('Updated Title');
      expect(state.selectedDecision?.title).toBe('Updated Title');
      expect(state.isSaving).toBe(false);
    });
  });

  describe('changeDecisionStatus', () => {
    it('should change status and update state', async () => {
      const updatedDecision = { ...mockDecision, status: DecisionStatus.Deprecated };
      vi.mocked(decisionService.changeStatus).mockResolvedValue(updatedDecision);

      const store = useDecisionStore.getState();
      store.setDecisions([mockDecision]);

      await store.changeDecisionStatus(mockWorkspacePath, 'decision-1', DecisionStatus.Deprecated);

      const state = useDecisionStore.getState();
      expect(state.decisions[0]?.status).toBe(DecisionStatus.Deprecated);
    });
  });

  describe('deleteDecision', () => {
    it('should remove decision from state', async () => {
      vi.mocked(decisionService.deleteDecision).mockResolvedValue();

      const store = useDecisionStore.getState();
      store.setDecisions([mockDecision, mockDecision2]);
      store.setSelectedDecision(mockDecision);

      await store.deleteDecision(mockWorkspacePath, 'decision-1');

      const state = useDecisionStore.getState();
      expect(state.decisions).toHaveLength(1);
      expect(state.decisions[0]?.id).toBe('decision-2');
      expect(state.selectedDecision).toBeNull();
    });
  });

  describe('exportToMarkdown', () => {
    it('should export decision to markdown', async () => {
      vi.mocked(decisionService.exportToMarkdown).mockResolvedValue('# ADR-0001');

      const store = useDecisionStore.getState();
      const result = await store.exportToMarkdown(mockWorkspacePath, 'decision-1');

      expect(result).toBe('# ADR-0001');
    });

    it('should set error on export failure', async () => {
      vi.mocked(decisionService.exportToMarkdown).mockRejectedValue(new Error('Export failed'));

      const store = useDecisionStore.getState();

      await expect(store.exportToMarkdown(mockWorkspacePath, 'decision-1')).rejects.toThrow();

      expect(useDecisionStore.getState().error).toBe('Export failed');
    });
  });

  describe('selectors', () => {
    beforeEach(() => {
      const store = useDecisionStore.getState();
      store.setDecisions([
        {
          ...mockDecision,
          id: '1',
          status: DecisionStatus.Accepted,
          category: DecisionCategory.Technology,
          domain_id: 'domain-1',
        },
        {
          ...mockDecision,
          id: '2',
          status: DecisionStatus.Draft,
          category: DecisionCategory.Architecture,
          domain_id: 'domain-2',
        },
        {
          ...mockDecision,
          id: '3',
          status: DecisionStatus.Proposed,
          category: DecisionCategory.Technology,
          domain_id: 'domain-1',
        },
      ]);
    });

    it('should get decision by id', () => {
      const store = useDecisionStore.getState();

      const decision = store.getDecisionById('2');

      expect(decision?.id).toBe('2');
    });

    it('should return undefined for non-existent decision', () => {
      const store = useDecisionStore.getState();

      const decision = store.getDecisionById('non-existent');

      expect(decision).toBeUndefined();
    });

    it('should get decisions by status', () => {
      const store = useDecisionStore.getState();

      const decisions = store.getDecisionsByStatus(DecisionStatus.Accepted);

      expect(decisions).toHaveLength(1);
      expect(decisions[0]?.status).toBe(DecisionStatus.Accepted);
    });

    it('should get decisions by category', () => {
      const store = useDecisionStore.getState();

      const decisions = store.getDecisionsByCategory(DecisionCategory.Technology);

      expect(decisions).toHaveLength(2);
    });

    it('should get decisions by domain', () => {
      const store = useDecisionStore.getState();

      const decisions = store.getDecisionsByDomain('domain-1');

      expect(decisions).toHaveLength(2);
    });

    it('should get accepted decisions', () => {
      const store = useDecisionStore.getState();

      const decisions = store.getAcceptedDecisions();

      expect(decisions).toHaveLength(1);
      expect(decisions[0]?.status).toBe(DecisionStatus.Accepted);
    });

    it('should get draft decisions', () => {
      const store = useDecisionStore.getState();

      const decisions = store.getDraftDecisions();

      expect(decisions).toHaveLength(1);
      expect(decisions[0]?.status).toBe(DecisionStatus.Draft);
    });

    it('should get proposed decisions', () => {
      const store = useDecisionStore.getState();

      const decisions = store.getProposedDecisions();

      expect(decisions).toHaveLength(1);
      expect(decisions[0]?.status).toBe(DecisionStatus.Proposed);
    });
  });

  describe('filtering', () => {
    beforeEach(() => {
      const store = useDecisionStore.getState();
      store.setDecisions([
        {
          ...mockDecision,
          id: '1',
          number: 3,
          title: 'React Decision',
          status: DecisionStatus.Accepted,
          category: DecisionCategory.Technology,
          domain_id: 'domain-1',
        },
        {
          ...mockDecision,
          id: '2',
          number: 2,
          title: 'Database Decision',
          status: DecisionStatus.Draft,
          category: DecisionCategory.Data,
          domain_id: 'domain-2',
        },
        {
          ...mockDecision,
          id: '3',
          number: 1,
          title: 'Security Policy',
          status: DecisionStatus.Proposed,
          category: DecisionCategory.Security,
          domain_id: 'domain-1',
        },
      ]);
    });

    it('should filter by status', () => {
      const store = useDecisionStore.getState();

      store.setFilter({ status: [DecisionStatus.Draft, DecisionStatus.Proposed] });

      const state = useDecisionStore.getState();
      expect(state.filteredDecisions).toHaveLength(2);
    });

    it('should filter by category', () => {
      const store = useDecisionStore.getState();

      store.setFilter({ category: [DecisionCategory.Security] });

      const state = useDecisionStore.getState();
      expect(state.filteredDecisions).toHaveLength(1);
      expect(state.filteredDecisions[0]?.category).toBe(DecisionCategory.Security);
    });

    it('should filter by domain_id', () => {
      const store = useDecisionStore.getState();

      store.setFilter({ domain_id: 'domain-1' });

      const state = useDecisionStore.getState();
      expect(state.filteredDecisions).toHaveLength(2);
    });

    it('should filter by search term in title', () => {
      const store = useDecisionStore.getState();

      store.setFilter({ search: 'Database' });

      const state = useDecisionStore.getState();
      expect(state.filteredDecisions).toHaveLength(1);
      expect(state.filteredDecisions[0]?.title).toContain('Database');
    });

    it('should filter by search term in context', () => {
      const store = useDecisionStore.getState();
      // All mock decisions have same context, so search should match all
      store.setFilter({ search: 'frontend' });

      const state = useDecisionStore.getState();
      expect(state.filteredDecisions.length).toBeGreaterThan(0);
    });

    it('should combine multiple filters', () => {
      const store = useDecisionStore.getState();

      store.setFilter({
        status: [DecisionStatus.Accepted, DecisionStatus.Proposed],
        domain_id: 'domain-1',
      });

      const state = useDecisionStore.getState();
      expect(state.filteredDecisions).toHaveLength(2);
    });

    it('should sort by number descending', () => {
      const store = useDecisionStore.getState();

      store.setFilter({});

      const state = useDecisionStore.getState();
      expect(state.filteredDecisions[0]?.number).toBe(3);
      expect(state.filteredDecisions[1]?.number).toBe(2);
      expect(state.filteredDecisions[2]?.number).toBe(1);
    });
  });

  describe('reset', () => {
    it('should reset to initial state', () => {
      const store = useDecisionStore.getState();
      store.setDecisions([mockDecision]);
      store.setSelectedDecision(mockDecision);
      store.setError('Some error');
      store.setLoading(true);

      store.reset();

      const state = useDecisionStore.getState();
      expect(state.decisions).toEqual([]);
      expect(state.selectedDecision).toBeNull();
      expect(state.error).toBeNull();
      expect(state.isLoading).toBe(false);
    });
  });
});
