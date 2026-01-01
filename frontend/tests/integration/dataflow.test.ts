/**
 * Integration tests for Data Flow Diagrams
 * Tests complete workflow of creating and managing data flow diagrams
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useModelStore } from '@/stores/modelStore';
import { dataFlowService } from '@/services/api/dataFlowService';
import type { DataFlowDiagram, DataFlowNode, DataFlowConnection } from '@/types/dataflow';
import type { CreateDataFlowDiagramRequest } from '@/types/api';

vi.mock('@/services/api/dataFlowService');

describe('Data Flow Diagram Integration', () => {
  const workspaceId = 'workspace-1';

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store state
    useModelStore.setState({
      dataFlowDiagrams: [],
      selectedDataFlowDiagramId: null,
    });
  });

  it('should create a data flow diagram with nodes and connections', async () => {
    const request: CreateDataFlowDiagramRequest = {
      name: 'Customer Data Flow',
      nodes: [
        {
          type: 'source',
          label: 'Customer DB',
          position_x: 100,
          position_y: 100,
          width: 150,
          height: 100,
        },
        {
          type: 'processor',
          label: 'Kafka Topic',
          position_x: 300,
          position_y: 100,
          width: 150,
          height: 100,
        },
        {
          type: 'target',
          label: 'Analytics DB',
          position_x: 500,
          position_y: 100,
          width: 150,
          height: 100,
        },
      ],
      connections: [
        {
          source_node_id: 'node-1',
          target_node_id: 'node-2',
          label: 'Customer Events',
        },
        {
          source_node_id: 'node-2',
          target_node_id: 'node-3',
          label: 'Processed Events',
        },
      ],
    };

    const mockDiagram: DataFlowDiagram = {
      id: 'diagram-1',
      workspace_id: workspaceId,
      name: 'Customer Data Flow',
      nodes: [
        {
          id: 'node-1',
          diagram_id: 'diagram-1',
          type: 'source',
          label: 'Customer DB',
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
        {
          id: 'node-3',
          diagram_id: 'diagram-1',
          type: 'target',
          label: 'Analytics DB',
          position_x: 500,
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
          label: 'Customer Events',
        },
        {
          id: 'conn-2',
          diagram_id: 'diagram-1',
          source_node_id: 'node-2',
          target_node_id: 'node-3',
          label: 'Processed Events',
        },
      ],
      created_at: '2025-01-01T00:00:00Z',
      last_modified_at: '2025-01-01T00:00:00Z',
    };

    vi.mocked(dataFlowService.createDataFlowDiagram).mockResolvedValue(mockDiagram);

    const diagram = await useModelStore.getState().createDataFlowDiagramRemote(workspaceId, request);

    expect(diagram).toEqual(mockDiagram);
    expect(useModelStore.getState().dataFlowDiagrams).toHaveLength(1);
    expect(useModelStore.getState().dataFlowDiagrams[0].nodes).toHaveLength(3);
    expect(useModelStore.getState().dataFlowDiagrams[0].connections).toHaveLength(2);
  });

  it('should link data flow diagram to conceptual table', () => {
    const diagram: DataFlowDiagram = {
      id: 'diagram-1',
      workspace_id: workspaceId,
      name: 'Test Diagram',
      nodes: [],
      connections: [],
      created_at: '2025-01-01T00:00:00Z',
      last_modified_at: '2025-01-01T00:00:00Z',
    };

    useModelStore.getState().addDataFlowDiagram(diagram);
    useModelStore.getState().linkDataFlowToTable('diagram-1', 'table-1');

    const updatedDiagram = useModelStore.getState().dataFlowDiagrams.find((d) => d.id === 'diagram-1');
    expect(updatedDiagram?.linked_tables).toContain('table-1');
  });

  it('should update node positions when dragged', async () => {
    const diagram: DataFlowDiagram = {
      id: 'diagram-1',
      workspace_id: workspaceId,
      name: 'Test Diagram',
      nodes: [
        {
          id: 'node-1',
          diagram_id: 'diagram-1',
          type: 'source',
          label: 'Source',
          position_x: 100,
          position_y: 100,
          width: 150,
          height: 100,
        },
      ],
      connections: [],
      created_at: '2025-01-01T00:00:00Z',
      last_modified_at: '2025-01-01T00:00:00Z',
    };

    useModelStore.getState().addDataFlowDiagram(diagram);
    useModelStore.getState().updateDataFlowNode('diagram-1', 'node-1', {
      position_x: 200,
      position_y: 200,
    });

    const updatedDiagram = useModelStore.getState().dataFlowDiagrams.find((d) => d.id === 'diagram-1');
    expect(updatedDiagram?.nodes[0].position_x).toBe(200);
    expect(updatedDiagram?.nodes[0].position_y).toBe(200);
  });

  it('should add connection between nodes', () => {
    const diagram: DataFlowDiagram = {
      id: 'diagram-1',
      workspace_id: workspaceId,
      name: 'Test Diagram',
      nodes: [
        {
          id: 'node-1',
          diagram_id: 'diagram-1',
          type: 'source',
          label: 'Source',
          position_x: 100,
          position_y: 100,
          width: 150,
          height: 100,
        },
        {
          id: 'node-2',
          diagram_id: 'diagram-1',
          type: 'target',
          label: 'Target',
          position_x: 300,
          position_y: 100,
          width: 150,
          height: 100,
        },
      ],
      connections: [],
      created_at: '2025-01-01T00:00:00Z',
      last_modified_at: '2025-01-01T00:00:00Z',
    };

    useModelStore.getState().addDataFlowDiagram(diagram);

    const connection: DataFlowConnection = {
      id: 'conn-1',
      diagram_id: 'diagram-1',
      source_node_id: 'node-1',
      target_node_id: 'node-2',
      label: 'Data Flow',
    };

    useModelStore.getState().addDataFlowConnection('diagram-1', connection);

    const updatedDiagram = useModelStore.getState().dataFlowDiagrams.find((d) => d.id === 'diagram-1');
    expect(updatedDiagram?.connections).toHaveLength(1);
    expect(updatedDiagram?.connections[0].label).toBe('Data Flow');
  });
});

