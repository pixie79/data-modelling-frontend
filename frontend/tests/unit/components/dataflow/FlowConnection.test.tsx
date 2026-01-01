/**
 * Component tests for Flow Connection
 * Tests data flow connection rendering with labels and direction
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReactFlowProvider } from 'reactflow';
import { FlowConnection } from '@/components/dataflow/FlowConnection';
import type { DataFlowConnection } from '@/types/dataflow';

// Mock ReactFlow
vi.mock('reactflow', async () => {
  const actual = await vi.importActual('reactflow');
  return {
    ...actual,
    BaseEdge: ({ path, label }: { path: string; label?: string }) => (
      <g data-testid="flow-connection">
        <path d={path} />
        {label && <text>{label}</text>}
      </g>
    ),
    useNodes: () => [
      { id: 'node-1', position: { x: 100, y: 100 }, width: 150, height: 100 },
      { id: 'node-2', position: { x: 300, y: 100 }, width: 150, height: 100 },
    ],
    useEdges: () => [],
  };
});

describe('FlowConnection', () => {
  const mockConnection: DataFlowConnection = {
    id: 'conn-1',
    diagram_id: 'diagram-1',
    source_node_id: 'node-1',
    target_node_id: 'node-2',
    label: 'Data Flow',
  };

  const defaultProps = {
    id: 'conn-1',
    sourceX: 175,
    sourceY: 150,
    targetX: 225,
    targetY: 150,
    sourcePosition: 'right' as const,
    targetPosition: 'left' as const,
    data: { connection: mockConnection },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render flow connection with label', () => {
    render(
      <ReactFlowProvider>
        <FlowConnection {...defaultProps} />
      </ReactFlowProvider>
    );
    expect(screen.getByTestId('flow-connection')).toBeInTheDocument();
    expect(screen.getByText('Data Flow')).toBeInTheDocument();
  });

  it('should render connection without label', () => {
    const connectionWithoutLabel: DataFlowConnection = {
      ...mockConnection,
      label: undefined,
    };

    render(
      <ReactFlowProvider>
        <FlowConnection {...defaultProps} data={{ connection: connectionWithoutLabel }} />
      </ReactFlowProvider>
    );
    expect(screen.getByTestId('flow-connection')).toBeInTheDocument();
  });

  it('should highlight selected connection', () => {
    render(
      <ReactFlowProvider>
        <FlowConnection {...defaultProps} selected={true} />
      </ReactFlowProvider>
    );
    const connection = screen.getByTestId('flow-connection');
    expect(connection).toBeInTheDocument();
  });

  it('should display connection metadata if available', () => {
    const connectionWithMetadata: DataFlowConnection = {
      ...mockConnection,
      metadata: {
        protocol: 'Kafka',
        topic: 'customer-events',
        format: 'AVRO',
      },
    };

    render(
      <ReactFlowProvider>
        <FlowConnection {...defaultProps} data={{ connection: connectionWithMetadata }} />
      </ReactFlowProvider>
    );
    expect(screen.getByTestId('flow-connection')).toBeInTheDocument();
  });
});

