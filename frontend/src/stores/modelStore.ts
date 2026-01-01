/**
 * Model Store
 * Manages data model state (tables, relationships, domains) using Zustand
 */

import { create } from 'zustand';
import { tableService } from '@/services/api/tableService';
import { relationshipService } from '@/services/api/relationshipService';
import type { Table } from '@/types/table';
import type { Relationship } from '@/types/relationship';
import type { Domain } from '@/types/workspace';
import type { CreateTableRequest, CreateRelationshipRequest } from '@/types/api';

interface ModelState {
  tables: Table[];
  relationships: Relationship[];
  domains: Domain[];
  selectedTableId: string | null;
  selectedRelationshipId: string | null;
  selectedDomainId: string | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  setTables: (tables: Table[]) => void;
  setRelationships: (relationships: Relationship[]) => void;
  setDomains: (domains: Domain[]) => void;
  addTable: (table: Table) => void;
  updateTable: (tableId: string, updates: Partial<Table>) => void;
  removeTable: (tableId: string) => void;
  addRelationship: (relationship: Relationship) => void;
  updateRelationship: (relationshipId: string, updates: Partial<Relationship>) => void;
  removeRelationship: (relationshipId: string) => void;
  setSelectedTable: (tableId: string | null) => void;
  setSelectedRelationship: (relationshipId: string | null) => void;
  setSelectedDomain: (domainId: string | null) => void;
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
}

export const useModelStore = create<ModelState>((set) => ({
  tables: [],
  relationships: [],
  domains: [],
  selectedTableId: null,
  selectedRelationshipId: null,
  selectedDomainId: null,
  isLoading: false,
  error: null,

  setTables: (tables) => set({ tables }),
  setRelationships: (relationships) => set({ relationships }),
  setDomains: (domains) => set({ domains }),
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
  setSelectedTable: (tableId) => set({ selectedTableId: tableId }),
  setSelectedRelationship: (relationshipId) => set({ selectedRelationshipId: relationshipId }),
  setSelectedDomain: (domainId) => set({ selectedDomainId: domainId }),
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
}));

