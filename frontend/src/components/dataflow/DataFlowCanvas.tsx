/**
 * Data Flow Canvas Component
 * ReactFlow-based canvas for data flow diagrams
 */

import React, { useMemo, useEffect } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  NodeTypes,
  EdgeTypes,
  Connection,
  addEdge,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useModelStore } from '@/stores/modelStore';
import { useSDKModeStore } from '@/services/sdk/sdkMode';
import { FlowNode } from './FlowNode';
import { FlowConnection } from './FlowConnection';

export interface DataFlowCanvasProps {
  workspaceId: string;
  diagramId: string;
}

// Custom node and edge types
const nodeTypes: NodeTypes = {
  flowNode: FlowNode,
};

const edgeTypes: EdgeTypes = {
  flowConnection: FlowConnection,
};

export const DataFlowCanvas: React.FC<DataFlowCanvasProps> = ({ workspaceId, diagramId }) => {
  const {
    dataFlowDiagrams,
    updateDataFlowNode,
    addDataFlowConnection,
    updateDataFlowDiagramRemote,
  } = useModelStore();

  // Get current diagram
  const diagram = useMemo(() => {
    return dataFlowDiagrams.find((d) => d.id === diagramId);
  }, [dataFlowDiagrams, diagramId]);

  // Convert nodes to ReactFlow nodes
  const initialNodes: Node[] = useMemo(() => {
    if (!diagram) return [];
    return diagram.nodes.map((node) => ({
      id: node.id,
      type: 'flowNode',
      position: { x: node.position_x, y: node.position_y },
      data: {
        node,
        onNodeClick: (nodeId: string) => {
          // Handle node click if needed
          console.log('Node clicked:', nodeId);
        },
      },
      style: {
        width: node.width || 150,
        height: node.height || 100,
      },
    }));
  }, [diagram]);

  // Convert connections to ReactFlow edges
  const initialEdges: Edge[] = useMemo(() => {
    if (!diagram) return [];
    return diagram.connections.map((conn) => ({
      id: conn.id,
      type: 'flowConnection',
      source: conn.source_node_id,
      target: conn.target_node_id,
      data: { connection: conn },
      label: conn.label,
    }));
  }, [diagram]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update nodes and edges when diagram changes
  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  // Handle node position changes
  const onNodeDragStop = (_event: React.MouseEvent, node: Node) => {
    if (!diagram) return;
    const flowNode = diagram.nodes.find((n) => n.id === node.id);
    if (flowNode) {
      updateDataFlowNode(diagram.id, node.id, {
        position_x: node.position.x,
        position_y: node.position.y,
      });
      // Update remote if online
      const { mode } = useSDKModeStore.getState();
      if (mode === 'online') {
        updateDataFlowDiagramRemote(workspaceId, diagram.id, {
          nodes: diagram.nodes.map((n) =>
            n.id === node.id
              ? {
                  id: n.id,
                  position_x: node.position.x,
                  position_y: node.position.y,
                }
              : {
                  id: n.id,
                  type: n.type,
                  label: n.label,
                  position_x: n.position_x,
                  position_y: n.position_y,
                  width: n.width,
                  height: n.height,
                }
          ),
        }).catch((err) => {
          console.error('Failed to update diagram:', err);
        });
      }
    }
  };

  // Handle new connections
  const onConnect = (connection: Connection) => {
    if (!diagram || !connection.source || !connection.target) return;

    setEdges((eds) => addEdge(connection, eds));

    // Add to store (Connection doesn't have label, so we'll use undefined)
    addDataFlowConnection(diagram.id, {
      id: `conn-${Date.now()}`,
      diagram_id: diagram.id,
      source_node_id: connection.source,
      target_node_id: connection.target,
      label: undefined,
    });

    // Update remote if online
    const { mode } = useSDKModeStore.getState();
    if (mode === 'online') {
      updateDataFlowDiagramRemote(workspaceId, diagram.id, {
        connections: [
          ...diagram.connections,
          {
            source_node_id: connection.source,
            target_node_id: connection.target,
            label: undefined,
          },
        ],
      }).catch((err) => {
        console.error('Failed to update diagram:', err);
      });
    }
  };

  if (!diagram) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">No data flow diagram found</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
};

