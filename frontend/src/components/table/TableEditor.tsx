/**
 * Table Editor Component
 * Allows editing table properties and columns
 */

import React, { useState, useEffect } from 'react';
import { useModelStore } from '@/stores/modelStore';
import { useUIStore } from '@/stores/uiStore';
import { useSDKModeStore } from '@/services/sdk/sdkMode';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { ColumnEditor } from './ColumnEditor';
import { ColumnDetailsModal } from './ColumnDetailsModal';
import { TableMetadataModal } from './TableMetadataModal';
import { CompoundKeyEditor } from './CompoundKeyEditor';
import { isValidTableName, normalizeUUID, isValidUUID } from '@/utils/validation';
import { odcsService } from '@/services/sdk/odcsService';
import { browserFileService } from '@/services/platform/browser';
import { importExportService } from '@/services/sdk/importExportService';
import type { Column, Table, CompoundKey, TableIndex } from '@/types/table';
import type { DataLevel } from '@/stores/modelStore';

export interface TableEditorProps {
  tableId: string;
  workspaceId: string;
  onClose?: () => void;
}

export const TableEditor: React.FC<TableEditorProps> = ({ tableId, workspaceId, onClose }) => {
  const {
    tables,
    updateTable,
    updateTableRemote,
    updateColumnRemote,
    deleteTableRemote,
    selectedDomainId,
    removeTable,
  } = useModelStore();
  const { addToast } = useUIStore();
  const { mode } = useSDKModeStore();
  const table = tables.find((t) => t.id === tableId);

  const [name, setName] = useState(table?.name || '');
  const [alias, setAlias] = useState(table?.alias || '');
  const [description, setDescription] = useState(table?.description || '');
  const [dataLevel, setDataLevel] = useState<DataLevel>(table?.data_level || 'operational');
  const [columns, setColumns] = useState<Column[]>(table?.columns || []);
  const [compoundKeys, setCompoundKeys] = useState<CompoundKey[]>(table?.compoundKeys || []);
  const [indexes, setIndexes] = useState<TableIndex[]>(() => {
    // Load indexes from metadata
    if (
      table?.metadata &&
      typeof table.metadata.indexes === 'object' &&
      Array.isArray(table.metadata.indexes)
    ) {
      return table.metadata.indexes as TableIndex[];
    }
    return [];
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showTableMetadata, setShowTableMetadata] = useState(false);
  const [selectedColumnId, setSelectedColumnId] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exportFormat, setExportFormat] = useState<
    'odcs' | 'avro' | 'protobuf' | 'json-schema' | 'sql'
  >('odcs');
  const [sqlDialect, setSqlDialect] = useState<
    'postgresql' | 'mysql' | 'sqlite' | 'mssql' | 'databricks'
  >('postgresql');
  const [showSqlDialectSelector, setShowSqlDialectSelector] = useState(false);
  const [showIndexes, setShowIndexes] = useState(false);

  // Check if table is editable (must be primary domain)
  // Normalize both IDs for comparison in case one is invalid
  // This handles cases where domains were created with invalid UUIDs (e.g., "domain-123456")
  const normalizedTableDomainId = table?.primary_domain_id
    ? isValidUUID(table.primary_domain_id)
      ? table.primary_domain_id
      : normalizeUUID(table.primary_domain_id)
    : null;
  const normalizedSelectedDomainId = selectedDomainId
    ? isValidUUID(selectedDomainId)
      ? selectedDomainId
      : normalizeUUID(selectedDomainId)
    : null;
  const isEditable =
    normalizedTableDomainId !== null &&
    normalizedSelectedDomainId !== null &&
    normalizedTableDomainId === normalizedSelectedDomainId;

  // Debug logging
  if (table && !isEditable) {
    console.log('[TableEditor] Table is read-only:', {
      tableId: table.id,
      tableName: table.name,
      tablePrimaryDomainId: table.primary_domain_id,
      normalizedTableDomainId,
      selectedDomainId,
      normalizedSelectedDomainId,
      match: normalizedTableDomainId === normalizedSelectedDomainId,
      bothNotNull: normalizedTableDomainId !== null && normalizedSelectedDomainId !== null,
    });
  }

  // Track the last table ID we initialized with
  const [initializedTableId, setInitializedTableId] = useState<string | null>(null);

  useEffect(() => {
    if (table && table.id === tableId) {
      // Always sync state from store when table data changes (including after save)
      setName(table.name);
      setAlias(table.alias || '');
      setDescription(table.description || '');
      setDataLevel(table.data_level || 'operational');

      // Ensure all columns have unique IDs - fix any duplicates
      const columnsWithUniqueIds = table.columns.map((col, index) => {
        // Check if this ID is duplicated
        const duplicateCount = table.columns.filter((c) => c.id === col.id).length;
        if (duplicateCount > 1 || !col.id) {
          // Generate a new unique ID
          const newId = `col-${tableId}-${col.name || 'col'}-${index}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          console.warn('[TableEditor] Found duplicate or missing column ID, generating new one:', {
            oldId: col.id,
            newId,
            columnName: col.name,
          });
          return { ...col, id: newId };
        }
        return col;
      });

      setColumns(columnsWithUniqueIds);
      setCompoundKeys(table.compoundKeys || []);
      // Load indexes from metadata
      if (
        table.metadata &&
        typeof table.metadata.indexes === 'object' &&
        Array.isArray(table.metadata.indexes)
      ) {
        setIndexes(table.metadata.indexes as TableIndex[]);
      } else {
        setIndexes([]);
      }
      // Only reset unsaved changes flag when switching to a different table
      if (initializedTableId !== tableId) {
        setHasUnsavedChanges(false);
        setInitializedTableId(tableId);
      }
    }
  }, [table, tableId, initializedTableId]);

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
    setErrors((prev) => {
      const { name: _name, ...rest } = prev;
      return rest;
    });
    return true;
  };

  const handleNameChange = (newName: string) => {
    setName(newName);
    validateName(newName);
    setHasUnsavedChanges(true);
  };

  const handleNameBlur = async () => {
    if (!table || !validateName(name)) return;

    // Update local state immediately (for canvas preview)
    updateTable(tableId, { name });

    // Only update remote if in online mode (but don't wait for it - save button will handle final save)
    // In offline mode, changes are saved locally via Save button
  };

  const handleAliasChange = (newAlias: string) => {
    setAlias(newAlias);
    updateTable(tableId, { alias: newAlias });
    setHasUnsavedChanges(true);
  };

  const handleAddColumn = async () => {
    // Always generate proper UUID for column ID
    const { generateUUID } = await import('@/utils/validation');
    const newColumn: Column = {
      id: generateUUID(),
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
    setHasUnsavedChanges(true);
  };

  const handleColumnChange = (columnId: string, updates: Partial<Column>) => {
    console.log('[TableEditor] handleColumnChange called:', {
      columnId,
      updates,
      allColumnIds: columns.map((c) => c.id),
    });

    setColumns((cols) => {
      // Verify columnId exists in the array
      const targetColumn = cols.find((c) => c.id === columnId);
      if (!targetColumn) {
        console.warn('[TableEditor] Column ID not found:', columnId);
        return cols; // Return unchanged if column not found
      }

      // If setting primary key to true, clear primary key from all other columns
      if (updates.is_primary_key === true) {
        console.log('[TableEditor] Setting PK to true for column:', columnId);
        return cols.map((col) => {
          if (col.id === columnId) {
            // Update the target column with the new value
            return { ...col, ...updates, is_primary_key: true };
          } else {
            // Clear primary key from all other columns only if they currently have it set
            if (col.is_primary_key) {
              return { ...col, is_primary_key: false };
            }
            return col; // Don't modify columns that don't have PK set
          }
        });
      } else if (updates.is_primary_key === false) {
        // When unchecking PK, only update the specific column
        console.log('[TableEditor] Setting PK to false for column:', columnId);
        return cols.map((col) => {
          if (col.id === columnId) {
            return { ...col, ...updates, is_primary_key: false };
          }
          return col; // Don't modify other columns
        });
      }

      // For other updates (nullable, foreign key, etc.), just update the specific column
      // Ensure we only update the exact column and don't accidentally modify others
      if ('is_foreign_key' in updates) {
        console.log('[TableEditor] Setting FK for column:', columnId, 'to', updates.is_foreign_key);
      }
      if ('nullable' in updates) {
        console.log('[TableEditor] Setting nullable for column:', columnId, 'to', updates.nullable);
      }

      return cols.map((col) => {
        if (col.id === columnId) {
          // Only apply the specific updates, don't spread everything
          const updatedCol = { ...col };
          if ('nullable' in updates) updatedCol.nullable = updates.nullable ?? false;
          if ('is_foreign_key' in updates)
            updatedCol.is_foreign_key = updates.is_foreign_key ?? false;
          if ('name' in updates) updatedCol.name = updates.name ?? '';
          if ('data_type' in updates) updatedCol.data_type = updates.data_type ?? 'VARCHAR';
          if ('description' in updates) updatedCol.description = updates.description;
          if ('order' in updates) updatedCol.order = updates.order ?? col.order;
          // Explicitly ensure is_primary_key is NOT changed unless it's in updates
          if ('is_primary_key' in updates) {
            updatedCol.is_primary_key = updates.is_primary_key ?? false;
          }
          return updatedCol;
        }
        return col; // Return unchanged column - CRITICAL: don't modify other columns
      });
    });
    setHasUnsavedChanges(true);
  };

  const handleDeleteColumn = (columnId: string) => {
    setColumns((cols) => cols.filter((col) => col.id !== columnId));
    setHasUnsavedChanges(true);
  };

  const handleDataLevelChange = async (newLevel: DataLevel) => {
    setDataLevel(newLevel);
    updateTable(tableId, { data_level: newLevel });
    setHasUnsavedChanges(true);
  };

  const handleColumnDetailsSave = async (columnId: string, updates: Partial<Column>) => {
    handleColumnChange(columnId, updates);

    if (mode === 'online') {
      await updateColumnRemote(workspaceId, tableId, columnId, updates);
    }
  };

  const handleSaveTable = async () => {
    if (!table || !selectedDomainId) return;

    setIsSaving(true);
    try {
      // Validate name
      if (!validateName(name)) {
        setIsSaving(false);
        return;
      }

      // Update compound key tags on columns
      const updatedColumns = columns.map((col, index) => {
        const compoundKey = compoundKeys.find((ck) => ck.column_ids.includes(col.id));
        if (compoundKey) {
          return {
            ...col,
            order: index,
            compound_key_id: compoundKey.id,
            compound_key_order: compoundKey.column_ids.indexOf(col.id),
            compound_key_tag: compoundKey.name || `CK_${compoundKey.id.slice(0, 8)}`,
            // If compound key is primary, ensure column is not marked as single-column PK
            is_primary_key: compoundKey.is_primary ? false : col.is_primary_key,
          };
        } else {
          // Remove compound key references if column is no longer in any compound key
          const {
            compound_key_id: _compound_key_id,
            compound_key_order: _compound_key_order,
            compound_key_tag: _compound_key_tag,
            ...rest
          } = col;
          return { ...rest, order: index };
        }
      });

      // Store indexes in metadata
      const metadata: Record<string, unknown> = {
        ...(table.metadata || {}),
      };
      if (indexes.length > 0) {
        metadata.indexes = indexes;
      } else {
        // Remove indexes from metadata if empty
        delete metadata.indexes;
      }

      // Prepare all updates - always include compoundKeys and metadata
      const updates: Partial<Table> = {
        name,
        alias: alias || undefined,
        description: description || undefined,
        data_level: dataLevel,
        columns: updatedColumns,
        compoundKeys: compoundKeys, // Always include, even if empty array
        metadata: metadata, // Always include metadata object
        last_modified_at: new Date().toISOString(),
      };

      console.log('[TableEditor] Saving table with updates:', {
        compoundKeysCount: compoundKeys.length,
        compoundKeys: compoundKeys,
        indexesCount: indexes.length,
        indexes: metadata.indexes,
        metadataKeys: Object.keys(metadata),
      });

      // Update local state - this will trigger canvas re-render
      updateTable(tableId, updates);

      // Also mark workspace as having pending changes
      useWorkspaceStore.getState().setPendingChanges(true);

      // Update remote if in online mode
      if (mode === 'online') {
        try {
          await updateTableRemote(selectedDomainId, tableId, updates);
          addToast({
            type: 'success',
            message: `Table "${name}" saved successfully`,
          });
        } catch (error) {
          addToast({
            type: 'error',
            message: error instanceof Error ? error.message : 'Failed to save table',
          });
          setIsSaving(false);
          return;
        }
      } else {
        // In offline mode, just update local state
        addToast({
          type: 'success',
          message: `Table "${name}" saved locally`,
        });
      }

      setHasUnsavedChanges(false);

      // Force a small delay to ensure store update propagates before closing
      // The canvas will automatically update via useEffect dependencies
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Force canvas to refresh by triggering a store update notification
      // This ensures views redraw after dialogs close
      updateTable(tableId, { last_modified_at: new Date().toISOString() });
    } catch (error) {
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to save table',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTable = async () => {
    if (!table || !selectedDomainId) return;

    if (
      !window.confirm(
        `Are you sure you want to delete table "${table.name}"? This action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      if (mode === 'online') {
        await deleteTableRemote(selectedDomainId, tableId);
      }
      removeTable(tableId);
      addToast({
        type: 'success',
        message: `Table "${table.name}" deleted successfully`,
      });
      if (onClose) {
        onClose();
      }
    } catch (error) {
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to delete table',
      });
    }
  };

  const handleAddCompoundKey = (compoundKey: CompoundKey) => {
    // If this is a primary compound key, check if there's already a single-column PK
    if (compoundKey.is_primary) {
      const hasSingleColumnPK = columns.some((col) => col.is_primary_key);
      if (hasSingleColumnPK) {
        addToast({
          type: 'warning',
          message:
            'Cannot create compound primary key when a single-column primary key exists. Remove the single-column primary key first.',
        });
        return;
      }
      // Also check if there's already a compound primary key
      const hasCompoundPK = compoundKeys.some((ck) => ck.is_primary);
      if (hasCompoundPK) {
        addToast({
          type: 'warning',
          message:
            'Only one primary key is allowed. Remove the existing compound primary key first.',
        });
        return;
      }
    }
    setCompoundKeys([...compoundKeys, compoundKey]);
    setHasUnsavedChanges(true);
  };

  const handleUpdateCompoundKey = (compoundKeyId: string, updates: Partial<CompoundKey>) => {
    // If updating to primary, check for conflicts
    if (updates.is_primary === true) {
      const hasSingleColumnPK = columns.some((col) => col.is_primary_key);
      if (hasSingleColumnPK) {
        addToast({
          type: 'warning',
          message:
            'Cannot set compound key as primary when a single-column primary key exists. Remove the single-column primary key first.',
        });
        return;
      }
      // Check if another compound key is already primary
      const otherCompoundPK = compoundKeys.find((ck) => ck.id !== compoundKeyId && ck.is_primary);
      if (otherCompoundPK) {
        addToast({
          type: 'warning',
          message:
            'Only one primary key is allowed. Remove the existing compound primary key first.',
        });
        return;
      }
    }
    setCompoundKeys(
      compoundKeys.map((ck) => (ck.id === compoundKeyId ? { ...ck, ...updates } : ck))
    );
    setHasUnsavedChanges(true);
  };

  const handleDeleteCompoundKey = (compoundKeyId: string) => {
    setCompoundKeys(compoundKeys.filter((ck) => ck.id !== compoundKeyId));
    setHasUnsavedChanges(true);
  };

  const handleAddIndex = () => {
    const newIndex: TableIndex = {
      id: `index-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: `idx_${name}_${indexes.length + 1}`,
      column_ids: [],
      is_unique: false,
    };
    setIndexes([...indexes, newIndex]);
    setHasUnsavedChanges(true);
  };

  const handleUpdateIndex = (indexId: string, updates: Partial<TableIndex>) => {
    setIndexes(indexes.map((idx) => (idx.id === indexId ? { ...idx, ...updates } : idx)));
    setHasUnsavedChanges(true);
  };

  const handleDeleteIndex = (indexId: string) => {
    setIndexes(indexes.filter((idx) => idx.id !== indexId));
    setHasUnsavedChanges(true);
  };

  const handleExportTable = async (format: typeof exportFormat, forceExport: boolean = false) => {
    if (!table) return;

    // For SQL format, first show dialect selector unless forcing export
    if (format === 'sql' && !forceExport && !showSqlDialectSelector) {
      setExportFormat('sql');
      setShowSqlDialectSelector(true);
      return;
    }

    setIsExporting(true);
    setShowExportMenu(false);
    setShowSqlDialectSelector(false);
    setExportFormat(format); // Remember the selected format

    try {
      // Create a workspace object with just this table
      const workspace = { tables: [table] } as any;

      let content: string;
      let filename: string;
      let mimeType: string;

      switch (format) {
        case 'odcs':
          content = await odcsService.toYAML(workspace);
          filename = `${table.name}.odcs.yaml`;
          mimeType = 'text/yaml';
          break;
        case 'avro':
          content = await importExportService.exportToAVRO(workspace);
          filename = `${table.name}.avsc`;
          mimeType = 'application/json';
          break;
        case 'protobuf':
          content = await importExportService.exportToProtobuf(workspace);
          filename = `${table.name}.proto`;
          mimeType = 'text/plain';
          break;
        case 'json-schema':
          content = await importExportService.exportToJSONSchema(workspace);
          filename = `${table.name}.schema.json`;
          mimeType = 'application/json';
          break;
        case 'sql':
          content = await importExportService.exportToSQL(workspace, sqlDialect);
          filename = `${table.name}.${sqlDialect}.sql`;
          mimeType = 'text/sql';
          break;
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }

      browserFileService.downloadFile(content, filename, mimeType);

      addToast({
        type: 'success',
        message: `Table "${table.name}" exported as ${format.toUpperCase()} successfully`,
      });
    } catch (error) {
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to export table',
      });
    } finally {
      setIsExporting(false);
    }
  };

  if (!table) {
    return (
      <div className="p-4 text-gray-500">
        <p>Table not found</p>
      </div>
    );
  }

  if (!isEditable) {
    return (
      <div className="p-4 space-y-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-yellow-800 mb-2">Read-Only Table</h3>
          <p className="text-sm text-yellow-700">
            This table belongs to another domain and cannot be edited here. Switch to the primary
            domain to edit.
          </p>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">{table.name}</h2>
          {table.description && <p className="text-sm text-gray-600 mb-2">{table.description}</p>}
          {table.owner && (
            <p className="text-xs text-gray-500">Owner: {table.owner.name || table.owner.email}</p>
          )}
        </div>
      </div>
    );
  }

  const selectedColumn = selectedColumnId ? columns.find((c) => c.id === selectedColumnId) : null;

  return (
    <>
      <div className="p-4 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-gray-900">Edit Table</h2>
          <div className="flex gap-2">
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                disabled={isExporting}
                className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                aria-label="Export table"
                title="Export table"
              >
                {isExporting ? 'Exporting...' : 'Export'}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {/* Export Format Menu */}
              {showExportMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} />
                  <div className="absolute right-0 mt-1 w-56 bg-white rounded-md shadow-lg border border-gray-200 z-20">
                    <div className="py-1">
                      <button
                        onClick={() => handleExportTable('odcs')}
                        disabled={isExporting}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between"
                      >
                        <span>ODCS (Default)</span>
                        {exportFormat === 'odcs' && <span className="text-green-600">✓</span>}
                      </button>
                      <button
                        onClick={() => handleExportTable('avro')}
                        disabled={isExporting}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between"
                      >
                        <span>AVRO Schema</span>
                        {exportFormat === 'avro' && <span className="text-green-600">✓</span>}
                      </button>
                      <button
                        onClick={() => handleExportTable('protobuf')}
                        disabled={isExporting}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between"
                      >
                        <span>Protobuf Schema</span>
                        {exportFormat === 'protobuf' && <span className="text-green-600">✓</span>}
                      </button>
                      <button
                        onClick={() => handleExportTable('json-schema')}
                        disabled={isExporting}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between"
                      >
                        <span>JSON Schema</span>
                        {exportFormat === 'json-schema' && (
                          <span className="text-green-600">✓</span>
                        )}
                      </button>
                      <div className="border-t border-gray-200">
                        <button
                          onClick={() => handleExportTable('sql')}
                          disabled={isExporting}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between"
                        >
                          <span>CreateTable SQL</span>
                          {exportFormat === 'sql' && <span className="text-green-600">✓</span>}
                        </button>
                        {showSqlDialectSelector && exportFormat === 'sql' && (
                          <div className="px-4 pb-2 pt-1 border-t border-gray-100">
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              SQL Dialect:
                            </label>
                            <select
                              value={sqlDialect}
                              onChange={(e) => setSqlDialect(e.target.value as typeof sqlDialect)}
                              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <option value="postgresql">PostgreSQL</option>
                              <option value="mysql">MySQL</option>
                              <option value="sqlite">SQLite</option>
                              <option value="mssql">SQL Server</option>
                              <option value="databricks">Databricks</option>
                            </select>
                            <button
                              onClick={() => handleExportTable('sql', true)}
                              disabled={isExporting}
                              className="mt-2 w-full px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Export SQL
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
            <button
              onClick={handleSaveTable}
              disabled={isSaving || !hasUnsavedChanges}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
              aria-label="Save table"
            >
              {isSaving ? 'Saving...' : 'Save Table'}
            </button>
            <button
              onClick={handleDeleteTable}
              className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
              aria-label="Delete table"
            >
              Delete Table
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
                aria-label="Close"
              >
                Close
              </button>
            )}
          </div>
        </div>

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
          <label
            htmlFor="table-description"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Description
          </label>
          <textarea
            id="table-description"
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              updateTable(tableId, { description: e.target.value });
              setHasUnsavedChanges(true);
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3}
          />
        </div>

        <div>
          <label
            htmlFor="table-data-level"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Data Level
          </label>
          <select
            id="table-data-level"
            value={dataLevel}
            onChange={(e) => handleDataLevelChange(e.target.value as DataLevel)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="operational">Operational</option>
            <option value="bronze">Bronze</option>
            <option value="silver">Silver</option>
            <option value="gold">Gold</option>
          </select>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setShowTableMetadata(true)}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Edit Table Metadata
          </button>
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
              <p className="text-sm text-gray-500 py-4 text-center">
                No columns. Add one to get started.
              </p>
            ) : (
              columns
                .sort((a, b) => a.order - b.order)
                .map((column) => (
                  <div key={column.id} className="flex items-center gap-2">
                    <div className="flex-1">
                      <ColumnEditor
                        column={column}
                        compoundKeys={compoundKeys}
                        allColumns={columns}
                        onChange={(updates) => handleColumnChange(column.id, updates)}
                        onDelete={() => handleDeleteColumn(column.id)}
                      />
                    </div>
                    <button
                      onClick={() => setSelectedColumnId(column.id)}
                      className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                      title="Edit column details"
                    >
                      Details
                    </button>
                  </div>
                ))
            )}
          </div>
        </div>

        {/* Compound Keys Section */}
        <div className="border-t border-gray-200 pt-4">
          <CompoundKeyEditor
            tableId={tableId}
            columns={columns}
            compoundKeys={compoundKeys}
            onAdd={handleAddCompoundKey}
            onUpdate={handleUpdateCompoundKey}
            onDelete={handleDeleteCompoundKey}
          />
        </div>

        {/* Indexes Section */}
        <div className="border-t border-gray-200 pt-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-700">Indexes</h3>
            <button
              onClick={() => setShowIndexes(!showIndexes)}
              className="px-2 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              {showIndexes ? 'Hide' : 'Show'} Indexes
            </button>
          </div>
          {showIndexes && (
            <div className="space-y-3">
              {indexes.map((index) => (
                <div key={index.id} className="p-3 border border-gray-200 rounded bg-white">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={index.name}
                        onChange={(e) => handleUpdateIndex(index.id, { name: e.target.value })}
                        className="px-2 py-1 text-sm border border-gray-300 rounded"
                        placeholder="Index name"
                      />
                      <label className="flex items-center gap-1 text-xs">
                        <input
                          type="checkbox"
                          checked={index.is_unique}
                          onChange={(e) =>
                            handleUpdateIndex(index.id, { is_unique: e.target.checked })
                          }
                          className="rounded"
                        />
                        <span>Unique</span>
                      </label>
                    </div>
                    <button
                      onClick={() => handleDeleteIndex(index.id)}
                      className="text-xs text-red-600 hover:text-red-800"
                    >
                      Delete
                    </button>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Columns</label>
                    <div className="space-y-1 max-h-32 overflow-y-auto border border-gray-200 rounded p-2 bg-gray-50">
                      {columns.map((column) => (
                        <label
                          key={column.id}
                          className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-100 p-1 rounded"
                        >
                          <input
                            type="checkbox"
                            checked={index.column_ids.includes(column.id)}
                            onChange={(e) => {
                              const newColumnIds = e.target.checked
                                ? [...index.column_ids, column.id]
                                : index.column_ids.filter((id) => id !== column.id);
                              handleUpdateIndex(index.id, { column_ids: newColumnIds });
                            }}
                            className="rounded"
                          />
                          <span>{column.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
              <button
                onClick={handleAddIndex}
                className="w-full px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Add Index
              </button>
              {indexes.length === 0 && (
                <p className="text-xs text-gray-500 italic">No indexes defined</p>
              )}
            </div>
          )}
        </div>

        {/* Table Metadata Modal */}
        {table && (
          <TableMetadataModal
            table={table}
            isOpen={showTableMetadata}
            onClose={() => setShowTableMetadata(false)}
          />
        )}

        {/* Column Details Modal */}
        {selectedColumn && (
          <ColumnDetailsModal
            column={selectedColumn}
            tableId={tableId}
            workspaceId={workspaceId}
            isOpen={!!selectedColumnId}
            onClose={() => setSelectedColumnId(null)}
            onSave={handleColumnDetailsSave}
          />
        )}
      </div>
    </>
  );
};
