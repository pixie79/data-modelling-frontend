/**
 * Model Store
 * Manages data model state (tables, relationships, domains) using Zustand
 */

import { create } from 'zustand';
import { tableService } from '@/services/api/tableService';
import { relationshipService } from '@/services/api/relationshipService';
import { sdkModeDetector } from '@/services/sdk/sdkMode';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useDomainStore } from '@/stores/domainStore';
import type { Table, Column } from '@/types/table';
import type { Relationship } from '@/types/relationship';
import type { Domain } from '@/types/domain';
import type { DataProduct } from '@/types/odps';
import type { ComputeAsset } from '@/types/cads';
import type { BPMNProcess } from '@/types/bpmn';
import type { DMNDecision } from '@/types/dmn';
import type { System } from '@/types/system';
import type { CreateTableRequest, CreateRelationshipRequest } from '@/types/api';

export type ViewMode =
  | 'systems'
  | 'process'
  | 'operational'
  | 'analytical'
  | 'products'
  | 'decisions'
  | 'knowledge';
// Valid selectable data levels for tables
export type DataLevel = 'operational' | 'bronze' | 'silver' | 'gold';
// Display-only level when dm_level tag is not set
export type DataLevelDisplay = DataLevel | 'unknown';

interface ModelState {
  tables: Table[];
  relationships: Relationship[];
  domains: Domain[];
  systems: System[];
  products: DataProduct[];
  computeAssets: ComputeAsset[];
  bpmnProcesses: BPMNProcess[];
  dmnDecisions: DMNDecision[];
  selectedTableId: string | null;
  selectedRelationshipId: string | null;
  selectedDomainId: string | null;
  selectedSystemId: string | null; // Selected system for drill-down views
  currentView: ViewMode; // View mode for the current domain
  selectedDataLevel: DataLevel | null; // Filter by data level (for operational/analytical view)
  isLoading: boolean;
  error: string | null;

  // Multi-editor support (max 3 editors open at once)
  openTableEditorIds: string[]; // Array of table IDs with open editors
  focusedTableEditorId: string | null; // Which editor is currently focused (in front)

  // Tag filter backup (stored when filtering is active)
  originalTables?: Table[];
  originalComputeAssets?: ComputeAsset[];
  originalRelationships?: Relationship[];
  originalSystems?: System[];

  // Actions
  setTables: (tables: Table[]) => void;
  setRelationships: (relationships: Relationship[]) => void;
  setDomains: (domains: Domain[]) => void;
  setSystems: (systems: System[]) => void;
  setProducts: (products: DataProduct[]) => void;
  setComputeAssets: (assets: ComputeAsset[]) => void;
  setBPMNProcesses: (processes: BPMNProcess[]) => void;
  setDMNDecisions: (decisions: DMNDecision[]) => void;
  addDomain: (domain: Domain) => void;
  updateDomain: (domainId: string, updates: Partial<Domain>) => void;
  removeDomain: (domainId: string) => void;
  addSystem: (system: System) => void;
  updateSystem: (systemId: string, updates: Partial<System>) => void;
  removeSystem: (systemId: string) => void;
  addTable: (table: Table) => void;
  updateTable: (tableId: string, updates: Partial<Table>) => void;
  updateColumn: (tableId: string, columnId: string, updates: Partial<Column>) => void;
  removeTable: (tableId: string) => void;
  addRelationship: (relationship: Relationship) => void;
  updateRelationship: (relationshipId: string, updates: Partial<Relationship>) => void;
  removeRelationship: (relationshipId: string) => void;
  addProduct: (product: DataProduct) => void;
  updateProduct: (productId: string, updates: Partial<DataProduct>) => void;
  removeProduct: (productId: string) => void;
  addComputeAsset: (asset: ComputeAsset) => void;
  updateComputeAsset: (assetId: string, updates: Partial<ComputeAsset>) => void;
  removeComputeAsset: (assetId: string) => void;
  addBPMNProcess: (process: BPMNProcess) => void;
  updateBPMNProcess: (processId: string, updates: Partial<BPMNProcess>) => void;
  removeBPMNProcess: (processId: string) => void;
  addDMNDecision: (decision: DMNDecision) => void;
  updateDMNDecision: (decisionId: string, updates: Partial<DMNDecision>) => void;
  removeDMNDecision: (decisionId: string) => void;
  setSelectedTable: (tableId: string | null) => void;
  setSelectedRelationship: (relationshipId: string | null) => void;
  setSelectedDomain: (domainId: string | null) => void;
  setSelectedSystem: (systemId: string | null) => void;
  setCurrentView: (view: ViewMode) => void;
  setSelectedDataLevel: (level: DataLevel | null) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;

