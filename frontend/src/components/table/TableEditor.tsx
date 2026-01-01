/**
 * Table Editor Component
 * Allows editing table properties and columns
 */

import React, { useState, useEffect } from 'react';
import { useModelStore } from '@/stores/modelStore';
import { ColumnEditor } from './ColumnEditor';
import { isValidTableName } from '@/utils/validation';
import type { Column } from '@/types/table';

export interface TableEditorProps {
  tableId: string;
  workspaceId: string;
  onClose?: () => void;
}

export const TableEditor: React.FC<TableEditorProps> = ({ tableId, workspaceId }) => {
  const { tables, updateTable, updateTableRemote } = useModelStore();
  const table = tables.find((t) => t.id === tableId);

  const [name, setName] = useState(table?.name || '');
  const [alias, setAlias] = useState(table?.alias || '');
  const [columns, setColumns] = useState<Column[]>(table?.columns || []);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (table) {
      setName(table.name);
      setAlias(table.alias || '');
      setColumns(table.columns);
    }
  }, [table]);

  const validateName = (newName: string): boolean => {
    if (!newName || newName.trim().length === 0) {
      setErrors((prev) => ({ ...prev, name: 'Table name is required' }));
      return false;
    }
    if (!isValidTableName(newName)) {
      setErrors((prev) => ({
        ...prev,
        name: 'Table name must be alphanumeric with underscores only',
      }));
      return false;
    }
    setErrors((prev => {
      const { name, ...rest } = prev;
      return rest;
    }));
    return true;
  };

  const handleNameChange = (newName: string) => {
    setName(newName);
    validateName(newName);
  };

  const handleNameBlur = async () => {
    if (!table || !validateName(name)) return;

    try {
      await updateTableRemote(workspaceId, tableId, { name });
    } catch (error) {
      setErrors((prev) => ({
        ...prev,
        name: error instanceof Error ? error.message : 'Failed to update name',
      }));
    }
  };

  const handleAliasChange = (newAlias: string) => {
    setAlias(newAlias);
    updateTable(tableId, { alias: newAlias });
  };

  const handleAddColumn = () => {
    const newColumn: Column = {
      id: `col-${Date.now()}`,
      table_id: tableId,
      name: '',
      data_type: 'VARCHAR',
      nullable: true,
      is_primary_key: false,
      is_foreign_key: false,
      order: columns.length,
      created_at: new Date().toISOString(),
    };
    setColumns([...columns, newColumn]);
  };

  const handleColumnChange = (columnId: string, updates: Partial<Column>) => {
    setColumns((cols) =>
      cols.map((col) => (col.id === columnId ? { ...col, ...updates } : col))
    );
  };

  const handleDeleteColumn = (columnId: string) => {
    setColumns((cols) => cols.filter((col) => col.id !== columnId));
  };

  if (!table) {
    return (
      <div className="p-4 text-gray-500">
        <p>Table not found</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div>
        <label htmlFor="table-name" className="block text-sm font-medium text-gray-700 mb-1">
          Table Name *
        </label>
        <input
          id="table-name"
          type="text"
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          onBlur={handleNameBlur}
          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.name ? 'border-red-500' : 'border-gray-300'
          }`}
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? 'name-error' : undefined}
        />
        {errors.name && (
          <p id="name-error" className="mt-1 text-sm text-red-600" role="alert">
            {errors.name}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="table-alias" className="block text-sm font-medium text-gray-700 mb-1">
          Alias (Optional)
        </label>
        <input
          id="table-alias"
          type="text"
          value={alias}
          onChange={(e) => handleAliasChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700">Columns</label>
          <button
            onClick={handleAddColumn}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Add Column
          </button>
        </div>
        <div className="space-y-2 max-h-[400px] overflow-y-auto table-columns-scrollable">
          {columns.length === 0 ? (
            <p className="text-sm text-gray-500 py-4 text-center">No columns. Add one to get started.</p>
          ) : (
            columns
              .sort((a, b) => a.order - b.order)
              .map((column) => (
                <ColumnEditor
                  key={column.id}
                  column={column}
                  onChange={(updates) => handleColumnChange(column.id, updates)}
                  onDelete={() => handleDeleteColumn(column.id)}
                />
              ))
          )}
        </div>
      </div>
    </div>
  );
};

