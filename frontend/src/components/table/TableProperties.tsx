/**
 * Table Properties Component
 * Displays and allows editing of table metadata and properties
 */

import React from 'react';
import { useModelStore } from '@/stores/modelStore';
import { formatDateReadable } from '@/utils/formatting';

export interface TablePropertiesProps {
  tableId: string;
  workspaceId: string;
  onClose?: () => void;
}

export const TableProperties: React.FC<TablePropertiesProps> = ({
  tableId,
  onClose,
}) => {
  const { tables } = useModelStore();
  const table = tables.find((t) => t.id === tableId);

  if (!table) {
    return (
      <div className="p-4 text-gray-500">
        <p>Table not found</p>
      </div>
    );
  }

  return (
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

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Table Name</label>
        <div className="text-lg font-semibold">{table.name}</div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Model Type</label>
        <div className="text-sm text-gray-600 capitalize">{table.model_type}</div>
      </div>

      {table.description && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <div className="text-sm text-gray-600">{table.description}</div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Statistics</label>
        <div className="text-sm text-gray-600 space-y-1">
          <div>Columns: {table.columns.length}</div>
          <div>Primary Keys: {table.columns.filter((c) => c.is_primary_key).length}</div>
          <div>Foreign Keys: {table.columns.filter((c) => c.is_foreign_key).length}</div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Metadata</label>
        <div className="text-sm text-gray-600 space-y-1">
          <div>Created: {formatDateReadable(table.created_at)}</div>
          <div>Last Modified: {formatDateReadable(table.last_modified_at)}</div>
          <div>Primary Domain: {table.primary_domain_id}</div>
        </div>
      </div>
    </div>
  );
};