  // Multi-editor actions
  openTableEditor: (tableId: string) => void; // Opens editor or focuses if already open
  closeTableEditor: (tableId: string) => void; // Closes specific editor
  focusTableEditor: (tableId: string) => void; // Brings editor to front

  // CRUD Operations
  fetchTables: (domain: string) => Promise<void>;
  fetchRelationships: (domain: string) => Promise<void>;
  createTable: (domain: string, request: CreateTableRequest) => Promise<Table>;
  updateTableRemote: (domain: string, tableId: string, updates: Partial<Table>) => Promise<Table>;
  updateColumnRemote: (
    workspaceId: string,
    tableId: string,
    columnId: string,
    updates: Partial<Column>
  ) => Promise<Table>;
  deleteTableRemote: (domain: string, tableId: string) => Promise<void>;
  createRelationship: (domain: string, request: CreateRelationshipRequest) => Promise<Relationship>;
  updateRelationshipRemote: (
    domain: string,
    relationshipId: string,
    updates: Partial<Relationship>
  ) => Promise<Relationship>;
  deleteRelationshipRemote: (domain: string, relationshipId: string) => Promise<void>;

  // Domain asset loading
  loadDomainAssets: (workspaceId: string, domainId: string) => Promise<void>;

  // Filtering helpers
  getFilteredTables: () => Table[]; // Filter by currentView and selectedDataLevel
}

// Helper function to extract data_level from dm_level tag
const getDataLevelFromTags = (tags?: string[]): DataLevel | undefined => {
  if (!tags || !Array.isArray(tags)) return undefined;

  for (const tag of tags) {
    if (typeof tag === 'string' && tag.toLowerCase().startsWith('dm_level:')) {
      const levelValue = tag.substring('dm_level:'.length).toLowerCase();
      if (['operational', 'bronze', 'silver', 'gold'].includes(levelValue)) {
        return levelValue as DataLevel;
      }
    }
  }
  return undefined;
};

// Helper function to get effective data level (from field or tags)
const getEffectiveDataLevel = (table: Table): DataLevel | undefined => {
  // First check the data_level field
  if (table.data_level) {
    return table.data_level;
  }
  // Fall back to extracting from dm_level tag
  return getDataLevelFromTags(table.tags);
};

