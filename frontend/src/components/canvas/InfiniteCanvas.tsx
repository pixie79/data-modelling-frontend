/**
 * Infinite Canvas Component
 * ReactFlow-based infinite canvas for data modeling
 */

import React, { useMemo } from 'react';
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
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useModelStore } from '@/stores/modelStore';
import { useCanvas } from '@/hooks/useCanvas';
import { CanvasNode } from './CanvasNode';
import { CanvasEdge } from './CanvasEdge';

export interface InfiniteCanvasProps {
  workspaceId: string;
  domainId: string;
}

// Custom node and edge types
const nodeTypes: NodeTypes = {
  table: CanvasNode,
};

const edgeTypes: EdgeTypes = {
  cardinality: CanvasEdge,
};

export const InfiniteCanvas: React.FC<InfiniteCanvasProps> = ({ workspaceId, domainId }) => {
  const {
    tables,
    relationships,
    selectedTableId,
    selectedRelationshipId,
  } = useModelStore();

  // Use canvas hook for interaction handlers
  const { onNodeClick, onNodeDragStop, onEdgeClick, onConnect } = useCanvas(workspaceId, domainId);

  // Filter tables visible on current domain
  const visibleTables = useMemo(() => {
    return tables.filter(
      (table) =>
        table.visible_domains.includes(domainId) || table.primary_domain_id === domainId
    );
  }, [tables, domainId]);

  // Filter relationships for current domain
  const domainRelationships = useMemo(() => {
    return relationships.filter((rel) => rel.domain_id === domainId);
  }, [relationships, domainId]);

  // Convert tables to ReactFlow nodes
  const initialNodes: Node[] = useMemo(() => {
    return visibleTables.map((table) => ({
      id: table.id,
      type: 'table',
      position: { x: table.position_x, y: table.position_y },
      data: { table },
      selected: selectedTableId === table.id,
    }));
  }, [visibleTables, selectedTableId]);

  // Convert relationships to ReactFlow edges
  const initialEdges: Edge[] = useMemo(() => {
    return domainRelationships
      .filter((rel) => {
        // Only include edges where both tables are visible
        const sourceVisible = visibleTables.some((t) => t.id === rel.source_table_id);
        const targetVisible = visibleTables.some((t) => t.id === rel.target_table_id);
        return sourceVisible && targetVisible;
      })
      .map((relationship) => ({
        id: relationship.id,
        type: 'cardinality',
        source: relationship.source_table_id,
        target: relationship.target_table_id,
        data: { relationship },
        selected: selectedRelationshipId === relationship.id,
        animated: relationship.is_circular,
        style: relationship.is_circular
          ? { stroke: '#f59e0b', strokeWidth: 2 }
          : { stroke: '#374151', strokeWidth: 2 },
      }));
  }, [domainRelationships, visibleTables, selectedRelationshipId]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update nodes and edges when data changes
  React.useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);

  React.useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);


  return (
    <div className="w-full h-full" data-testid="infinite-canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onConnect={onConnect}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        attributionPosition="bottom-left"
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
};

