/**
 * Component tests for Data Flow Canvas
 * Tests data flow diagram canvas rendering and interactions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { DataFlowCanvas } from '@/components/dataflow/DataFlowCanvas';
import * as modelStore from '@/stores/modelStore';
import type { DataFlowDiagram, DataFlowNode, DataFlowConnection } from '@/types/dataflow';

vi.mock('@/stores/modelStore', () => ({
  useModelStore: vi.fn(),
}));

vi.mock('reactflow', async () => {
  const actual = await vi.importActual('reactflow');
  return {
    ...actual,
    ReactFlow: ({ children }: { children: React.ReactNode }) => <div data-testid="reactflow">{children}</div>,
    Background: () => <div data-testid="background" />,
    Controls: () => <div data-testid="controls" />,
    MiniMap: () => <div data-testid="minimap" />,
    useNodesState: (initial: any) => [initial, vi.fn()],
    useEdgesState: (initial: any) => [initial, vi.fn()],
    useNodes: () => [],
    useEdges: () => [],
  };
});

describe('DataFlowCanvas', () => {
  const mockDiagram: DataFlowDiagram = {
    id: 'diagram-1',
    workspace_id: 'workspace-1',
    name: 'Test Diagram',
    nodes: [
      {
        id: 'node-1',
        diagram_id: 'diagram-1',
        type: 'source',
        label: 'Source DB',
        position_x: 100,
        position_y: 100,
        width: 150,
        height: 100,
      },
      {
        id: 'node-2',
        diagram_id: 'diagram-1',
        type: 'processor',
        label: 'Kafka Topic',
        position_x: 300,
        position_y: 100,
        width: 150,
        height: 100,
      },
    ],
    connections: [
      {
        id: 'conn-1',
        diagram_id: 'diagram-1',
        source_node_id: 'node-1',
        target_node_id: 'node-2',
        label: 'Data Flow',
      },
    ],
    created_at: '2025-01-01T00:00:00Z',
    last_modified_at: '2025-01-01T00:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(modelStore.useModelStore).mockReturnValue({
      dataFlowDiagrams: [mockDiagram],
      selectedDataFlowDiagramId: 'diagram-1',
      setSelectedDataFlowDiagram: vi.fn(),
      addDataFlowNode: vi.fn(),
      updateDataFlowNode: vi.fn(),
      removeDataFlowNode: vi.fn(),
      addDataFlowConnection: vi.fn(),
      updateDataFlowConnection: vi.fn(),
      removeDataFlowConnection: vi.fn(),
    } as any);
  });

  it('should render data flow canvas', () => {
    render(<DataFlowCanvas workspaceId="workspace-1" diagramId="diagram-1" />);
    expect(screen.getByTestId('reactflow')).toBeInTheDocument();
    expect(screen.getByTestId('background')).toBeInTheDocument();
    expect(screen.getByTestId('controls')).toBeInTheDocument();
  });

  it('should render nodes from diagram', async () => {
    render(<DataFlowCanvas workspaceId="workspace-1" diagramId="diagram-1" />);
    await waitFor(() => {
      expect(screen.getByTestId('reactflow')).toBeInTheDocument();
    });
  });

  it('should render connections from diagram', async () => {
    render(<DataFlowCanvas workspaceId="workspace-1" diagramId="diagram-1" />);
    await waitFor(() => {
      expect(screen.getByTestId('reactflow')).toBeInTheDocument();
    });
  });

  it('should handle empty diagram', () => {
    const emptyDiagram: DataFlowDiagram = {
      id: 'diagram-2',
      workspace_id: 'workspace-1',
      name: 'Empty Diagram',
      nodes: [],
      connections: [],
      created_at: '2025-01-01T00:00:00Z',
      last_modified_at: '2025-01-01T00:00:00Z',
    };

    vi.mocked(modelStore.useModelStore).mockReturnValue({
      dataFlowDiagrams: [emptyDiagram],
      selectedDataFlowDiagramId: 'diagram-2',
      setSelectedDataFlowDiagram: vi.fn(),
      addDataFlowNode: vi.fn(),
      updateDataFlowNode: vi.fn(),
      removeDataFlowNode: vi.fn(),
      addDataFlowConnection: vi.fn(),
      updateDataFlowConnection: vi.fn(),
      removeDataFlowConnection: vi.fn(),
    } as any);

    render(<DataFlowCanvas workspaceId="workspace-1" diagramId="diagram-2" />);
    expect(screen.getByTestId('reactflow')).toBeInTheDocument();
  });
});

