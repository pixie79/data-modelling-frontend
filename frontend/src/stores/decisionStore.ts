/**
 * Decision Store
 * Manages MADR Architecture Decision Records state using Zustand
 * SDK 1.13.3+
 *
 * NOTE: The SDK 1.13.3 WASM methods work with YAML strings, not file paths.
 * File I/O must be handled by the application layer (e.g., Electron file system).
 * This store manages in-memory state and delegates to the service for
 * parsing, validation, and export operations.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { decisionService } from '@/services/sdk/decisionService';
import type { Decision, DecisionIndex, DecisionFilter, DecisionOption } from '@/types/decision';
import { DecisionStatus, DecisionCategory, generateDecisionNumber } from '@/types/decision';

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
  setFilter: (filter: DecisionFilter | ((prev: DecisionFilter) => DecisionFilter)) => void;
  setLoading: (isLoading: boolean) => void;
  setSaving: (isSaving: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;

  // Data operations (in-memory, synchronous)
  addDecision: (decision: Decision) => void;
  updateDecisionInStore: (decisionId: string, updates: Partial<Decision>) => void;
  removeDecision: (decisionId: string) => void;

  // SDK-backed operations (parsing, creation, export)
  parseDecisionYaml: (yaml: string) => Promise<Decision | null>;
  parseDecisionIndexYaml: (yaml: string) => Promise<DecisionIndex | null>;
  exportDecisionToYaml: (decision: Decision) => Promise<string | null>;
  exportDecisionToMarkdown: (decision: Decision) => Promise<string>;
  exportDecisionToPDF: (decision: Decision) => Promise<void>;
  hasPDFExport: () => boolean;

  // High-level creation/update using service
  createDecision: (data: {
    title: string;
    category: DecisionCategory;
    context: string;
    decision: string;
    consequences?: string;
    options?: DecisionOption[];
    domain_id?: string;
    authors?: string[];
  }) => Decision;

  updateDecision: (decisionId: string, updates: Partial<Decision>) => Decision | null;

  changeDecisionStatus: (
    decisionId: string,
    newStatus: DecisionStatus,
    supersededById?: string
  ) => Decision | null;

  // Selectors
  getDecisionById: (id: string) => Decision | undefined;
  getDecisionsByStatus: (status: DecisionStatus) => Decision[];
  getDecisionsByCategory: (category: DecisionCategory) => Decision[];
  getDecisionsByDomain: (domainId: string) => Decision[];
  getAcceptedDecisions: () => Decision[];
  getDraftDecisions: () => Decision[];
  getProposedDecisions: () => Decision[];
  getNextDecisionNumber: () => number;

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

      setFilter: (filterOrUpdater) => {
        // Support both direct filter object and functional updater
        const currentFilter = get().filter;
        const newFilter =
          typeof filterOrUpdater === 'function' ? filterOrUpdater(currentFilter) : filterOrUpdater;

        set({ filter: newFilter });
        // Update filtered decisions
        const decisions = get().decisions;
        set({ filteredDecisions: applyFilter(decisions, newFilter) });
      },

      setLoading: (isLoading) => set({ isLoading }),

      setSaving: (isSaving) => set({ isSaving }),

      setError: (error) => set({ error }),

      clearError: () => set({ error: null }),

      // Data operations (in-memory)
      addDecision: (decision) => {
        const decisions = [...get().decisions, decision];
        const filter = get().filter;
        set({
          decisions,
          filteredDecisions: applyFilter(decisions, filter),
        });
      },

      updateDecisionInStore: (decisionId, updates) => {
        const decisions = get().decisions.map((d) =>
          d.id === decisionId ? { ...d, ...updates, updated_at: new Date().toISOString() } : d
        );
        const filter = get().filter;
        const selectedDecision = get().selectedDecision;
        const updatedDecision = decisions.find((d) => d.id === decisionId);

        set({
          decisions,
          filteredDecisions: applyFilter(decisions, filter),
          selectedDecision:
            selectedDecision?.id === decisionId ? (updatedDecision ?? null) : selectedDecision,
        });
      },

      removeDecision: (decisionId) => {
        const decisions = get().decisions.filter((d) => d.id !== decisionId);
        const filter = get().filter;
        const selectedDecision = get().selectedDecision;

        set({
          decisions,
          filteredDecisions: applyFilter(decisions, filter),
          selectedDecision: selectedDecision?.id === decisionId ? null : selectedDecision,
        });
      },

      // SDK-backed operations
      parseDecisionYaml: async (yaml) => {
        try {
          return await decisionService.parseDecisionYaml(yaml);
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Failed to parse decision YAML' });
          return null;
        }
      },

      parseDecisionIndexYaml: async (yaml) => {
        try {
          return await decisionService.parseDecisionIndexYaml(yaml);
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Failed to parse decision index' });
          return null;
        }
      },

      exportDecisionToYaml: async (decision) => {
        try {
          return await decisionService.exportDecisionToYaml(decision);
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to export decision to YAML',
          });
          return null;
        }
      },

      exportDecisionToMarkdown: async (decision) => {
        try {
          return await decisionService.exportDecisionToMarkdown(decision);
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to export decision to Markdown',
          });
          throw error;
        }
      },

      exportDecisionToPDF: async (decision) => {
        try {
          const pdfResult = await decisionService.exportDecisionToPDF(decision);
          decisionService.downloadPDF(pdfResult);
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to export decision to PDF',
          });
          throw error;
        }
      },

      hasPDFExport: () => {
        return decisionService.hasPDFExport();
      },

      // High-level creation using service
      createDecision: (data) => {
        // Use timestamp-based number (YYMMDDHHmm) for unique IDs across systems
        const timestampNumber = generateDecisionNumber();
        const decision = decisionService.createDecision(data, timestampNumber);

        // Add to store
        get().addDecision(decision);
        set({ selectedDecision: decision });

        // Update index
        const index = get().decisionIndex;
        if (index) {
          const entry = decisionService.createIndexEntry(decision);
          const updatedIndex: DecisionIndex = {
            ...index,
            decisions: [...index.decisions, entry],
            last_updated: new Date().toISOString(),
          };
          set({ decisionIndex: updatedIndex });
        }

        return decision;
      },

      updateDecision: (decisionId, updates) => {
        const decision = get().getDecisionById(decisionId);
        if (!decision) {
          set({ error: `Decision not found: ${decisionId}` });
          return null;
        }

        const updatedDecision = decisionService.updateDecision(decision, updates);
        get().updateDecisionInStore(decisionId, updatedDecision);

        // Update index if title or status changed
        if (updates.title || updates.status || updates.category) {
          const index = get().decisionIndex;
          if (index) {
            const updatedDecisions = index.decisions.map((e) =>
              e.id === decisionId
                ? {
                    ...e,
                    title: updatedDecision.title,
                    status: updatedDecision.status,
                    category: updatedDecision.category,
                    updated_at: updatedDecision.updated_at,
                  }
                : e
            );
            set({
              decisionIndex: {
                ...index,
                decisions: updatedDecisions,
                last_updated: updatedDecision.updated_at,
              },
            });
          }
        }

        return updatedDecision;
      },

      changeDecisionStatus: (decisionId, newStatus, supersededById) => {
        const decision = get().getDecisionById(decisionId);
        if (!decision) {
          set({ error: `Decision not found: ${decisionId}` });
          return null;
        }

        try {
          const updatedDecision = decisionService.changeStatus(decision, newStatus, supersededById);
          get().updateDecisionInStore(decisionId, updatedDecision);

          // If superseding, update the superseding decision too
          if (newStatus === DecisionStatus.Superseded && supersededById) {
            const supersedingDecision = get().getDecisionById(supersededById);
            if (supersedingDecision) {
              get().updateDecisionInStore(supersededById, { supersedes: decisionId });
            }
          }

          return updatedDecision;
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Failed to change status' });
          return null;
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

      /** @deprecated Use generateDecisionNumber() from types/decision instead */
      getNextDecisionNumber: () => {
        // Now uses timestamp-based numbers (YYMMDDHHmm)
        return generateDecisionNumber();
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
    // Include items matching the domain OR cross-domain items (no domain_id)
    filtered = filtered.filter((d) => d.domain_id === filter.domain_id || !d.domain_id);
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