// Helper function to filter tables based on view mode and data level
const filterTablesByView = (
  tables: Table[],
  currentView: ViewMode,
  selectedDataLevel: DataLevel | null,
  selectedDomainId: string | null
): Table[] => {
  let filtered = tables;

  // Filter by selected domain visibility
  if (selectedDomainId) {
    filtered = filtered.filter(
      (t) =>
        t.primary_domain_id === selectedDomainId || t.visible_domains.includes(selectedDomainId)
    );
  }

  // Filter by data level (for operational/analytical view)
  if (currentView === 'operational' || currentView === 'analytical') {
    // Debug: log table data levels
    if (process.env.NODE_ENV === 'development') {
      console.log(`[ModelStore] Filtering for ${currentView} view:`, {
        totalTables: filtered.length,
        selectedDataLevel,
        tableLevels: filtered.slice(0, 5).map((t) => ({
          name: t.name,
          data_level: t.data_level,
          tags: t.tags,
          effectiveLevel: getEffectiveDataLevel(t),
        })),
      });
    }

    if (selectedDataLevel) {
      // Filter by specific data level - check both field and tags
      filtered = filtered.filter((t) => getEffectiveDataLevel(t) === selectedDataLevel);
    } else if (currentView === 'operational') {
      // Operational view: show ONLY tables with explicit 'operational' level
      // Tables without a level should NOT appear (they need to be assigned a level)
      filtered = filtered.filter((t) => {
        const level = getEffectiveDataLevel(t);
        return level === 'operational';
      });
    } else {
      // Analytical view: show bronze/silver/gold if no level selected
      filtered = filtered.filter((t) => {
        const level = getEffectiveDataLevel(t);
        return level === 'bronze' || level === 'silver' || level === 'gold';
      });
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`[ModelStore] After ${currentView} filter: ${filtered.length} tables`);
    }
  }

  // Filter by view mode
  // Systems view: show all tables (conceptual level)
  // Process view: show all tables (logical level)
  // Operational/Analytical: filtered by data level above
  // Products view: show tables linked to products
  if (currentView === 'products') {
    const state = useModelStore.getState();
    const productTableIds = new Set(state.products.flatMap((p) => p.linked_tables));
    filtered = filtered.filter((t) => productTableIds.has(t.id));
  }

  return filtered;
};

