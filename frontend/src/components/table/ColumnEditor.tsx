/**
 * Column Editor Component
 * Allows editing individual column properties
 */

import React, { useState, useEffect } from 'react';
import type { Column, CompoundKey } from '@/types/table';
import { isValidColumnName } from '@/utils/validation';
import { Tooltip } from '@/components/common/Tooltip';

export interface ColumnEditorProps {
  column: Column;
  compoundKeys?: CompoundKey[];
  allColumns?: Column[]; // All columns in the table (for showing compound key member names)
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

export const ColumnEditor: React.FC<ColumnEditorProps> = ({
  column,
  compoundKeys = [],
  allColumns = [],
  onChange,
  onDelete,
}) => {
  const [name, setName] = useState(column.name);
  const [dataType, setDataType] = useState(column.data_type);

  const [_nullable, setNullable] = useState(column.nullable);

  const [_isPrimaryKey, setIsPrimaryKey] = useState(column.is_primary_key);

  const [_isForeignKey, setIsForeignKey] = useState(column.is_foreign_key);
  const [nameError, setNameError] = useState<string | null>(null);

  // Sync local state with column prop changes
  useEffect(() => {
    // Only update state if the column prop actually changed
    // This prevents unnecessary re-renders and state conflicts
    setName(column.name);
    setDataType(column.data_type);
    setNullable(column.nullable);
    setIsPrimaryKey(column.is_primary_key);
    setIsForeignKey(column.is_foreign_key);
  }, [
    column.id,
    column.name,
    column.data_type,
    column.nullable,
    column.is_primary_key,
    column.is_foreign_key,
  ]);

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
    console.log('[ColumnEditor] handlePrimaryKeyChange called:', {
      columnId: column.id,
      columnName: column.name,
      newIsPrimaryKey,
    });
    // Don't update local state here - let the parent handle it and sync via useEffect
    // This prevents race conditions when multiple columns are updated
    onChange({ is_primary_key: newIsPrimaryKey });
  };

  const handleForeignKeyChange = (newIsForeignKey: boolean) => {
    console.log('[ColumnEditor] handleForeignKeyChange called:', {
      columnId: column.id,
      columnName: column.name,
      newIsForeignKey,
    });
    // Don't update local state here - let the parent handle it and sync via useEffect
    // This prevents race conditions when multiple columns are updated
    onChange({ is_foreign_key: newIsForeignKey });
  };

  return (
    <div className="p-2 border border-gray-200 rounded-lg bg-white hover:border-gray-300 transition-colors">
      <div className="flex items-start gap-1.5">
        <div className="flex-1 space-y-1.5">
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
              <p
                id={`${column.id}-name-error`}
                className="mt-0.5 text-xs text-red-600"
                role="alert"
              >
                {nameError}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={dataType}
              onChange={(e) => handleDataTypeChange(e.target.value)}
              className="w-28 px-1.5 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Data type"
            >
              {DATA_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>

            <label className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={column.nullable} // Use prop value directly, not local state
                onChange={(e) => handleNullableChange(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                aria-label="Nullable"
              />
              <span className="text-gray-600">Null</span>
            </label>

            <label className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={column.is_primary_key} // Use prop value directly, not local state
                onChange={(e) => handlePrimaryKeyChange(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                aria-label="Primary key"
              />
              <span className="text-gray-600">PK</span>
            </label>

            <label className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={column.is_foreign_key} // Use prop value directly, not local state
                onChange={(e) => handleForeignKeyChange(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                aria-label="Foreign key"
              />
              <span className="text-gray-600">FK</span>
            </label>

            {/* Compound Key Tag Display */}
            {column.compound_key_tag &&
              (() => {
                const compoundKey = compoundKeys.find((ck) => ck.id === column.compound_key_id);
                if (!compoundKey) return null;

                // Get column names in the compound key
                const compoundKeyColumns = compoundKey.column_ids
                  .map((colId) => allColumns.find((c) => c.id === colId))
                  .filter(Boolean) as Column[];

                return (
                  <Tooltip
                    content={`Compound Key: ${column.compound_key_tag}. ${compoundKey.is_primary ? 'Primary Key. ' : ''}Columns in this compound key (${compoundKeyColumns.length}): ${compoundKeyColumns.map((col) => col.name).join(', ')}`}
                  >
                    <span className="inline-flex items-center gap-1 text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded cursor-help">
                      CK - {column.compound_key_tag}
                    </span>
                  </Tooltip>
                );
              })()}
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
