/**
 * Flow Connection Component
 * Renders a data flow connection with labels and direction
 */

import React, { memo } from 'react';
import { BaseEdge, EdgeProps, getBezierPath } from 'reactflow';
import type { DataFlowConnection } from '@/types/dataflow';

export interface FlowConnectionData {
  connection: DataFlowConnection;
}

export const FlowConnection: React.FC<EdgeProps<FlowConnectionData>> = memo(
  ({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, selected }) => {
    const [edgePath, labelX, labelY] = getBezierPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
    });

    const connection = data?.connection;
    const label = connection?.label;

    return (
      <>
        <BaseEdge
          id={id}
          path={edgePath}
          style={{
            strokeWidth: selected ? 3 : 2,
            stroke: selected ? '#2563eb' : '#6b7280',
          }}
        />
        {label && (
          <text
            x={labelX}
            y={labelY}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-gray-700 text-xs font-medium pointer-events-none"
            style={{ fontSize: '12px' }}
          >
            {label}
          </text>
        )}
      </>
    );
  }
);

FlowConnection.displayName = 'FlowConnection';

