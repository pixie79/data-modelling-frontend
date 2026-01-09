/**
 * Unit tests for useCanvas hook
 * Tests canvas interaction hooks
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCanvas } from '@/hooks/useCanvas';
import * as modelStore from '@/stores/modelStore';
import type { Table } from '@/types/table';

vi.mock('@/stores/modelStore', () => ({
  useModelStore: vi.fn(),
}));

describe('useCanvas', () => {
  const mockTables: Table[] = [
    {
      id: 'table-1',
      workspace_id: 'workspace-1',
      primary_domain_id: 'domain-1',
      name: 'Users',
      model_type: 'conceptual',
      columns: [],
      position_x: 100,
      position_y: 100,
      width: 200,
      height: 150,
      visible_domains: ['domain-1'],
      created_at: '2025-01-01T00:00:00Z',
      last_modified_at: '2025-01-01T00:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(modelStore.useModelStore).mockReturnValue({
      tables: mockTables,
      relationships: [],
      domains: [
        {
          id: 'domain-1',
          workspace_id: 'workspace-1',
          name: 'Test Domain',
          model_type: 'conceptual',
          is_primary: true,
          created_at: '2025-01-01T00:00:00Z',
          last_modified_at: '2025-01-01T00:00:00Z',
        },
      ],
      selectedTableId: null,
      selectedRelationshipId: null,
      selectedDomainId: 'domain-1',
      setSelectedTable: vi.fn(),
      openTableEditor: vi.fn(),
      setSelectedRelationship: vi.fn(),
      updateTable: vi.fn(),
      updateDomain: vi.fn(),
      updateTableRemote: vi.fn().mockResolvedValue(mockTables[0]),
    } as any);
  });

  it('should provide canvas interaction functions', () => {
    const { result } = renderHook(() => useCanvas('workspace-1', 'domain-1'));

    expect(result.current).toHaveProperty('onNodeClick');
    expect(result.current).toHaveProperty('onNodeDragStop');
    expect(result.current).toHaveProperty('onEdgeClick');
    expect(result.current).toHaveProperty('onConnect');
  });

  it('should handle node click to select table', () => {
    const setSelectedTable = vi.fn();
    const openTableEditor = vi.fn();
    vi.mocked(modelStore.useModelStore).mockReturnValue({
      tables: mockTables,
      relationships: [],
      domains: [
        {
          id: 'domain-1',
          workspace_id: 'workspace-1',
          name: 'Test Domain',
          model_type: 'conceptual',
          is_primary: true,
          created_at: '2025-01-01T00:00:00Z',
          last_modified_at: '2025-01-01T00:00:00Z',
        },
      ],
      selectedTableId: null,
      selectedRelationshipId: null,
      selectedDomainId: 'domain-1',
      setSelectedTable,
      openTableEditor,
      setSelectedRelationship: vi.fn(),
      updateTable: vi.fn(),
      updateDomain: vi.fn(),
      updateTableRemote: vi.fn().mockResolvedValue(mockTables[0]),
    } as any);

    const { result } = renderHook(() => useCanvas('workspace-1', 'domain-1'));

    act(() => {
      result.current.onNodeClick({} as any, { id: 'table-1' } as any);
    });

    expect(setSelectedTable).toHaveBeenCalledWith('table-1');
    expect(openTableEditor).toHaveBeenCalledWith('table-1');
  });

  it('should handle node drag to update position', async () => {
    const updateTableRemote = vi.fn().mockResolvedValue(mockTables[0]);
    const updateDomain = vi.fn();
    vi.mocked(modelStore.useModelStore).mockReturnValue({
      tables: mockTables,
      relationships: [],
      domains: [
        {
          id: 'domain-1',
          workspace_id: 'workspace-1',
          name: 'Test Domain',
          model_type: 'conceptual',
          is_primary: true,
          created_at: '2025-01-01T00:00:00Z',
          last_modified_at: '2025-01-01T00:00:00Z',
        },
      ],
      selectedTableId: null,
      selectedRelationshipId: null,
      selectedDomainId: 'domain-1',
      setSelectedTable: vi.fn(),
      setSelectedRelationship: vi.fn(),
      updateTable: vi.fn(),
      updateDomain,
      updateTableRemote,
    } as any);

    const { result } = renderHook(() => useCanvas('workspace-1', 'domain-1'));

    await act(async () => {
      result.current.onNodeDragStop(
        {} as any,
        {
          id: 'table-1',
          type: 'table',
          position: { x: 200, y: 300 },
        } as any
      );
    });

    // Verify updateDomain was called to save view position
    expect(updateDomain).toHaveBeenCalled();
  });

  it('should handle edge click to select relationship', () => {
    const setSelectedRelationship = vi.fn();
    vi.mocked(modelStore.useModelStore).mockReturnValue({
      tables: mockTables,
      relationships: [],
      domains: [
        {
          id: 'domain-1',
          workspace_id: 'workspace-1',
          name: 'Test Domain',
          model_type: 'conceptual',
          is_primary: true,
          created_at: '2025-01-01T00:00:00Z',
          last_modified_at: '2025-01-01T00:00:00Z',
        },
      ],
      selectedTableId: null,
      selectedRelationshipId: null,
      selectedDomainId: 'domain-1',
      setSelectedTable: vi.fn(),
      setSelectedRelationship,
      updateTable: vi.fn(),
      updateDomain: vi.fn(),
      updateTableRemote: vi.fn().mockResolvedValue(mockTables[0]),
    } as any);

    const { result } = renderHook(() => useCanvas('workspace-1', 'domain-1'));

    act(() => {
      result.current.onEdgeClick({} as any, { id: 'rel-1' } as any);
    });

    expect(setSelectedRelationship).toHaveBeenCalledWith('rel-1');
  });
});