export const useModelStore = create<ModelState>((set, get) => ({
  tables: [],
  relationships: [],
  domains: [],
  systems: [],
  products: [],
  computeAssets: [],
  bpmnProcesses: [],
  dmnDecisions: [],
  selectedTableId: null,
  selectedRelationshipId: null,
  selectedDomainId: null,
  selectedSystemId: null,
  currentView: 'systems', // Default view mode
  selectedDataLevel: null,
  isLoading: false,
  error: null,

  // Multi-editor state
  openTableEditorIds: [],
  focusedTableEditorId: null,

  setTables: (tables) => set({ tables }),
  setRelationships: (relationships) => set({ relationships }),
  setDomains: (domains) => set({ domains }),
  setSystems: (systems) => set({ systems }),
  setProducts: (products) => set({ products }),
  setComputeAssets: (assets) => set({ computeAssets: assets }),
  setBPMNProcesses: (processes) => set({ bpmnProcesses: processes }),
  setDMNDecisions: (decisions) => set({ dmnDecisions: decisions }),
  addDomain: (domain) => {
    set((state) => ({
      domains: [...state.domains, domain],
    }));
    useWorkspaceStore.getState().setPendingChanges(true);
  },
  updateDomain: (domainId, updates) => {
    set((state) => ({
      domains: state.domains.map((d) => (d.id === domainId ? { ...d, ...updates } : d)),
    }));
    useWorkspaceStore.getState().setPendingChanges(true);
  },
  removeDomain: (domainId) => {
    set((state) => ({
      domains: state.domains.filter((d) => d.id !== domainId),
      selectedDomainId: state.selectedDomainId === domainId ? null : state.selectedDomainId,
    }));
    useWorkspaceStore.getState().setPendingChanges(true);
  },
  addSystem: (system) => {
    set((state) => ({
      systems: [...state.systems, system],
    }));
    useWorkspaceStore.getState().setPendingChanges(true);
  },
  updateSystem: (systemId, updates) => {
    set((state) => {
      const applyUpdate = (s: System) => (s.id === systemId ? { ...s, ...updates } : s);
      return {
        systems: state.systems.map(applyUpdate),
        // Also update backup if filtering is active
        originalSystems: state.originalSystems ? state.originalSystems.map(applyUpdate) : undefined,
      };
    });
    useWorkspaceStore.getState().setPendingChanges(true);
  },
  removeSystem: (systemId) => {
    set((state) => ({
      systems: state.systems.filter((s) => s.id !== systemId),
      selectedSystemId: state.selectedSystemId === systemId ? null : state.selectedSystemId,
    }));
    useWorkspaceStore.getState().setPendingChanges(true);
  },
  addTable: (table) => {
    set((state) => ({
      tables: [...state.tables, table],
    }));
    // Mark workspace as having pending changes
    useWorkspaceStore.getState().setPendingChanges(true);
  },
  updateTable: (tableId: string, updates: Partial<Table>) => {
    set((state) => {
      const applyTableUpdate = (t: Table): Table => {
        if (t.id === tableId) {
          // Deep merge to ensure compoundKeys and metadata are properly updated
          const merged = { ...t, ...updates };
          // Explicitly set compoundKeys if provided (even if empty array)
          if ('compoundKeys' in updates) {
            merged.compoundKeys = updates.compoundKeys;
          }
          // Explicitly merge metadata if provided
          if ('metadata' in updates && updates.metadata) {
            merged.metadata = { ...(t.metadata || {}), ...updates.metadata };
          }
          return merged;
        }
        return t;
      };

      const updatedTables = state.tables.map(applyTableUpdate);

      // Also update backup if filtering is active
      const updatedOriginalTables = state.originalTables
        ? state.originalTables.map(applyTableUpdate)
        : undefined;

      return {
        tables: updatedTables,
        originalTables: updatedOriginalTables,
      };
    });
    useWorkspaceStore.getState().setPendingChanges(true);
  },
  updateColumn: (tableId: string, columnId: string, updates: Partial<Column>) =>
    set((state) => ({
      tables: state.tables.map((t) =>
        t.id === tableId
          ? {
              ...t,
              columns: t.columns.map((c) => (c.id === columnId ? { ...c, ...updates } : c)),
            }
          : t
      ),
    })),
  removeTable: (tableId: string) => {
    set((state) => ({
      tables: state.tables.filter((t) => t.id !== tableId),
      selectedTableId: state.selectedTableId === tableId ? null : state.selectedTableId,
    }));
    // Mark workspace as having pending changes
    useWorkspaceStore.getState().setPendingChanges(true);
  },
  addRelationship: (relationship) => {
    set((state) => ({
      relationships: [...state.relationships, relationship],
    }));
    // Mark workspace as having pending changes
    useWorkspaceStore.getState().setPendingChanges(true);
  },
  updateRelationship: (relationshipId, updates) => {
    console.log('[ModelStore] updateRelationship (local):', {
      relationshipId,
      updates,
      beforeCount: get().relationships.length,
    });

    set((state) => {
      const applyUpdate = (r: Relationship) => (r.id === relationshipId ? { ...r, ...updates } : r);

      const updatedRelationships = state.relationships.map(applyUpdate);

      console.log('[ModelStore] After local update:', {
        afterCount: updatedRelationships.length,
        duplicates: updatedRelationships
          .filter((r, i, arr) => arr.findIndex((r2) => r2.id === r.id) !== i)
          .map((r) => r.id),
      });

      return {
        relationships: updatedRelationships,
        // Also update backup if filtering is active
        originalRelationships: state.originalRelationships
          ? state.originalRelationships.map(applyUpdate)
          : undefined,
      };
    });

    // Mark workspace as having pending changes
    useWorkspaceStore.getState().setPendingChanges(true);
  },
  removeRelationship: (relationshipId) => {
    set((state) => ({
      relationships: state.relationships.filter((r) => r.id !== relationshipId),
      selectedRelationshipId:
        state.selectedRelationshipId === relationshipId ? null : state.selectedRelationshipId,
    }));
    // Mark workspace as having pending changes
    useWorkspaceStore.getState().setPendingChanges(true);
  },
  addProduct: (product) => {
    set((state) => ({
      products: [...state.products, product],
    }));
    useWorkspaceStore.getState().setPendingChanges(true);
  },
  updateProduct: (productId, updates) =>
    set((state) => ({
      products: state.products.map((p) => (p.id === productId ? { ...p, ...updates } : p)),
    })),
  removeProduct: (productId) => {
    set((state) => ({
      products: state.products.filter((p) => p.id !== productId),
    }));
    useWorkspaceStore.getState().setPendingChanges(true);
  },
  addComputeAsset: (asset) => {
    set((state) => ({
      computeAssets: [...state.computeAssets, asset],
    }));
    useWorkspaceStore.getState().setPendingChanges(true);
  },
  updateComputeAsset: (assetId, updates) => {
    set((state) => {
      const applyUpdate = (a: ComputeAsset) => (a.id === assetId ? { ...a, ...updates } : a);
      return {
        computeAssets: state.computeAssets.map(applyUpdate),
        // Also update backup if filtering is active
        originalComputeAssets: state.originalComputeAssets
          ? state.originalComputeAssets.map(applyUpdate)
          : undefined,
      };
    });
    useWorkspaceStore.getState().setPendingChanges(true);
  },
  removeComputeAsset: (assetId) => {
    set((state) => ({
      computeAssets: state.computeAssets.filter((a) => a.id !== assetId),
    }));
    useWorkspaceStore.getState().setPendingChanges(true);
  },
  addBPMNProcess: (process) => {
    set((state) => ({
      bpmnProcesses: [...state.bpmnProcesses, process],
    }));
    useWorkspaceStore.getState().setPendingChanges(true);
  },
  updateBPMNProcess: (processId, updates) =>
    set((state) => ({
      bpmnProcesses: state.bpmnProcesses.map((p) =>
        p.id === processId ? { ...p, ...updates } : p
      ),
    })),
  removeBPMNProcess: (processId) => {
    set((state) => ({
      bpmnProcesses: state.bpmnProcesses.filter((p) => p.id !== processId),
    }));
    useWorkspaceStore.getState().setPendingChanges(true);
  },
  addDMNDecision: (decision) => {
    set((state) => ({
      dmnDecisions: [...state.dmnDecisions, decision],
    }));
    useWorkspaceStore.getState().setPendingChanges(true);
  },
  updateDMNDecision: (decisionId, updates) =>
    set((state) => ({
      dmnDecisions: state.dmnDecisions.map((d) => (d.id === decisionId ? { ...d, ...updates } : d)),
    })),
  removeDMNDecision: (decisionId) => {
    set((state) => ({
      dmnDecisions: state.dmnDecisions.filter((d) => d.id !== decisionId),
    }));
    useWorkspaceStore.getState().setPendingChanges(true);
  },
  setSelectedTable: (tableId) => set({ selectedTableId: tableId }),
  setSelectedRelationship: (relationshipId) => set({ selectedRelationshipId: relationshipId }),
  setSelectedDomain: (domainId) => set({ selectedDomainId: domainId }),
  setSelectedSystem: (systemId) => set({ selectedSystemId: systemId }),
  setCurrentView: (view) => set({ currentView: view }),
  setSelectedDataLevel: (level) => set({ selectedDataLevel: level }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),

  // Multi-editor actions
  openTableEditor: (tableId) => {
    const { openTableEditorIds } = get();

    // If already open, just focus it
    if (openTableEditorIds.includes(tableId)) {
      set({ focusedTableEditorId: tableId });
      return;
    }

    // Check max limit (3 editors)
    if (openTableEditorIds.length >= 3) {
      console.warn('[ModelStore] Maximum 3 table editors can be open at once');
      return;
    }

    // Add new editor and focus it
    set({
      openTableEditorIds: [...openTableEditorIds, tableId],
      focusedTableEditorId: tableId,
    });
  },

  closeTableEditor: (tableId) => {
    const { openTableEditorIds, focusedTableEditorId } = get();
    const newOpenIds = openTableEditorIds.filter((id) => id !== tableId);

    // If closing the focused editor, focus the last remaining one
    const newFocusedId =
      focusedTableEditorId === tableId
        ? newOpenIds[newOpenIds.length - 1] || null
        : focusedTableEditorId;

    set({
      openTableEditorIds: newOpenIds,
      focusedTableEditorId: newFocusedId,
    });
  },

  focusTableEditor: (tableId) => {
    const { openTableEditorIds } = get();
    if (openTableEditorIds.includes(tableId)) {
      set({ focusedTableEditorId: tableId });
    }
  },

  // CRUD Operations
  fetchTables: async (domain: string) => {
    set({ isLoading: true, error: null });
    try {
      const tables = await tableService.listTables(domain);
      set({ tables, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch tables',
        isLoading: false,
      });
    }
  },

  fetchRelationships: async (domain: string) => {
    set({ isLoading: true, error: null });
    try {
      const relationships = await relationshipService.listRelationships(domain);
      set({ relationships, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch relationships',
        isLoading: false,
      });
    }
  },

  createTable: async (domain: string, request: CreateTableRequest) => {
    set({ isLoading: true, error: null });
    try {
      // Check if we're in offline mode
      const mode = await sdkModeDetector.getMode();

      let table: Table;
      if (mode === 'offline') {
        // Create table locally in offline mode
        // Always use proper UUID generation to ensure SDK compatibility
        const { generateUUID } = await import('@/utils/validation');
        const tableId = generateUUID();
        // Get workspace_id from workspace store if available
        const workspaceId = useWorkspaceStore.getState().currentWorkspaceId || 'offline-workspace';

        // Map columns to ensure they have required fields
        const columns: Column[] = (request.columns || []).map((col, index) => ({
          id: generateUUID(),
          table_id: tableId,
          name: col.name,
          data_type: col.data_type,
          nullable: col.nullable ?? false,
          is_primary_key: col.is_primary_key ?? false,
          is_foreign_key: col.is_foreign_key ?? false,
          foreign_key_reference: col.foreign_key_reference,
          default_value: col.default_value,
          constraints: col.constraints,
          order: col.order ?? index,
          created_at: new Date().toISOString(),
        }));

        table = {
          id: tableId,
          workspace_id: workspaceId,
          primary_domain_id: domain,
          name: request.name,
          alias: request.alias,
          model_type: request.model_type || 'logical',
          columns,
          position_x: request.position_x,
          position_y: request.position_y,
          width: request.width || 200,
          height: request.height || 150,
          tags: [],
          metadata: {},
          visible_domains: [domain],
          is_owned_by_domain: true,
          created_at: new Date().toISOString(),
          last_modified_at: new Date().toISOString(),
        };

        // Add to store immediately
        set((state) => ({
          tables: [...state.tables, table],
          isLoading: false,
        }));
      } else {
        // Online mode: use API
        table = await tableService.createTable(domain, request);
        set((state) => ({
          tables: [...state.tables, table],
          isLoading: false,
        }));
      }

      return table;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to create table',
        isLoading: false,
      });
      throw error;
    }
  },

  updateTableRemote: async (domain: string, tableId: string, updates: Partial<Table>) => {
    set({ isLoading: true, error: null });
    try {
      const table = await tableService.updateTable(domain, tableId, updates);
      set((state) => ({
        tables: state.tables.map((t) => (t.id === tableId ? table : t)),
        isLoading: false,
      }));
      return table;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to update table',
        isLoading: false,
      });
      throw error;
    }
  },

  updateColumnRemote: async (
    _workspaceId: string,
    tableId: string,
    columnId: string,
    updates: Partial<Column>
  ) => {
    set({ isLoading: true, error: null });
    try {
      // Update column by updating the table with modified columns
      const currentState = useModelStore.getState();
      const table = currentState.tables.find((t) => t.id === tableId);
      if (!table) {
        throw new Error('Table not found');
      }

      const updatedColumns = table.columns.map((c) =>
        c.id === columnId ? { ...c, ...updates } : c
      );

      // Get domain from table
      const domain = table.primary_domain_id;
      // Update table with modified columns - API accepts full table object
      const updatedTable = { ...table, columns: updatedColumns };
      const tableResult = await tableService.updateTable(domain, tableId, updatedTable as any);

      set((state) => ({
        tables: state.tables.map((t) => (t.id === tableId ? tableResult : t)),
        isLoading: false,
      }));
      return tableResult;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to update column',
        isLoading: false,
      });
      throw error;
    }
  },

  deleteTableRemote: async (domain: string, tableId: string) => {
    set({ isLoading: true, error: null });
    try {
      await tableService.deleteTable(domain, tableId);
      set((state) => ({
        tables: state.tables.filter((t) => t.id !== tableId),
        selectedTableId: state.selectedTableId === tableId ? null : state.selectedTableId,
        isLoading: false,
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete table',
        isLoading: false,
      });
      throw error;
    }
  },

  createRelationship: async (domain: string, request: CreateRelationshipRequest) => {
    set({ isLoading: true, error: null });
    try {
      const relationship = await relationshipService.createRelationship(domain, request);
      set((state) => ({
        relationships: [...state.relationships, relationship],
        isLoading: false,
      }));
      return relationship;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to create relationship',
        isLoading: false,
      });
      throw error;
    }
  },

  updateRelationshipRemote: async (
    domain: string,
    relationshipId: string,
    updates: Partial<Relationship>
  ) => {
    set({ isLoading: true, error: null });
    try {
      const relationship = await relationshipService.updateRelationship(
        domain,
        relationshipId,
        updates
      );

      console.log('[ModelStore] updateRelationshipRemote:', {
        relationshipId,
        updatedRelationship: relationship,
        beforeCount: get().relationships.length,
      });

      set((state) => {
        const updatedRelationships = state.relationships.map((r) =>
          r.id === relationshipId ? relationship : r
        );

        console.log('[ModelStore] After update:', {
          afterCount: updatedRelationships.length,
          duplicates: updatedRelationships
            .filter((r, i, arr) => arr.findIndex((r2) => r2.id === r.id) !== i)
            .map((r) => r.id),
        });

        return {
          relationships: updatedRelationships,
          isLoading: false,
        };
      });
      return relationship;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to update relationship',
        isLoading: false,
      });
      throw error;
    }
  },

  deleteRelationshipRemote: async (domain: string, relationshipId: string) => {
    set({ isLoading: true, error: null });
    try {
      await relationshipService.deleteRelationship(domain, relationshipId);
      set((state) => ({
        relationships: state.relationships.filter((r) => r.id !== relationshipId),
        selectedRelationshipId:
          state.selectedRelationshipId === relationshipId ? null : state.selectedRelationshipId,
        isLoading: false,
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete relationship',
        isLoading: false,
      });
      throw error;
    }
  },

  // Domain asset loading
  loadDomainAssets: async (workspaceId: string, domainId: string) => {
    set({ isLoading: true, error: null });
    try {
      await useDomainStore.getState().loadDomainAssets(workspaceId, domainId);
      const domainState = useDomainStore.getState();
      set({
        tables: domainState.tables,
        products: domainState.products,
        computeAssets: domainState.computeAssets,
        bpmnProcesses: domainState.bpmnProcesses,
        dmnDecisions: domainState.dmnDecisions,
        isLoading: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load domain assets',
        isLoading: false,
      });
    }
  },

  // Filtering helpers
  getFilteredTables: () => {
    const state = get();
    return filterTablesByView(
      state.tables,
      state.currentView,
      state.selectedDataLevel,
      state.selectedDomainId
    );
  },
}));
