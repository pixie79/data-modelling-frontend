/**
 * Decision Store
 * Manages MADR Architecture Decision Records state using Zustand
 * SDK 1.13.1+
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { decisionService } from '@/services/sdk/decisionService';
import type { Decision, DecisionIndex, DecisionFilter, DecisionOption } from '@/types/decision';
import { DecisionStatus, DecisionCategory } from '@/types/decision';

interface DecisionState {
  // State
  decisions: Decision[];
  selectedDecision: Decision | null;
  decisionIndex: DecisionIndex | null;
  filter: DecisionFilter;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;

  // Computed (via selectors)
  filteredDecisions: Decision[];

  // Actions
  setDecisions: (decisions: Decision[]) => void;
  setSelectedDecision: (decision: Decision | null) => void;
  setDecisionIndex: (index: DecisionIndex | null) => void;
  setFilter: (filter: DecisionFilter) => void;
  setLoading: (isLoading: boolean) => void;
  setSaving: (isSaving: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;

  // Async operations
  loadDecisions: (workspacePath: string) => Promise<void>;
  loadDecisionsByDomain: (workspacePath: string, domainId: string) => Promise<void>;
  createDecision: (
    workspacePath: string,
    data: {
      title: string;
      category: DecisionCategory;
      context: string;
      decision: string;
      consequences?: string;
      options?: DecisionOption[];
      domain_id?: string;
      authors?: string[];
    }
  ) => Promise<Decision>;
  updateDecision: (
    workspacePath: string,
    decisionId: string,
    updates: Partial<Decision>
  ) => Promise<void>;
  changeDecisionStatus: (
    workspacePath: string,
    decisionId: string,
    newStatus: DecisionStatus,
    supersededById?: string
  ) => Promise<void>;
  deleteDecision: (workspacePath: string, decisionId: string) => Promise<void>;
  exportToMarkdown: (workspacePath: string, decisionId: string) => Promise<string>;

  // Selectors
  getDecisionById: (id: string) => Decision | undefined;
  getDecisionsByStatus: (status: DecisionStatus) => Decision[];
  getDecisionsByCategory: (category: DecisionCategory) => Decision[];
  getDecisionsByDomain: (domainId: string) => Decision[];
  getAcceptedDecisions: () => Decision[];
  getDraftDecisions: () => Decision[];
  getProposedDecisions: () => Decision[];

  // Reset
  reset: () => void;
}

const initialState = {
  decisions: [],
  selectedDecision: null,
  decisionIndex: null,
  filter: {},
  isLoading: false,
  isSaving: false,
  error: null,
  filteredDecisions: [],
};

export const useDecisionStore = create<DecisionState>()(
  persist(
    (set, get) => ({
      ...initialState,

      // Setters
      setDecisions: (decisions) => {
        set({ decisions });
        // Update filtered decisions
        const filter = get().filter;
        set({ filteredDecisions: applyFilter(decisions, filter) });
      },

      setSelectedDecision: (decision) => set({ selectedDecision: decision }),

      setDecisionIndex: (index) => set({ decisionIndex: index }),

      setFilter: (filter) => {
        set({ filter });
        // Update filtered decisions
        const decisions = get().decisions;
        set({ filteredDecisions: applyFilter(decisions, filter) });
      },

      setLoading: (isLoading) => set({ isLoading }),

      setSaving: (isSaving) => set({ isSaving }),

      setError: (error) => set({ error }),

      clearError: () => set({ error: null }),

      // Async operations
      loadDecisions: async (workspacePath) => {
        set({ isLoading: true, error: null });
        try {
          const [decisions, index] = await Promise.all([
            decisionService.loadDecisions(workspacePath),
            decisionService.loadDecisionIndex(workspacePath),
          ]);

          const filter = get().filter;
          set({
            decisions,
            decisionIndex: index,
            filteredDecisions: applyFilter(decisions, filter),
            isLoading: false,
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to load decisions',
            isLoading: false,
          });
        }
      },

      loadDecisionsByDomain: async (workspacePath, domainId) => {
        set({ isLoading: true, error: null });
        try {
          const decisions = await decisionService.loadDecisionsByDomain(workspacePath, domainId);
          const filter = { ...get().filter, domain_id: domainId };
          set({
            decisions,
            filter,
            filteredDecisions: decisions, // Already filtered by domain
            isLoading: false,
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to load decisions',
            isLoading: false,
          });
        }
      },

      createDecision: async (workspacePath, data) => {
        set({ isSaving: true, error: null });
        try {
          const decision = await decisionService.createDecision(workspacePath, data);

          // Add to local state
          const decisions = [...get().decisions, decision];
          const filter = get().filter;
          set({
            decisions,
            filteredDecisions: applyFilter(decisions, filter),
            selectedDecision: decision,
            isSaving: false,
          });

          return decision;
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to create decision',
            isSaving: false,
          });
          throw error;
        }
      },

      updateDecision: async (workspacePath, decisionId, updates) => {
        set({ isSaving: true, error: null });
        try {
          const updatedDecision = await decisionService.updateDecision(
            workspacePath,
            decisionId,
            updates
          );

          // Update local state
          const decisions = get().decisions.map((d) => (d.id === decisionId ? updatedDecision : d));
          const filter = get().filter;
          const selectedDecision = get().selectedDecision;

          set({
            decisions,
            filteredDecisions: applyFilter(decisions, filter),
            selectedDecision:
              selectedDecision?.id === decisionId ? updatedDecision : selectedDecision,
            isSaving: false,
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to update decision',
            isSaving: false,
          });
          throw error;
        }
      },

      changeDecisionStatus: async (workspacePath, decisionId, newStatus, supersededById) => {
        set({ isSaving: true, error: null });
        try {
          const updatedDecision = await decisionService.changeStatus(
            workspacePath,
            decisionId,
            newStatus,
            supersededById
          );

          // Update local state
          const decisions = get().decisions.map((d) => (d.id === decisionId ? updatedDecision : d));
          const filter = get().filter;
          const selectedDecision = get().selectedDecision;

          set({
            decisions,
            filteredDecisions: applyFilter(decisions, filter),
            selectedDecision:
              selectedDecision?.id === decisionId ? updatedDecision : selectedDecision,
            isSaving: false,
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to change decision status',
            isSaving: false,
          });
          throw error;
        }
      },

      deleteDecision: async (workspacePath, decisionId) => {
        set({ isSaving: true, error: null });
        try {
          await decisionService.deleteDecision(workspacePath, decisionId);

          // Remove from local state
          const decisions = get().decisions.filter((d) => d.id !== decisionId);
          const filter = get().filter;
          const selectedDecision = get().selectedDecision;

          set({
            decisions,
            filteredDecisions: applyFilter(decisions, filter),
            selectedDecision: selectedDecision?.id === decisionId ? null : selectedDecision,
            isSaving: false,
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to delete decision',
            isSaving: false,
          });
          throw error;
        }
      },

      exportToMarkdown: async (workspacePath, decisionId) => {
        try {
          return await decisionService.exportToMarkdown(workspacePath, decisionId);
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to export decision',
          });
          throw error;
        }
      },

      // Selectors
      getDecisionById: (id) => {
        return get().decisions.find((d) => d.id === id);
      },

      getDecisionsByStatus: (status) => {
        return get().decisions.filter((d) => d.status === status);
      },

      getDecisionsByCategory: (category) => {
        return get().decisions.filter((d) => d.category === category);
      },

      getDecisionsByDomain: (domainId) => {
        return get().decisions.filter((d) => d.domain_id === domainId);
      },

      getAcceptedDecisions: () => {
        return get().decisions.filter((d) => d.status === DecisionStatus.Accepted);
      },

      getDraftDecisions: () => {
        return get().decisions.filter((d) => d.status === DecisionStatus.Draft);
      },

      getProposedDecisions: () => {
        return get().decisions.filter((d) => d.status === DecisionStatus.Proposed);
      },

      // Reset
      reset: () => set(initialState),
    }),
    {
      name: 'decision-store',
      partialize: (state) => ({
        // Only persist selected decision ID, not full data
        selectedDecisionId: state.selectedDecision?.id,
        filter: state.filter,
      }),
    }
  )
);

/**
 * Apply filter to decisions
 */
function applyFilter(decisions: Decision[], filter: DecisionFilter): Decision[] {
  let filtered = [...decisions];

  if (filter.domain_id) {
    filtered = filtered.filter((d) => d.domain_id === filter.domain_id);
  }

  if (filter.status && filter.status.length > 0) {
    filtered = filtered.filter((d) => filter.status!.includes(d.status));
  }

  if (filter.category && filter.category.length > 0) {
    filtered = filtered.filter((d) => filter.category!.includes(d.category));
  }

  if (filter.search) {
    const searchLower = filter.search.toLowerCase();
    filtered = filtered.filter(
      (d) =>
        d.title.toLowerCase().includes(searchLower) ||
        d.context.toLowerCase().includes(searchLower) ||
        d.decision.toLowerCase().includes(searchLower)
    );
  }

  // Sort by number descending (newest first)
  filtered.sort((a, b) => b.number - a.number);

  return filtered;
}
