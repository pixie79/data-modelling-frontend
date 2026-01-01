/**
 * Model Store
 * Manages data model state (tables, relationships, domains) using Zustand
 */

import { create } from 'zustand';
import { tableService } from '@/services/api/tableService';
import { relationshipService } from '@/services/api/relationshipService';
import { dataFlowService } from '@/services/api/dataFlowService';
import type { Table } from '@/types/table';
import type { Relationship } from '@/types/relationship';
import type { Domain, DataFlowDiagram, DataFlowNode, DataFlowConnection } from '@/types/workspace';
import type { CreateTableRequest, CreateRelationshipRequest, CreateDataFlowDiagramRequest, UpdateDataFlowDiagramRequest } from '@/types/api';

interface ModelState {
  tables: Table[];
  relationships: Relationship[];
  domains: Domain[];
  dataFlowDiagrams: DataFlowDiagram[];
  selectedTableId: string | null;
  selectedRelationshipId: string | null;
  selectedDomainId: string | null;
  selectedDataFlowDiagramId: string | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  setTables: (tables: Table[]) => void;
  setRelationships: (relationships: Relationship[]) => void;
  setDomains: (domains: Domain[]) => void;
  setDataFlowDiagrams: (diagrams: DataFlowDiagram[]) => void;
  addTable: (table: Table) => void;
  updateTable: (tableId: string, updates: Partial<Table>) => void;
  removeTable: (tableId: string) => void;
  addRelationship: (relationship: Relationship) => void;
  updateRelationship: (relationshipId: string, updates: Partial<Relationship>) => void;
  removeRelationship: (relationshipId: string) => void;
  addDataFlowDiagram: (diagram: DataFlowDiagram) => void;
  updateDataFlowDiagram: (diagramId: string, updates: Partial<DataFlowDiagram>) => void;
  removeDataFlowDiagram: (diagramId: string) => void;
  addDataFlowNode: (diagramId: string, node: DataFlowNode) => void;
  updateDataFlowNode: (diagramId: string, nodeId: string, updates: Partial<DataFlowNode>) => void;
  removeDataFlowNode: (diagramId: string, nodeId: string) => void;
  addDataFlowConnection: (diagramId: string, connection: DataFlowConnection) => void;
  updateDataFlowConnection: (diagramId: string, connectionId: string, updates: Partial<DataFlowConnection>) => void;
  removeDataFlowConnection: (diagramId: string, connectionId: string) => void;
  setSelectedTable: (tableId: string | null) => void;
  setSelectedRelationship: (relationshipId: string | null) => void;
  setSelectedDomain: (domainId: string | null) => void;
  setSelectedDataFlowDiagram: (diagramId: string | null) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;

  // CRUD Operations
  fetchTables: (domain: string) => Promise<void>;
  fetchRelationships: (domain: string) => Promise<void>;
  createTable: (domain: string, request: CreateTableRequest) => Promise<Table>;
  updateTableRemote: (domain: string, tableId: string, updates: Partial<Table>) => Promise<Table>;
  deleteTableRemote: (domain: string, tableId: string) => Promise<void>;
  createRelationship: (domain: string, request: CreateRelationshipRequest) => Promise<Relationship>;
  updateRelationshipRemote: (domain: string, relationshipId: string, updates: Partial<Relationship>) => Promise<Relationship>;
  deleteRelationshipRemote: (domain: string, relationshipId: string) => Promise<void>;
  
  // Data Flow Diagram CRUD Operations
  fetchDataFlowDiagrams: (workspaceId: string) => Promise<void>;
  createDataFlowDiagramRemote: (workspaceId: string, request: CreateDataFlowDiagramRequest) => Promise<DataFlowDiagram>;
  updateDataFlowDiagramRemote: (workspaceId: string, diagramId: string, request: UpdateDataFlowDiagramRequest) => Promise<DataFlowDiagram>;
  deleteDataFlowDiagramRemote: (workspaceId: string, diagramId: string) => Promise<void>;
  
  // Link data flow to conceptual tables
  linkDataFlowToTable: (diagramId: string, tableId: string) => void;
  unlinkDataFlowFromTable: (diagramId: string, tableId: string) => void;
}

