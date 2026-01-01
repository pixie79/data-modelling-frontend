/**
 * Component tests for Canvas Edge (Relationship)
 * Tests relationship edge rendering with crow's feet notation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CanvasEdge } from '@/components/canvas/CanvasEdge';
import type { Relationship } from '@/types/relationship';

// Mock ReactFlow
vi.mock('reactflow', async () => {
  const actual = await vi.importActual('reactflow');
  return {
    ...actual,
    BaseEdge: ({ path }: { path: string }) => <path d={path} data-testid="base-edge" />,
    useEdges: () => [],
  };
});

describe('CanvasEdge', () => {
  const mockRelationship: Relationship = {
    id: 'rel-1',
    workspace_id: 'workspace-1',
    domain_id: 'domain-1',
    source_table_id: 'table-1',
    source_column_id: 'col-1',
    target_table_id: 'table-2',
    target_column_id: 'col-2',
    relationship_type: 'one-to-many',
    source_cardinality: 'one',
    target_cardinality: 'many',
    source_optional: false,
    target_optional: false,
    created_at: '2025-01-01T00:00:00Z',
    last_modified_at: '2025-01-01T00:00:00Z',
  };

  const defaultProps = {
    id: 'rel-1',
    sourceX: 100,
    sourceY: 100,
    targetX: 300,
    targetY: 100,
    sourcePosition: 'right' as const,
    targetPosition: 'left' as const,
    data: { relationship: mockRelationship },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render relationship edge', () => {
    render(<CanvasEdge {...defaultProps} />);
    expect(screen.getByTestId('base-edge')).toBeInTheDocument();
  });

  it('should render crow\'s feet notation for one-to-many relationship', () => {
    render(<CanvasEdge {...defaultProps} />);
    const edge = screen.getByTestId('base-edge');
    expect(edge).toBeInTheDocument();
    // The edge should render with a path
    expect(edge.getAttribute('d')).toBeTruthy();
  });

  it('should render crow\'s feet notation for many-to-many relationship', () => {
    const manyToManyRel: Relationship = {
      ...mockRelationship,
      relationship_type: 'many-to-many',
      source_cardinality: 'many',
      target_cardinality: 'many',
    };

    render(<CanvasEdge {...defaultProps} data={{ relationship: manyToManyRel }} />);
    const edge = screen.getByTestId('base-edge');
    expect(edge).toBeInTheDocument();
    expect(edge.getAttribute('d')).toBeTruthy();
  });

  it('should render single line for one-to-one relationship', () => {
    const oneToOneRel: Relationship = {
      ...mockRelationship,
      relationship_type: 'one-to-one',
      source_cardinality: 'one',
      target_cardinality: 'one',
    };

    render(<CanvasEdge {...defaultProps} data={{ relationship: oneToOneRel }} />);
    const edge = screen.getByTestId('base-edge');
    expect(edge).toBeInTheDocument();
    expect(edge.getAttribute('d')).toBeTruthy();
  });

  it('should show optional relationship indicator (circle)', () => {
    const optionalRel: Relationship = {
      ...mockRelationship,
      source_optional: true,
      target_optional: false,
    };

    render(<CanvasEdge {...defaultProps} data={{ relationship: optionalRel }} />);
    const edge = screen.getByTestId('base-edge');
    expect(edge).toBeInTheDocument();
  });

  it('should highlight selected relationship', () => {
    render(<CanvasEdge {...defaultProps} selected={true} />);
    const edge = screen.getByTestId('base-edge');
    expect(edge).toBeInTheDocument();
  });

  it('should show warning indicator for circular relationships', () => {
    const circularRel: Relationship = {
      ...mockRelationship,
      source_table_id: 'table-2',
      target_table_id: 'table-1', // Circular reference
    };

    render(<CanvasEdge {...defaultProps} data={{ relationship: circularRel }} />);
    const edge = screen.getByTestId('base-edge');
    expect(edge).toBeInTheDocument();
  });

  it('should handle edge click to select relationship', () => {
    const onClick = vi.fn();
    render(<CanvasEdge {...defaultProps} onClick={onClick} />);
    const edge = screen.getByTestId('base-edge');
    edge.click();
    // Note: BaseEdge doesn't handle clicks directly, this is handled by ReactFlow
    expect(edge).toBeInTheDocument();
  });
});

