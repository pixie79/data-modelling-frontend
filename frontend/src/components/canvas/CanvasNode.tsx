/**
 * Canvas Node Component (Table)
 * Renders a table as a node on the infinite canvas
 */

import React, { memo, useMemo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { useModelStore } from '@/stores/modelStore';
import type { Table, QualityTier } from '@/types/table';
import { getTableAriaLabel } from '@/utils/accessibility';

export interface TableNodeData {
  table: Table;
  modelType?: 'conceptual' | 'logical' | 'physical';
  nodeType?: 'table' | 'system' | 'product' | 'compute-asset';
  isOwnedByDomain?: boolean; // True if owned by current domain
  isShared?: boolean; // True if this is a shared resource from another domain
  expandColumns?: boolean; // True to show all columns without max-height limit
}

export const CanvasNode: React.FC<NodeProps<TableNodeData>> = memo(({ data, selected }) => {
  const {
    table,
    modelType = 'conceptual',
    isOwnedByDomain,
    isShared = false,
    expandColumns = false,
  } = data;
  const { selectedDomainId, bpmnProcesses, relationships } = useModelStore();
  const isPrimaryDomain = table.primary_domain_id === selectedDomainId;
  const isReadOnly = !isPrimaryDomain || (isOwnedByDomain !== undefined && !isOwnedByDomain);

  // Check if table has BPMN link via transformation_links
  const hasBPMNLink =
    bpmnProcesses?.some(
      (p) =>
        p.domain_id === selectedDomainId &&
        p.transformation_links?.some(
          (link) => link.source_table_id === table.id || link.target_table_id === table.id
        )
    ) ?? false;

  // For shared resources (from other domains), use pastel shades and dashed border
  const isCrossDomain =
    isShared || (!isPrimaryDomain && table.visible_domains.includes(selectedDomainId || ''));

  // Determine what to show based on model type view
  const showColumns = modelType !== 'conceptual'; // Conceptual view: no columns
  const showDataTypes = modelType === 'physical'; // Physical view: show data types
  const showConstraints = modelType === 'physical'; // Physical view: show constraints

  // Filter columns based on view type and sort by order
  const visibleColumns = useMemo(() => {
    if (!showColumns) return [];

    let cols: typeof table.columns = [];
    if (modelType === 'logical') {
      // Logical view: show only keys (primary keys, foreign keys, and unique indexes)
      // Exclude columns that are part of compound keys (they'll be shown separately)
      const compoundKeyColumnIds = new Set(
        (table.compoundKeys || []).flatMap((ck) => ck.column_ids)
      );
      cols = table.columns.filter(
        (col) =>
          (col.is_primary_key || col.is_foreign_key || col.is_unique) &&
          !compoundKeyColumnIds.has(col.id)
      );
    } else if (modelType === 'physical') {
      // Physical view: show all columns
      cols = table.columns;
    }

    // Sort by order
    return [...cols].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [table.columns, table.compoundKeys, modelType, showColumns]);

  // Get compound keys for display in logical view
  const compoundKeys = useMemo(() => {
    if (!showColumns || modelType !== 'logical') return [];

    // Get compound keys defined on this table (PK/UK)
    const keys = (table.compoundKeys || []).map((ck) => {
      const columnNames = ck.column_ids
        .map((colId) => table.columns.find((c) => c.id === colId)?.name)
        .filter(Boolean)
        .join(' + ');
      return {
        id: ck.id,
        name: ck.name || 'Compound Key',
        columnNames,
        isPrimary: ck.is_primary,
        isForeignKey: false,
      };
    });

    // Find composite foreign keys: relationships where this table is the source
    // and the source_key references a compound key
    const compositeFKs = (relationships || [])
      .filter((rel) => {
        // This table is the source of the relationship
        const isSource = rel.source_id === table.id || rel.source_table_id === table.id;
        if (!isSource) return false;

        // Check if source_key references a compound key on this table
        const sourceKey = rel.source_key;
        if (!sourceKey) return false;

        // If source_key matches a compound key ID, it's a composite FK
        const isCompoundKey = (table.compoundKeys || []).some((ck) => ck.id === sourceKey);
        return isCompoundKey;
      })
      .map((rel) => {
        const ck = (table.compoundKeys || []).find((ck) => ck.id === rel.source_key);
        if (!ck) return null;

        const columnNames = ck.column_ids
          .map((colId) => table.columns.find((c) => c.id === colId)?.name)
          .filter(Boolean)
          .join(' + ');

        return {
          id: `fk-${rel.id}`,
          name: ck.name || 'Composite FK',
          columnNames,
          isPrimary: false,
          isForeignKey: true,
        };
      })
      .filter(Boolean) as typeof keys;

    // Also check for columns marked as FK that are part of a compound key
    // (individual FK columns referencing a compound PK on another table)
    const compoundKeyColumnIds = new Set((table.compoundKeys || []).flatMap((ck) => ck.column_ids));
    const fkColumnsInCompoundKeys = table.columns.filter(
      (col) => col.is_foreign_key && compoundKeyColumnIds.has(col.id)
    );

    // Group FK columns by their compound key
    if (fkColumnsInCompoundKeys.length > 0) {
      for (const ck of table.compoundKeys || []) {
        const fkColsInThisKey = fkColumnsInCompoundKeys.filter((col) =>
          ck.column_ids.includes(col.id)
        );
        // If all columns in this compound key are FKs, treat it as a composite FK
        if (fkColsInThisKey.length === ck.column_ids.length && fkColsInThisKey.length > 0) {
          // Check if we already have this key listed
          const existingKey = keys.find((k) => k.id === ck.id);
          if (existingKey) {
            existingKey.isForeignKey = true;
          } else {
            const columnNames = ck.column_ids
              .map((colId) => table.columns.find((c) => c.id === colId)?.name)
              .filter(Boolean)
              .join(' + ');
            keys.push({
              id: ck.id,
              name: ck.name || 'Composite FK',
              columnNames,
              isPrimary: false,
              isForeignKey: true,
            });
          }
        }
      }
    }

    // Merge and deduplicate (prefer composite FK designation if both exist)
    const allKeys = [...keys];
    for (const fk of compositeFKs) {
      if (!allKeys.some((k) => k.columnNames === fk.columnNames)) {
        allKeys.push(fk);
      }
    }

    return allKeys;
  }, [table.compoundKeys, table.columns, table.id, relationships, modelType, showColumns]);

  // Get quality tier and determine title bar color
  const qualityTier: QualityTier =
    (table.metadata?.quality_tier as QualityTier) || table.data_level || 'operational';
  const titleBarColor = useMemo(() => {
    // Cross-domain tables use pastel shades
    if (isCrossDomain) {
      switch (qualityTier) {
        case 'bronze':
          return 'bg-amber-200'; // Pastel bronze
        case 'silver':
          return 'bg-gray-200'; // Pastel silver
        case 'gold':
          return 'bg-yellow-200'; // Pastel gold
        case 'operational':
        default:
          return 'bg-blue-200'; // Pastel blue
      }
    }
    // Owned tables use bold colors
    switch (qualityTier) {
      case 'bronze':
        return 'bg-amber-600'; // Bronze color
      case 'silver':
        return 'bg-gray-400'; // Silver color
      case 'gold':
        return 'bg-yellow-500'; // Gold color
      case 'operational':
      default:
        return 'bg-blue-600'; // Operational (blue)
    }
  }, [qualityTier, isCrossDomain]);

  const ariaLabel = getTableAriaLabel(table.name, table.columns.length);

  return (
    <div
      className={`
        bg-white rounded-lg shadow-md min-w-[200px]
        ${isCrossDomain ? 'border-2 border-dashed' : 'border-2 border-solid'}
        ${selected ? 'border-blue-600 ring-2 ring-blue-200' : isCrossDomain ? 'border-gray-400' : 'border-gray-300'}
        ${isReadOnly ? 'opacity-75' : ''}
      `}
      role="group"
      aria-label={ariaLabel}
    >
      {/* Connection handles - corners */}
      <Handle
        type="target"
        position={Position.Top}
        id="top-left"
        style={{ left: '0%' }}
        className="w-2 h-2"
      />
      <Handle
        type="target"
        position={Position.Top}
        id="top-right"
        style={{ left: '100%' }}
        className="w-2 h-2"
      />
      <Handle
        type="target"
        position={Position.Bottom}
        id="bottom-left"
        style={{ left: '0%' }}
        className="w-2 h-2"
      />
      <Handle
        type="target"
        position={Position.Bottom}
        id="bottom-right"
        style={{ left: '100%' }}
        className="w-2 h-2"
      />
      <Handle
        type="source"
        position={Position.Top}
        id="src-top-left"
        style={{ left: '0%' }}
        className="w-2 h-2"
      />
      <Handle
        type="source"
        position={Position.Top}
        id="src-top-right"
        style={{ left: '100%' }}
        className="w-2 h-2"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="src-bottom-left"
        style={{ left: '0%' }}
        className="w-2 h-2"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="src-bottom-right"
        style={{ left: '100%' }}
        className="w-2 h-2"
      />

      {/* Connection handles - top and bottom center */}
      <Handle
        type="target"
        position={Position.Top}
        id="top-center"
        style={{ left: '50%' }}
        className="w-2 h-2"
      />
      <Handle
        type="target"
        position={Position.Bottom}
        id="bottom-center"
        style={{ left: '50%' }}
        className="w-2 h-2"
      />
      <Handle
        type="source"
        position={Position.Top}
        id="src-top-center"
        style={{ left: '50%' }}
        className="w-2 h-2"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="src-bottom-center"
        style={{ left: '50%' }}
        className="w-2 h-2"
      />

      {/* Connection handles - left side (3 evenly spaced: 25%, 50%, 75%) */}
      <Handle
        type="target"
        position={Position.Left}
        id="left-top"
        style={{ top: '25%' }}
        className="w-2 h-2"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left-center"
        style={{ top: '50%' }}
        className="w-2 h-2"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left-bottom"
        style={{ top: '75%' }}
        className="w-2 h-2"
      />
      <Handle
        type="source"
        position={Position.Left}
        id="src-left-top"
        style={{ top: '25%' }}
        className="w-2 h-2"
      />
      <Handle
        type="source"
        position={Position.Left}
        id="src-left-center"
        style={{ top: '50%' }}
        className="w-2 h-2"
      />
      <Handle
        type="source"
        position={Position.Left}
        id="src-left-bottom"
        style={{ top: '75%' }}
        className="w-2 h-2"
      />

      {/* Connection handles - right side (3 evenly spaced: 25%, 50%, 75%) */}
      <Handle
        type="target"
        position={Position.Right}
        id="right-top"
        style={{ top: '25%' }}
        className="w-2 h-2"
      />
      <Handle
        type="target"
        position={Position.Right}
        id="right-center"
        style={{ top: '50%' }}
        className="w-2 h-2"
      />
      <Handle
        type="target"
        position={Position.Right}
        id="right-bottom"
        style={{ top: '75%' }}
        className="w-2 h-2"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="src-right-top"
        style={{ top: '25%' }}
        className="w-2 h-2"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="src-right-center"
        style={{ top: '50%' }}
        className="w-2 h-2"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="src-right-bottom"
        style={{ top: '75%' }}
        className="w-2 h-2"
      />

      {/* Table header with quality tier color */}
      <div
        className={`px-3 py-2 ${titleBarColor} text-white font-semibold rounded-t-lg flex items-center justify-between`}
      >
        <span>{table.name}</span>
        <div className="flex items-center gap-2">
          {qualityTier !== 'operational' && (
            <span
              className="text-xs bg-black bg-opacity-20 px-2 py-0.5 rounded capitalize"
              title={`Quality Tier: ${qualityTier}`}
            >
              {qualityTier}
            </span>
          )}
          {hasBPMNLink && (
            <span
              className="text-xs bg-purple-600 bg-opacity-80 px-2 py-0.5 rounded flex items-center gap-1"
              title="Has BPMN process model - click to view details"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              BPMN
            </span>
          )}
          {isReadOnly && (
            <span
              className="text-xs bg-black bg-opacity-20 px-2 py-0.5 rounded"
              title="Read-only on this domain"
            >
              RO
            </span>
          )}
        </div>
      </div>

      {/* Columns list - only show in logical/physical views */}
      {showColumns && (
        <div
          className={`p-2 ${expandColumns ? '' : 'max-h-[300px] overflow-y-auto'} table-columns-scrollable`}
        >
          {visibleColumns.length === 0 && compoundKeys.length === 0 ? (
            <div className="text-sm text-gray-400 italic py-2">
              {modelType === 'logical' ? 'No keys' : 'No columns'}
            </div>
          ) : (
            <div className="space-y-1">
              {/* Compound keys (shown first in logical view) */}
              {compoundKeys.map((ck) => (
                <div
                  key={ck.id}
                  className="flex items-center gap-2 text-sm py-1 px-2 hover:bg-gray-50 rounded"
                  title={`${ck.isPrimary ? 'Primary ' : ''}${ck.isForeignKey ? 'Foreign ' : ''}Compound Key: ${ck.columnNames}`}
                >
                  <span className="flex-1 truncate">
                    {ck.isPrimary && (
                      <span
                        className="text-yellow-600 font-bold mr-1"
                        aria-label="Primary compound key"
                      >
                        PK
                      </span>
                    )}
                    {ck.isForeignKey && (
                      <span
                        className="text-green-600 font-bold mr-1"
                        aria-label="Foreign compound key"
                      >
                        FK
                      </span>
                    )}
                    {!ck.isPrimary && !ck.isForeignKey && (
                      <span className="text-purple-600 font-bold mr-1" aria-label="Compound key">
                        CK
                      </span>
                    )}
                    <span className="font-medium text-gray-700">{ck.columnNames}</span>
                  </span>
                </div>
              ))}
              {/* Individual columns */}
              {visibleColumns
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
                      {/* Show IX only if unique AND not a primary key */}
                      {column.is_unique && !column.is_primary_key && (
                        <span className="text-purple-600 font-bold mr-1" aria-label="Unique index">
                          IX
                        </span>
                      )}
                      <span className={column.nullable ? 'text-gray-600' : 'font-medium'}>
                        {column.name}
                      </span>
                    </span>
                    {showDataTypes && (
                      <span className="text-xs text-gray-500">{column.data_type}</span>
                    )}
                    {showConstraints && !column.nullable && (
                      <span className="text-xs text-red-600" aria-label="Not nullable">
                        *
                      </span>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

CanvasNode.displayName = 'CanvasNode';
