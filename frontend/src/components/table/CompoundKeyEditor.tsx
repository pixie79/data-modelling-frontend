/**
 * Compound Key Editor Component
 * Allows creating and managing compound keys for a table
 */

import React, { useState } from 'react';
import type { Column, CompoundKey } from '@/types/table';

export interface CompoundKeyEditorProps {
  tableId: string;
  columns: Column[];
  compoundKeys: CompoundKey[];
  onAdd: (compoundKey: CompoundKey) => void;
  onUpdate: (compoundKeyId: string, updates: Partial<CompoundKey>) => void;
  onDelete: (compoundKeyId: string) => void;
}

export const CompoundKeyEditor: React.FC<CompoundKeyEditorProps> = ({
  tableId,
  columns,
  compoundKeys,
  onAdd,
  onUpdate,
  onDelete,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [keyName, setKeyName] = useState('');
  // Default to false if there's already a primary key (single-column or compound)
  const hasExistingPK =
    columns.some((col) => col.is_primary_key) || compoundKeys.some((ck) => ck.is_primary);
  const [isPrimary, setIsPrimary] = useState(!hasExistingPK);

  const handleAddCompoundKey = () => {
    if (selectedColumns.length < 2) {
      alert('Please select at least 2 columns for a compound key');
      return;
    }

    const newCompoundKey: CompoundKey = {
      id: `compound-key-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      table_id: tableId,
      name: keyName || undefined,
      column_ids: selectedColumns,
      is_primary: isPrimary,
      created_at: new Date().toISOString(),
    };

    onAdd(newCompoundKey);

    // Reset form
    setSelectedColumns([]);
    setKeyName('');
    // Reset to false if there's already a primary key, otherwise true
    const hasExistingPK =
      columns.some((col) => col.is_primary_key) || compoundKeys.some((ck) => ck.is_primary);
    setIsPrimary(!hasExistingPK);
    setShowAddForm(false);
  };

  const handleColumnToggle = (columnId: string) => {
    setSelectedColumns((prev) =>
      prev.includes(columnId) ? prev.filter((id) => id !== columnId) : [...prev, columnId]
    );
  };

  const handleRemoveColumnFromKey = (compoundKeyId: string, columnId: string) => {
    const compoundKey = compoundKeys.find((k) => k.id === compoundKeyId);
    if (compoundKey && compoundKey.column_ids.length > 1) {
      onUpdate(compoundKeyId, {
        column_ids: compoundKey.column_ids.filter((id) => id !== columnId),
      });
    } else if (compoundKey && compoundKey.column_ids.length === 1) {
      // If only one column left, delete the compound key
      onDelete(compoundKeyId);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Compound Keys</h3>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          {showAddForm ? 'Cancel' : 'Add Compound Key'}
        </button>
      </div>

      {showAddForm && (
        <div className="p-3 border border-gray-200 rounded-lg bg-gray-50">
          <div className="space-y-2">
            <div>
              <label
                htmlFor="compound-key-name"
                className="block text-xs font-medium text-gray-700 mb-1"
              >
                Key Name (Optional)
              </label>
              <input
                id="compound-key-name"
                type="text"
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                placeholder="e.g., PK_CustomerOrder"
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
              />
            </div>

            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={isPrimary}
                  onChange={(e) => setIsPrimary(e.target.checked)}
                  className="rounded"
                  disabled={hasExistingPK && !isPrimary}
                />
                <span className="text-xs text-gray-700">
                  Primary Key
                  {hasExistingPK && !isPrimary && (
                    <span className="ml-1 text-yellow-600">(PK already exists)</span>
                  )}
                </span>
              </label>
            </div>

            <div>
              <span className="block text-xs font-medium text-gray-700 mb-1">
                Select Columns (at least 2)
              </span>
              <div className="space-y-1 max-h-32 overflow-y-auto border border-gray-200 rounded p-2 bg-white">
                {columns.map((column) => (
                  <label
                    key={column.id}
                    className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-50 p-1 rounded"
                  >
                    <input
                      type="checkbox"
                      checked={selectedColumns.includes(column.id)}
                      onChange={() => handleColumnToggle(column.id)}
                      className="rounded"
                    />
                    <span>{column.name}</span>
                    {column.is_primary_key && <span className="text-yellow-600 text-xs">PK</span>}
                  </label>
                ))}
              </div>
              {selectedColumns.length > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  Selected: {selectedColumns.length} column(s)
                </p>
              )}
            </div>

            <button
              onClick={handleAddCompoundKey}
              disabled={selectedColumns.length < 2}
              className="w-full px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create Compound Key
            </button>
          </div>
        </div>
      )}

      {compoundKeys.length > 0 && (
        <div className="space-y-2">
          {compoundKeys.map((compoundKey) => (
            <div key={compoundKey.id} className="p-2 border border-gray-200 rounded bg-white">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-700">
                    {compoundKey.name || 'Unnamed Compound Key'}
                  </span>
                  {compoundKey.is_primary && (
                    <span className="text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded">
                      Primary
                    </span>
                  )}
                </div>
                <button
                  onClick={() => onDelete(compoundKey.id)}
                  className="text-xs text-red-600 hover:text-red-800"
                >
                  Delete
                </button>
              </div>
              <div className="flex flex-wrap gap-1">
                {compoundKey.column_ids.map((columnId, index) => {
                  const column = columns.find((c) => c.id === columnId);
                  return column ? (
                    <span
                      key={columnId}
                      className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded"
                    >
                      {column.name}
                      {index < compoundKey.column_ids.length - 1 && (
                        <span className="text-blue-600">+</span>
                      )}
                      {compoundKey.column_ids.length > 1 && (
                        <button
                          onClick={() => handleRemoveColumnFromKey(compoundKey.id, columnId)}
                          className="text-blue-600 hover:text-blue-800 ml-1"
                          title="Remove column from compound key"
                        >
                          ×
                        </button>
                      )}
                    </span>
                  ) : null;
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {compoundKeys.length === 0 && !showAddForm && (
        <p className="text-xs text-gray-500 italic">No compound keys defined</p>
      )}
    </div>
  );
};
