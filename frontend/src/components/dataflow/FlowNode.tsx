/**
 * Flow Node Component
 * Renders a data flow node with abstract icons
 */

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import type { DataFlowNode } from '@/types/dataflow';

export interface FlowNodeData {
  node: DataFlowNode;
  onNodeClick?: (nodeId: string) => void;
}

// Icon components for different node types
const SourceIcon: React.FC = () => (
  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
  </svg>
);

const ProcessorIcon: React.FC = () => (
  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
  </svg>
);

const TargetIcon: React.FC = () => (
  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
  </svg>
);

const StorageIcon: React.FC = () => (
  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
  </svg>
);

const getNodeIcon = (type: DataFlowNode['type']) => {
  switch (type) {
    case 'source':
      return <SourceIcon />;
    case 'processor':
      return <ProcessorIcon />;
    case 'target':
      return <TargetIcon />;
    case 'storage':
      return <StorageIcon />;
    default:
      return <SourceIcon />;
  }
};

const getNodeColor = (type: DataFlowNode['type']) => {
  switch (type) {
    case 'source':
      return 'bg-green-100 border-green-500 text-green-800';
    case 'processor':
      return 'bg-blue-100 border-blue-500 text-blue-800';
    case 'target':
      return 'bg-purple-100 border-purple-500 text-purple-800';
    case 'storage':
      return 'bg-yellow-100 border-yellow-500 text-yellow-800';
    default:
      return 'bg-gray-100 border-gray-500 text-gray-800';
  }
};

export const FlowNode: React.FC<NodeProps<FlowNodeData>> = memo(({ data, selected }) => {
  const { node, onNodeClick } = data;
  const colorClass = getNodeColor(node.type);
  const icon = getNodeIcon(node.type);

  const handleClick = () => {
    if (onNodeClick) {
      onNodeClick(node.id);
    }
  };

  return (
    <div
      className={`
        ${colorClass}
        border-2 rounded-lg shadow-md min-w-[150px] min-h-[100px]
        flex flex-col items-center justify-center p-4 cursor-pointer
        transition-all hover:shadow-lg
        ${selected ? 'ring-2 ring-blue-500 ring-offset-2' : ''}
      `}
      onClick={handleClick}
      role="group"
      aria-label={`Data flow node: ${node.label}, type: ${node.type}`}
    >
      {/* Connection handles */}
      <Handle type="target" position={Position.Top} className="w-3 h-3" />
      <Handle type="target" position={Position.Bottom} className="w-3 h-3" />
      <Handle type="target" position={Position.Left} className="w-3 h-3" />
      <Handle type="target" position={Position.Right} className="w-3 h-3" />
      <Handle type="source" position={Position.Top} className="w-3 h-3" />
      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
      <Handle type="source" position={Position.Left} className="w-3 h-3" />
      <Handle type="source" position={Position.Right} className="w-3 h-3" />

      {/* Icon */}
      <div className="mb-2">{icon}</div>

      {/* Label */}
      <div className="text-sm font-semibold text-center">{node.label}</div>

      {/* Metadata tooltip */}
      {node.metadata && Object.keys(node.metadata).length > 0 && (
        <div className="mt-2 text-xs text-gray-600 text-center">
          {Object.entries(node.metadata)
            .slice(0, 2)
            .map(([key, value]) => (
              <div key={key}>
                {key}: {String(value)}
              </div>
            ))}
        </div>
      )}
    </div>
  );
});

FlowNode.displayName = 'FlowNode';

