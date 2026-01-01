/**
 * Column Editor Component
 * Allows editing individual column properties
 */

import React, { useState, useEffect } from 'react';
import type { Column } from '@/types/table';
import { isValidColumnName } from '@/utils/validation';

export interface ColumnEditorProps {
  column: Column;
  onChange: (updates: Partial<Column>) => void;
  onDelete?: () => void;
}

const DATA_TYPES = [
  'VARCHAR',
  'INTEGER',
  'BIGINT',
  'DECIMAL',
  'BOOLEAN',
  'DATE',
  'TIMESTAMP',
  'UUID',
  'TEXT',
  'BLOB',
];

export const ColumnEditor: React.FC<ColumnEditorProps> = ({ column, onChange, onDelete }) => {
  const [name, setName] = useState(column.name);
  const [dataType, setDataType] = useState(column.data_type);
  const [nullable, setNullable] = useState(column.nullable);
  const [isPrimaryKey, setIsPrimaryKey] = useState(column.is_primary_key);
  const [isForeignKey, setIsForeignKey] = useState(column.is_foreign_key);
  const [nameError, setNameError] = useState<string | null>(null);

  useEffect(() => {
    setName(column.name);
    setDataType(column.data_type);
    setNullable(column.nullable);
    setIsPrimaryKey(column.is_primary_key);
    setIsForeignKey(column.is_foreign_key);
  }, [column]);

  const handleNameChange = (newName: string) => {
    setName(newName);
    if (newName && !isValidColumnName(newName)) {
      setNameError('Column name must be alphanumeric with underscores only');
    } else {
      setNameError(null);
      onChange({ name: newName });
    }
  };

  const handleDataTypeChange = (newDataType: string) => {
    setDataType(newDataType);
    onChange({ data_type: newDataType });
  };

  const handleNullableChange = (newNullable: boolean) => {
    setNullable(newNullable);
    onChange({ nullable: newNullable });
  };

  const handlePrimaryKeyChange = (newIsPrimaryKey: boolean) => {
    setIsPrimaryKey(newIsPrimaryKey);
    onChange({ is_primary_key: newIsPrimaryKey });
  };

  const handleForeignKeyChange = (newIsForeignKey: boolean) => {
    setIsForeignKey(newIsForeignKey);
    onChange({ is_foreign_key: newIsForeignKey });
  };

  return (
    <div className="p-3 border border-gray-200 rounded-lg bg-white hover:border-gray-300 transition-colors">
      <div className="flex items-start gap-2">
        <div className="flex-1 space-y-2">
          <div>
            <input
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Column name"
              className={`w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                nameError ? 'border-red-500' : 'border-gray-300'
              }`}
              aria-invalid={!!nameError}
              aria-describedby={nameError ? `${column.id}-name-error` : undefined}
            />
            {nameError && (
              <p id={`${column.id}-name-error`} className="mt-1 text-xs text-red-600" role="alert">
                {nameError}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <select
              value={dataType}
              onChange={(e) => handleDataTypeChange(e.target.value)}
              className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Data type"
            >
              {DATA_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>

            <label className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                checked={nullable}
                onChange={(e) => handleNullableChange(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                aria-label="Nullable"
              />
              <span className="text-gray-600">Nullable</span>
            </label>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                checked={isPrimaryKey}
                onChange={(e) => handlePrimaryKeyChange(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                aria-label="Primary key"
              />
              <span className="text-gray-600">Primary Key</span>
            </label>

            <label className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                checked={isForeignKey}
                onChange={(e) => handleForeignKeyChange(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                aria-label="Foreign key"
              />
              <span className="text-gray-600">Foreign Key</span>
            </label>
          </div>
        </div>

        {onDelete && (
          <button
            onClick={onDelete}
            className="px-2 py-1 text-sm text-red-600 hover:text-red-800 focus:outline-none focus:ring-2 focus:ring-red-500 rounded"
            aria-label="Delete column"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
};

