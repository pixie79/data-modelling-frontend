/**
 * Canvas Node Component (Table)
 * Renders a table as a node on the infinite canvas
 */

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { useModelStore } from '@/stores/modelStore';
import type { Table } from '@/types/table';
import { getTableAriaLabel } from '@/utils/accessibility';

export interface TableNodeData {
  table: Table;
}

export const CanvasNode: React.FC<NodeProps<TableNodeData>> = memo(({ data, selected }) => {
  const { table } = data;
  const { selectedDomainId } = useModelStore();
  const isPrimaryDomain = table.primary_domain_id === selectedDomainId;
  const isReadOnly = !isPrimaryDomain;

  const ariaLabel = getTableAriaLabel(table.name, table.columns.length);

  return (
    <div
      className={`
        bg-white border-2 rounded-lg shadow-md min-w-[200px]
        ${selected ? 'border-blue-600 ring-2 ring-blue-200' : 'border-gray-300'}
        ${isReadOnly ? 'opacity-75' : ''}
      `}
      role="group"
      aria-label={ariaLabel}
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

      {/* Table header */}
      <div className="px-3 py-2 bg-blue-600 text-white font-semibold rounded-t-lg flex items-center justify-between">
        <span>{table.name}</span>
        {isReadOnly && (
          <span className="text-xs bg-blue-500 px-2 py-0.5 rounded" title="Read-only on this domain">
            RO
          </span>
        )}
      </div>

      {/* Columns list */}
      <div className="p-2 max-h-[300px] overflow-y-auto table-columns-scrollable">
        {table.columns.length === 0 ? (
          <div className="text-sm text-gray-400 italic py-2">No columns</div>
        ) : (
          <div className="space-y-1">
            {table.columns
              .sort((a, b) => a.order - b.order)
              .map((column) => (
                <div
                  key={column.id}
                  className="flex items-center gap-2 text-sm py-1 px-2 hover:bg-gray-50 rounded"
                >
                  <span className="flex-1 truncate">
                    {column.is_primary_key && (
                      <span className="text-yellow-600 font-bold mr-1" aria-label="Primary key">
                        PK
                      </span>
                    )}
                    {column.is_foreign_key && (
                      <span className="text-green-600 font-bold mr-1" aria-label="Foreign key">
                        FK
                      </span>
                    )}
                    <span className={column.nullable ? 'text-gray-600' : 'font-medium'}>
                      {column.name}
                    </span>
                  </span>
                  <span className="text-xs text-gray-500">{column.data_type}</span>
                  {!column.nullable && (
                    <span className="text-xs text-red-600" aria-label="Not nullable">
                      *
                    </span>
                  )}
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
});

CanvasNode.displayName = 'CanvasNode';

