/**
 * Table Properties Component
 * Displays and allows editing of table metadata and properties
 */

import React, { useState } from 'react';
import { useModelStore } from '@/stores/modelStore';
import { useSDKModeStore } from '@/services/sdk/sdkMode';
import { formatDateReadable } from '@/utils/formatting';
import { ColumnDetailsModal } from './ColumnDetailsModal';
import { TableMetadataModal } from './TableMetadataModal';
import type { Column } from '@/types/table';

export interface TablePropertiesProps {
  tableId: string;
  workspaceId: string;
  onClose?: () => void;
}

export const TableProperties: React.FC<TablePropertiesProps> = ({
  tableId,
  workspaceId,
  onClose,
}) => {
  const { tables, updateColumn, updateColumnRemote } = useModelStore();
  const { mode } = useSDKModeStore();
  const table = tables.find((t) => t.id === tableId);

  const [selectedColumnId, setSelectedColumnId] = useState<string | null>(null);
  const [showTableMetadata, setShowTableMetadata] = useState(false);

  if (!table) {
    return (
      <div className="p-4 text-gray-500">
        <p>Table not found</p>
      </div>
    );
  }

  const handleColumnSave = async (columnId: string, updates: Partial<Column>) => {
    // Update local state
    updateColumn(tableId, columnId, updates);

    // Update remote if online
    if (mode === 'online') {
      try {
        await updateColumnRemote(workspaceId, tableId, columnId, updates);
      } catch (error) {
        console.error('Failed to update column:', error);
        throw error;
      }
    }
  };

  const selectedColumn = selectedColumnId
    ? table.columns.find((c) => c.id === selectedColumnId)
    : null;

  return (
    <>
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Table Properties</h2>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
              aria-label="Close properties"
            >
              ✕
            </button>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 mb-4 pb-4 border-b border-gray-200">
          <button
            onClick={() => setShowTableMetadata(true)}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Edit Table Metadata
          </button>
        </div>

        {/* Basic Info */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Table Name</label>
          <div className="text-lg font-semibold">{table.name}</div>
        </div>

        {table.alias && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Alias</label>
            <div className="text-sm text-gray-600">{table.alias}</div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Model Type</label>
          <div className="text-sm text-gray-600 capitalize">{table.model_type}</div>
        </div>

        {table.description && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <div className="text-sm text-gray-600 whitespace-pre-wrap">{table.description}</div>
          </div>
        )}

        {table.tags && table.tags.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
            <div className="flex flex-wrap gap-2">
              {table.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Columns */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Columns</label>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {table.columns.map((column) => (
              <div
                key={column.id}
                className="flex items-center justify-between p-2 border border-gray-200 rounded hover:bg-gray-50"
              >
                <div className="flex-1">
                  <div className="font-medium text-sm">{column.name}</div>
                  <div className="text-xs text-gray-500">
                    {column.data_type}
                    {column.nullable && ' (nullable)'}
                    {column.is_primary_key && ' [PK]'}
                    {column.is_foreign_key && ' [FK]'}
                  </div>
                  {column.constraints && Object.keys(column.constraints).length > 0 && (
                    <div className="text-xs text-blue-600 mt-1">
                      {Object.keys(column.constraints).length} constraint(s)
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setSelectedColumnId(column.id)}
                  className="ml-2 px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                >
                  Details
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Statistics */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Statistics</label>
          <div className="text-sm text-gray-600 space-y-1">
            <div>Columns: {table.columns.length}</div>
            <div>Primary Keys: {table.columns.filter((c) => c.is_primary_key).length}</div>
            <div>Foreign Keys: {table.columns.filter((c) => c.is_foreign_key).length}</div>
          </div>
        </div>

        {/* Metadata */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Metadata</label>
          <div className="text-sm text-gray-600 space-y-1">
            <div>Created: {formatDateReadable(table.created_at)}</div>
            <div>Last Modified: {formatDateReadable(table.last_modified_at)}</div>
            <div>Primary Domain: {table.primary_domain_id}</div>
          </div>
        </div>
      </div>

      {/* Column Details Modal */}
      {selectedColumn && (
        <ColumnDetailsModal
          column={selectedColumn}
          tableId={tableId}
          workspaceId={workspaceId}
          isOpen={!!selectedColumnId}
          onClose={() => setSelectedColumnId(null)}
          onSave={handleColumnSave}
        />
      )}

      {/* Table Metadata Modal */}
      {table && (
        <TableMetadataModal
          table={table}
          isOpen={showTableMetadata}
          onClose={() => setShowTableMetadata(false)}
        />
      )}
    </>
  );
};
