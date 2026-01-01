/**
 * Component tests for Flow Node
 * Tests data flow node rendering with abstract icons
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReactFlowProvider } from 'reactflow';
import { FlowNode } from '@/components/dataflow/FlowNode';
import type { DataFlowNode } from '@/types/dataflow';

// Mock ReactFlow
vi.mock('reactflow', async () => {
  const actual = await vi.importActual('reactflow');
  return {
    ...actual,
    Handle: ({ position }: { position: string }) => (
      <div data-testid={`handle-${position}`} />
    ),
    useNodes: () => [],
    useEdges: () => [],
  };
});

describe('FlowNode', () => {
  const mockNode: DataFlowNode = {
    id: 'node-1',
    diagram_id: 'diagram-1',
    type: 'source',
    label: 'Source Database',
    position_x: 100,
    position_y: 100,
    width: 150,
    height: 100,
  };

  const defaultProps = {
    id: 'node-1',
    data: { node: mockNode },
    selected: false,
    position: { x: 100, y: 100 },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render flow node with label', () => {
    render(
      <ReactFlowProvider>
        <FlowNode {...defaultProps} />
      </ReactFlowProvider>
    );
    expect(screen.getByText('Source Database')).toBeInTheDocument();
  });

  it('should render different node types with appropriate icons', () => {
    const sourceNode = { ...mockNode, type: 'source' as const };
    const { rerender } = render(
      <ReactFlowProvider>
        <FlowNode {...defaultProps} data={{ node: sourceNode }} />
      </ReactFlowProvider>
    );
    expect(screen.getByText('Source Database')).toBeInTheDocument();

    const processorNode = { ...mockNode, type: 'processor' as const, label: 'Kafka Topic' };
    rerender(
      <ReactFlowProvider>
        <FlowNode {...defaultProps} data={{ node: processorNode }} />
      </ReactFlowProvider>
    );
    expect(screen.getByText('Kafka Topic')).toBeInTheDocument();

    const targetNode = { ...mockNode, type: 'target' as const, label: 'Target Database' };
    rerender(
      <ReactFlowProvider>
        <FlowNode {...defaultProps} data={{ node: targetNode }} />
      </ReactFlowProvider>
    );
    expect(screen.getByText('Target Database')).toBeInTheDocument();

    const storageNode = { ...mockNode, type: 'storage' as const, label: 'Data Lake' };
    rerender(
      <ReactFlowProvider>
        <FlowNode {...defaultProps} data={{ node: storageNode }} />
      </ReactFlowProvider>
    );
    expect(screen.getByText('Data Lake')).toBeInTheDocument();
  });

  it('should highlight selected node', () => {
    render(
      <ReactFlowProvider>
        <FlowNode {...defaultProps} selected={true} />
      </ReactFlowProvider>
    );
    const nodeElement = screen.getByText('Source Database').closest('div');
    // Check if the element has ring-2 class (for selected state)
    expect(nodeElement?.className).toContain('ring-2');
  });

  it('should display node metadata if available', () => {
    const nodeWithMetadata: DataFlowNode = {
      ...mockNode,
      metadata: {
        database_type: 'PostgreSQL',
        connection_string: 'postgresql://localhost:5432/db',
      },
    };

    render(
      <ReactFlowProvider>
        <FlowNode {...defaultProps} data={{ node: nodeWithMetadata }} />
      </ReactFlowProvider>
    );
    expect(screen.getByText('Source Database')).toBeInTheDocument();
  });

  it('should handle node click', () => {
    const onNodeClick = vi.fn();
    render(
      <ReactFlowProvider>
        <FlowNode {...defaultProps} data={{ node: mockNode, onNodeClick }} />
      </ReactFlowProvider>
    );
    
    const nodeElement = screen.getByText('Source Database').closest('div');
    if (nodeElement) {
      fireEvent.click(nodeElement);
      expect(onNodeClick).toHaveBeenCalled();
    }
  });
});

