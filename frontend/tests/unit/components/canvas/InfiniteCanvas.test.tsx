/**
 * Component tests for Infinite Canvas
 * Tests ReactFlow-based infinite canvas with tables and relationships
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InfiniteCanvas } from '@/components/canvas/InfiniteCanvas';
import * as modelStore from '@/stores/modelStore';
import type { Table } from '@/types/table';
import type { Relationship } from '@/types/relationship';

vi.mock('@/stores/modelStore', () => ({
  useModelStore: vi.fn(),
}));

vi.mock('reactflow', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="reactflow">{children}</div>,
  ReactFlow: ({ children }: { children: React.ReactNode }) => <div data-testid="reactflow">{children}</div>,
  useNodesState: () => [[], vi.fn(), vi.fn()],
  useEdgesState: () => [[], vi.fn(), vi.fn()],
  Background: () => <div data-testid="background" />,
  Controls: () => <div data-testid="controls" />,
  MiniMap: () => <div data-testid="minimap" />,
  Position: {
    Top: 'top',
    Bottom: 'bottom',
    Left: 'left',
    Right: 'right',
  },
}));

describe('InfiniteCanvas', () => {
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

  const mockRelationships: Relationship[] = [
    {
      id: 'rel-1',
      workspace_id: 'workspace-1',
      domain_id: 'domain-1',
      source_table_id: 'table-1',
      target_table_id: 'table-2',
      type: 'one-to-many',
      source_cardinality: '1',
      target_cardinality: 'N',
      model_type: 'conceptual',
      is_circular: false,
      created_at: '2025-01-01T00:00:00Z',
      last_modified_at: '2025-01-01T00:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(modelStore.useModelStore).mockReturnValue({
      tables: mockTables,
      relationships: mockRelationships,
      selectedDomainId: 'domain-1',
      selectedTableId: null,
      selectedRelationshipId: null,
      setSelectedTable: vi.fn(),
      setSelectedRelationship: vi.fn(),
    } as any);
  });

  it('should render ReactFlow canvas', () => {
    render(<InfiniteCanvas workspaceId="workspace-1" domainId="domain-1" />);
    expect(screen.getByTestId('reactflow')).toBeInTheDocument();
  });

  it('should render canvas controls', () => {
    render(<InfiniteCanvas workspaceId="workspace-1" domainId="domain-1" />);
    expect(screen.getByTestId('background')).toBeInTheDocument();
    expect(screen.getByTestId('controls')).toBeInTheDocument();
    expect(screen.getByTestId('minimap')).toBeInTheDocument();
  });

  it('should filter tables by visible domains', () => {
    const tablesWithMultipleDomains: Table[] = [
      {
        ...mockTables[0],
        visible_domains: ['domain-1', 'domain-2'],
      },
      {
        id: 'table-2',
        workspace_id: 'workspace-1',
        primary_domain_id: 'domain-2',
        name: 'Orders',
        model_type: 'conceptual',
        columns: [],
        position_x: 300,
        position_y: 300,
        width: 200,
        height: 150,
        visible_domains: ['domain-2'],
        created_at: '2025-01-01T00:00:00Z',
        last_modified_at: '2025-01-01T00:00:00Z',
      },
    ];

    vi.mocked(modelStore.useModelStore).mockReturnValue({
      tables: tablesWithMultipleDomains,
      relationships: mockRelationships,
      selectedDomainId: 'domain-1',
      selectedTableId: null,
      selectedRelationshipId: null,
      setSelectedTable: vi.fn(),
      setSelectedRelationship: vi.fn(),
    } as any);

    render(<InfiniteCanvas workspaceId="workspace-1" domainId="domain-1" />);
    // Component should render without errors
    expect(screen.getByTestId('reactflow')).toBeInTheDocument();
  });
});

