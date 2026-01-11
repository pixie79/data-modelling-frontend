/**
 * Unit tests for Decision Store
 * Tests Zustand store for MADR Architecture Decision Records
 * Updated for SDK 1.13.3+ in-memory API
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useDecisionStore } from '@/stores/decisionStore';
import { decisionService } from '@/services/sdk/decisionService';
import { DecisionStatus, DecisionCategory } from '@/types/decision';
import type { Decision, DecisionIndex } from '@/types/decision';

// Mock decisionService
vi.mock('@/services/sdk/decisionService', () => ({
  decisionService: {
    parseDecisionYaml: vi.fn(),
    parseDecisionIndexYaml: vi.fn(),
    exportDecisionToYaml: vi.fn(),
    exportDecisionToMarkdown: vi.fn(),
    createDecision: vi.fn(),
    createIndexEntry: vi.fn(),
    updateDecision: vi.fn(),
    changeStatus: vi.fn(),
  },
}));

describe('useDecisionStore', () => {
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

  describe('in-memory data operations', () => {
    it('should add decision to state', () => {
      const store = useDecisionStore.getState();

      store.addDecision(mockDecision);

      const state = useDecisionStore.getState();
      expect(state.decisions).toHaveLength(1);
      expect(state.decisions[0]).toEqual(mockDecision);
    });

    it('should update decision in state', () => {
      const store = useDecisionStore.getState();
      store.setDecisions([mockDecision]);

      store.updateDecisionInStore('decision-1', { title: 'Updated Title' });

      const state = useDecisionStore.getState();
      expect(state.decisions[0]?.title).toBe('Updated Title');
    });

    it('should update selected decision when updating matching decision', () => {
      const store = useDecisionStore.getState();
      store.setDecisions([mockDecision]);
      store.setSelectedDecision(mockDecision);

      store.updateDecisionInStore('decision-1', { title: 'Updated Title' });

      const state = useDecisionStore.getState();
      expect(state.selectedDecision?.title).toBe('Updated Title');
    });

    it('should remove decision from state', () => {
      const store = useDecisionStore.getState();
      store.setDecisions([mockDecision, mockDecision2]);

      store.removeDecision('decision-1');

      const state = useDecisionStore.getState();
      expect(state.decisions).toHaveLength(1);
      expect(state.decisions[0]?.id).toBe('decision-2');
    });

    it('should clear selected decision when removing it', () => {
      const store = useDecisionStore.getState();
      store.setDecisions([mockDecision, mockDecision2]);
      store.setSelectedDecision(mockDecision);

      store.removeDecision('decision-1');

      expect(useDecisionStore.getState().selectedDecision).toBeNull();
    });
  });

  describe('createDecision', () => {
    it('should create decision and add to state', () => {
      const newDecision = { ...mockDecision, id: 'new-decision' };
      vi.mocked(decisionService.createDecision).mockReturnValue(newDecision);
      vi.mocked(decisionService.createIndexEntry).mockReturnValue({
        id: 'new-decision',
        number: 1,
        title: 'New Decision',
        status: DecisionStatus.Draft,
        category: DecisionCategory.Architecture,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      });

      const store = useDecisionStore.getState();
      store.setDecisionIndex(mockDecisionIndex);

      const result = store.createDecision({
        title: 'New Decision',
        category: DecisionCategory.Architecture,
        context: 'Context',
        decision: 'Decision',
      });

      expect(result).toEqual(newDecision);
      const state = useDecisionStore.getState();
      expect(state.decisions).toContainEqual(newDecision);
      expect(state.selectedDecision).toEqual(newDecision);
    });

    it('should update decision index when creating', () => {
      const newDecision = { ...mockDecision, id: 'new-decision', number: 2601101234 };
      vi.mocked(decisionService.createDecision).mockReturnValue(newDecision);
      vi.mocked(decisionService.createIndexEntry).mockReturnValue({
        id: 'new-decision',
        number: 2601101234,
        title: 'New Decision',
        status: DecisionStatus.Draft,
        category: DecisionCategory.Architecture,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      });

      const store = useDecisionStore.getState();
      store.setDecisionIndex(mockDecisionIndex);

      store.createDecision({
        title: 'New Decision',
        category: DecisionCategory.Architecture,
        context: 'Context',
        decision: 'Decision',
      });

      const state = useDecisionStore.getState();
      // next_number is deprecated - timestamp-based numbers are used instead
      expect(state.decisionIndex?.decisions).toHaveLength(1);
      expect(state.decisionIndex?.last_updated).toBeDefined();
    });
  });

  describe('updateDecision', () => {
    it('should update decision in state', () => {
      const updatedDecision = { ...mockDecision, title: 'Updated Title' };
      vi.mocked(decisionService.updateDecision).mockReturnValue(updatedDecision);

      const store = useDecisionStore.getState();
      store.setDecisions([mockDecision]);
      store.setSelectedDecision(mockDecision);

      const result = store.updateDecision('decision-1', { title: 'Updated Title' });

      expect(result?.title).toBe('Updated Title');
      const state = useDecisionStore.getState();
      expect(state.decisions[0]?.title).toBe('Updated Title');
      expect(state.selectedDecision?.title).toBe('Updated Title');
    });

    it('should return null for non-existent decision', () => {
      const store = useDecisionStore.getState();

      const result = store.updateDecision('non-existent', { title: 'Updated' });

      expect(result).toBeNull();
      expect(useDecisionStore.getState().error).toContain('not found');
    });
  });

  describe('changeDecisionStatus', () => {
    it('should change status and update state', () => {
      const updatedDecision = { ...mockDecision, status: DecisionStatus.Deprecated };
      vi.mocked(decisionService.changeStatus).mockReturnValue(updatedDecision);

      const store = useDecisionStore.getState();
      store.setDecisions([mockDecision]);

      const result = store.changeDecisionStatus('decision-1', DecisionStatus.Deprecated);

      expect(result?.status).toBe(DecisionStatus.Deprecated);
      const state = useDecisionStore.getState();
      expect(state.decisions[0]?.status).toBe(DecisionStatus.Deprecated);
    });

    it('should return null for non-existent decision', () => {
      const store = useDecisionStore.getState();

      const result = store.changeDecisionStatus('non-existent', DecisionStatus.Deprecated);

      expect(result).toBeNull();
    });

    it('should set error when status change throws', () => {
      vi.mocked(decisionService.changeStatus).mockImplementation(() => {
        throw new Error('Invalid status transition');
      });

      const store = useDecisionStore.getState();
      store.setDecisions([mockDecision]);

      const result = store.changeDecisionStatus('decision-1', DecisionStatus.Draft);

      expect(result).toBeNull();
      expect(useDecisionStore.getState().error).toBe('Invalid status transition');
    });
  });

  describe('exportDecisionToMarkdown', () => {
    it('should export decision to markdown', async () => {
      vi.mocked(decisionService.exportDecisionToMarkdown).mockResolvedValue('# ADR-0001');

      const store = useDecisionStore.getState();
      const result = await store.exportDecisionToMarkdown(mockDecision);

      expect(result).toBe('# ADR-0001');
    });

    it('should set error on export failure', async () => {
      vi.mocked(decisionService.exportDecisionToMarkdown).mockRejectedValue(
        new Error('Export failed')
      );

      const store = useDecisionStore.getState();

      await expect(store.exportDecisionToMarkdown(mockDecision)).rejects.toThrow();

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