export const useModelStore = create<ModelState>((set) => ({
  tables: [],
  relationships: [],
  domains: [],
  dataFlowDiagrams: [],
  selectedTableId: null,
  selectedRelationshipId: null,
  selectedDomainId: null,
  selectedDataFlowDiagramId: null,
  isLoading: false,
  error: null,

  setTables: (tables) => set({ tables }),
  setRelationships: (relationships) => set({ relationships }),
  setDomains: (domains) => set({ domains }),
  setDataFlowDiagrams: (diagrams) => set({ dataFlowDiagrams: diagrams }),
  addTable: (table) =>
    set((state) => ({
      tables: [...state.tables, table],
    })),
  updateTable: (tableId, updates) =>
    set((state) => ({
      tables: state.tables.map((t) => (t.id === tableId ? { ...t, ...updates } : t)),
    })),
  removeTable: (tableId) =>
    set((state) => ({
      tables: state.tables.filter((t) => t.id !== tableId),
      selectedTableId: state.selectedTableId === tableId ? null : state.selectedTableId,
    })),
  addRelationship: (relationship) =>
    set((state) => ({
      relationships: [...state.relationships, relationship],
    })),
  updateRelationship: (relationshipId, updates) =>
    set((state) => ({
      relationships: state.relationships.map((r) =>
        r.id === relationshipId ? { ...r, ...updates } : r
      ),
    })),
  removeRelationship: (relationshipId) =>
    set((state) => ({
      relationships: state.relationships.filter((r) => r.id !== relationshipId),
      selectedRelationshipId:
        state.selectedRelationshipId === relationshipId ? null : state.selectedRelationshipId,
    })),
  addDataFlowDiagram: (diagram) =>
    set((state) => ({
      dataFlowDiagrams: [...state.dataFlowDiagrams, diagram],
    })),
  updateDataFlowDiagram: (diagramId, updates) =>
    set((state) => ({
      dataFlowDiagrams: state.dataFlowDiagrams.map((d) =>
        d.id === diagramId ? { ...d, ...updates } : d
      ),
    })),
  removeDataFlowDiagram: (diagramId) =>
    set((state) => ({
      dataFlowDiagrams: state.dataFlowDiagrams.filter((d) => d.id !== diagramId),
      selectedDataFlowDiagramId:
        state.selectedDataFlowDiagramId === diagramId ? null : state.selectedDataFlowDiagramId,
    })),
  addDataFlowNode: (diagramId, node) =>
    set((state) => ({
      dataFlowDiagrams: state.dataFlowDiagrams.map((d) =>
        d.id === diagramId ? { ...d, nodes: [...d.nodes, node] } : d
      ),
    })),
  updateDataFlowNode: (diagramId, nodeId, updates) =>
    set((state) => ({
      dataFlowDiagrams: state.dataFlowDiagrams.map((d) =>
        d.id === diagramId
          ? {
              ...d,
              nodes: d.nodes.map((n) => (n.id === nodeId ? { ...n, ...updates } : n)),
            }
          : d
      ),
    })),
  removeDataFlowNode: (diagramId, nodeId) =>
    set((state) => ({
      dataFlowDiagrams: state.dataFlowDiagrams.map((d) =>
        d.id === diagramId
          ? {
              ...d,
              nodes: d.nodes.filter((n) => n.id !== nodeId),
              connections: d.connections.filter(
                (c) => c.source_node_id !== nodeId && c.target_node_id !== nodeId
              ),
            }
          : d
      ),
    })),
  addDataFlowConnection: (diagramId, connection) =>
    set((state) => ({
      dataFlowDiagrams: state.dataFlowDiagrams.map((d) =>
        d.id === diagramId ? { ...d, connections: [...d.connections, connection] } : d
      ),
    })),
  updateDataFlowConnection: (diagramId, connectionId, updates) =>
    set((state) => ({
      dataFlowDiagrams: state.dataFlowDiagrams.map((d) =>
        d.id === diagramId
          ? {
              ...d,
              connections: d.connections.map((c) =>
                c.id === connectionId ? { ...c, ...updates } : c
              ),
            }
          : d
      ),
    })),
  removeDataFlowConnection: (diagramId, connectionId) =>
    set((state) => ({
      dataFlowDiagrams: state.dataFlowDiagrams.map((d) =>
        d.id === diagramId
          ? { ...d, connections: d.connections.filter((c) => c.id !== connectionId) }
          : d
      ),
    })),
  setSelectedTable: (tableId) => set({ selectedTableId: tableId }),
  setSelectedRelationship: (relationshipId) => set({ selectedRelationshipId: relationshipId }),
  setSelectedDomain: (domainId) => set({ selectedDomainId: domainId }),
  setSelectedDataFlowDiagram: (diagramId) => set({ selectedDataFlowDiagramId: diagramId }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),

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
      const table = await tableService.createTable(domain, request);
      set((state) => ({
        tables: [...state.tables, table],
        isLoading: false,
      }));
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

  createRelationship: async (
    domain: string,
    request: CreateRelationshipRequest
  ) => {
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
      set((state) => ({
        relationships: state.relationships.map((r) =>
          r.id === relationshipId ? relationship : r
        ),
        isLoading: false,
      }));
      return relationship;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to update relationship',
        isLoading: false,
      });
      throw error;
    }
  },

  deleteRelationshipRemote: async (
    domain: string,
    relationshipId: string
  ) => {
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

  // Data Flow Diagram CRUD Operations
  fetchDataFlowDiagrams: async (workspaceId: string) => {
    set({ isLoading: true, error: null });
    try {
      const diagrams = await dataFlowService.listDataFlowDiagrams(workspaceId);
      set({ dataFlowDiagrams: diagrams, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch data flow diagrams',
        isLoading: false,
      });
    }
  },

  createDataFlowDiagramRemote: async (
    workspaceId: string,
    request: CreateDataFlowDiagramRequest
  ) => {
    set({ isLoading: true, error: null });
    try {
      const diagram = await dataFlowService.createDataFlowDiagram(workspaceId, request);
      set((state) => ({
        dataFlowDiagrams: [...state.dataFlowDiagrams, diagram],
        isLoading: false,
      }));
      return diagram;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to create data flow diagram',
        isLoading: false,
      });
      throw error;
    }
  },

  updateDataFlowDiagramRemote: async (
    workspaceId: string,
    diagramId: string,
    request: UpdateDataFlowDiagramRequest
  ) => {
    set({ isLoading: true, error: null });
    try {
      const diagram = await dataFlowService.updateDataFlowDiagram(workspaceId, diagramId, request);
      set((state) => ({
        dataFlowDiagrams: state.dataFlowDiagrams.map((d) => (d.id === diagramId ? diagram : d)),
        isLoading: false,
      }));
      return diagram;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to update data flow diagram',
        isLoading: false,
      });
      throw error;
    }
  },

  deleteDataFlowDiagramRemote: async (workspaceId: string, diagramId: string) => {
    set({ isLoading: true, error: null });
    try {
      await dataFlowService.deleteDataFlowDiagram(workspaceId, diagramId);
      set((state) => ({
        dataFlowDiagrams: state.dataFlowDiagrams.filter((d) => d.id !== diagramId),
        selectedDataFlowDiagramId:
          state.selectedDataFlowDiagramId === diagramId ? null : state.selectedDataFlowDiagramId,
        isLoading: false,
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete data flow diagram',
        isLoading: false,
      });
      throw error;
    }
  },

  // Link data flow to conceptual tables
  linkDataFlowToTable: (diagramId: string, tableId: string) => {
    set((state) => ({
      dataFlowDiagrams: state.dataFlowDiagrams.map((d) =>
        d.id === diagramId
          ? {
              ...d,
              linked_tables: [...(d.linked_tables || []), tableId],
            }
          : d
      ),
    }));
  },

  unlinkDataFlowFromTable: (diagramId: string, tableId: string) => {
    set((state) => ({
      dataFlowDiagrams: state.dataFlowDiagrams.map((d) =>
        d.id === diagramId
          ? {
              ...d,
              linked_tables: (d.linked_tables || []).filter((id) => id !== tableId),
            }
          : d
      ),
    }));
  },
}));

