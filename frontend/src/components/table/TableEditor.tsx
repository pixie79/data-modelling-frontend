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
import { isValidTableName } from '@/utils/validation';
import { odcsService } from '@/services/sdk/odcsService';
import { browserFileService } from '@/services/platform/browser';
import { importExportService } from '@/services/sdk/importExportService';
import { sdkLoader } from '@/services/sdk/sdkLoader';
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
    systems,
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
    'odcs' | 'avro' | 'protobuf' | 'json-schema' | 'sql' | 'markdown' | 'pdf'
  >('odcs');
  const [sqlDialect, setSqlDialect] = useState<
    'postgresql' | 'mysql' | 'sqlite' | 'mssql' | 'databricks'
  >('postgresql');
  const [showSqlDialectSelector, setShowSqlDialectSelector] = useState(false);
  const [showIndexes, setShowIndexes] = useState(false);
  const [expandedColumns, setExpandedColumns] = useState<Set<string>>(new Set());

  // Check if table is editable (must be primary domain)
  // Compare domain IDs directly - they should match exactly as strings
  // Note: normalizeUUID generates random UUIDs for non-UUID strings, so we can't use it for comparison
  const tableDomainId = table?.primary_domain_id || null;
  const isEditable =
    tableDomainId !== null && selectedDomainId !== null && tableDomainId === selectedDomainId;

  // Debug logging
  if (table && !isEditable) {
    console.log('[TableEditor] Table is read-only:', {
      tableId: table.id,
      tableName: table.name,
      tableDomainId,
      selectedDomainId,
      match: tableDomainId === selectedDomainId,
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

      // Columns now have IDs assigned during import by processNestedColumns
      // No need to regenerate IDs here - they should already be unique
      setColumns(table.columns || []);
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

    // Update both the data_level field and the dm_level tag
    const currentTags = table?.tags || [];

    // Remove existing dm_level tag if present (tags are strings like "dm_level:Gold")
    const filteredTags = currentTags.filter((tag) => !tag.toLowerCase().startsWith('dm_level:'));

    // Add new dm_level tag (capitalize first letter for display)
    const levelDisplay = newLevel.charAt(0).toUpperCase() + newLevel.slice(1);
    const newTags = [...filteredTags, `dm_level:${levelDisplay}`];

    updateTable(tableId, { data_level: newLevel, tags: newTags });
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

      // Get system name prefix if table belongs to a system
      let systemPrefix = '';
      if (table.metadata && table.metadata.system_id) {
        const system = systems.find((s) => s.id === table.metadata!.system_id);
        if (system) {
          systemPrefix = `${system.name}_`;
        }
      }

      let content: string;
      let filename: string;
      let mimeType: string;

      switch (format) {
        case 'odcs':
          content = await odcsService.toYAML(workspace);
          filename = `${systemPrefix}${table.name}.odcs.yaml`;
          mimeType = 'text/yaml';
          break;
        case 'avro':
          content = await importExportService.exportToAVRO(workspace);
          filename = `${systemPrefix}${table.name}.avsc`;
          mimeType = 'application/json';
          break;
        case 'protobuf':
          content = await importExportService.exportToProtobuf(workspace);
          filename = `${systemPrefix}${table.name}.proto`;
          mimeType = 'text/plain';
          break;
        case 'json-schema':
          content = await importExportService.exportToJSONSchema(workspace);
          filename = `${systemPrefix}${table.name}.schema.json`;
          mimeType = 'application/json';
          break;
        case 'sql':
          content = await importExportService.exportToSQL(workspace, sqlDialect);
          filename = `${systemPrefix}${table.name}.${sqlDialect}.sql`;
          mimeType = 'text/sql';
          break;
        case 'markdown':
          content = await odcsService.exportTableToMarkdown(table);
          filename = `${systemPrefix}${table.name}.md`;
          mimeType = 'text/markdown';
          break;
        case 'pdf': {
          const pdfResult = await odcsService.exportTableToPDF(table);
          // Decode base64 PDF and download
          const pdfBytes = Uint8Array.from(atob(pdfResult.pdf_base64), (c) => c.charCodeAt(0));
          const blob = new Blob([pdfBytes], { type: 'application/pdf' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${systemPrefix}${table.name}.pdf`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          addToast({
            type: 'success',
            message: `Table "${table.name}" exported as PDF successfully`,
          });
          setIsExporting(false);
          return; // Early return since we handled the download differently
        }
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

  // Helper function to toggle column expansion
  const toggleColumnExpansion = (columnId: string) => {
    setExpandedColumns((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(columnId)) {
        newSet.delete(columnId);
      } else {
        newSet.add(columnId);
      }
      return newSet;
    });
  };

  // Helper function to render column hierarchy with nested columns
  const renderColumnHierarchy = (allColumns: Column[], parentId?: string, depth: number = 0) => {
    // Filter columns for current level (root or children of parentId)
    const columnsAtLevel = allColumns
      .filter((col) => {
        if (parentId === undefined) {
          // Root level - columns without parent_column_id
          return !col.parent_column_id;
        } else {
          // Child level - columns with matching parent_column_id
          return col.parent_column_id === parentId;
        }
      })
      .sort((a, b) => a.order - b.order);

    return columnsAtLevel.map((column) => {
      // Check if this column has children
      const hasChildren = allColumns.some((c) => c.parent_column_id === column.id);
      const isExpanded = expandedColumns.has(column.id);
      const indentClass = depth > 0 ? `ml-${depth * 4}` : '';

      return (
        <div key={column.id} className="space-y-1">
          <div
            className={`flex items-center gap-2 ${indentClass}`}
            style={{ marginLeft: `${depth * 1.5}rem` }}
          >
            {/* Expand/collapse button for columns with children */}
            {hasChildren && (
              <button
                onClick={() => toggleColumnExpansion(column.id)}
                className="w-5 h-5 flex items-center justify-center text-gray-600 hover:bg-gray-100 rounded"
                title={isExpanded ? 'Collapse' : 'Expand'}
              >
                {isExpanded ? '▼' : '▶'}
              </button>
            )}
            {/* Spacer for columns without children to align with parent columns */}
            {!hasChildren && depth > 0 && <div className="w-5" />}

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

          {/* Render children if expanded */}
          {hasChildren && isExpanded && (
            <div className="space-y-1">
              {renderColumnHierarchy(allColumns, column.id, depth + 1)}
            </div>
          )}
        </div>
      );
    });
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
      <div className="p-4 space-y-4 max-h-[90vh] overflow-y-auto">
        {/* Read-Only Banner */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
          <div className="flex items-center gap-2">
            <svg
              className="w-5 h-5 text-yellow-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            <div>
              <h3 className="text-sm font-semibold text-yellow-800">Read-Only View</h3>
              <p className="text-xs text-yellow-700">
                This table belongs to another domain. Switch to the primary domain to edit.
              </p>
            </div>
          </div>
        </div>

        {/* Table Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">{table.name}</h2>
          <button
            onClick={onClose}
            className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            Close
          </button>
        </div>

        {/* Basic Information */}
        <div className="space-y-3">
          <div>
            <label
              htmlFor="table-view-name"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Name
            </label>
            <input
              id="table-view-name"
              type="text"
              value={table.name}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-700"
            />
          </div>

          {table.alias && (
            <div>
              <label
                htmlFor="table-view-alias"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Alias
              </label>
              <input
                id="table-view-alias"
                type="text"
                value={table.alias}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-700"
              />
            </div>
          )}

          {table.description && (
            <div>
              <label
                htmlFor="table-view-description"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Description
              </label>
              <textarea
                id="table-view-description"
                value={table.description}
                disabled
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-700"
              />
            </div>
          )}

          {table.data_level && (
            <div>
              <label
                htmlFor="table-view-data-level"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Data Level
              </label>
              <input
                id="table-view-data-level"
                type="text"
                value={table.data_level}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-700 capitalize"
              />
            </div>
          )}

          {table.owner && (
            <div>
              <label
                htmlFor="table-view-owner"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Owner
              </label>
              <input
                id="table-view-owner"
                type="text"
                value={table.owner.name || table.owner.email || 'Unknown'}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-700"
              />
            </div>
          )}
        </div>

        {/* Columns */}
        <div>
          <h3 className="text-md font-semibold text-gray-900 mb-3">
            Columns ({table.columns.length})
          </h3>
          <div className="border border-gray-300 rounded-md overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Name
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Type
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Nullable
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Keys
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Description
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {table.columns.map((column) => (
                  <tr key={column.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-sm font-medium text-gray-900">{column.name}</td>
                    <td className="px-3 py-2 text-sm text-gray-700">{column.data_type}</td>
                    <td className="px-3 py-2 text-sm text-gray-700">
                      {column.nullable ? (
                        <span className="text-green-600">✓</span>
                      ) : (
                        <span className="text-red-600">✗</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-sm">
                      {column.is_primary_key && (
                        <span className="inline-block px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded mr-1">
                          PK
                        </span>
                      )}
                      {column.is_foreign_key && (
                        <span className="inline-block px-2 py-0.5 text-xs bg-purple-100 text-purple-800 rounded">
                          FK
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-600">{column.description || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Compound Keys */}
        {table.compoundKeys && table.compoundKeys.length > 0 && (
          <div>
            <h3 className="text-md font-semibold text-gray-900 mb-3">Compound Keys</h3>
            <div className="space-y-2">
              {table.compoundKeys.map((ck) => (
                <div key={ck.id} className="border border-gray-300 rounded-md p-3 bg-gray-50">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`px-2 py-0.5 text-xs rounded ${ck.is_primary ? 'bg-blue-100 text-blue-800' : 'bg-gray-200 text-gray-800'}`}
                    >
                      {ck.is_primary ? 'Primary Key' : 'Unique Key'}
                    </span>
                    {ck.name && (
                      <span className="text-sm font-medium text-gray-900">{ck.name}</span>
                    )}
                  </div>
                  <div className="text-sm text-gray-700">
                    Columns:{' '}
                    {ck.column_ids
                      .map((colId) => table.columns.find((c) => c.id === colId)?.name)
                      .filter(Boolean)
                      .join(', ')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Metadata */}
        {table.metadata && Object.keys(table.metadata).length > 0 && (
          <div>
            <h3 className="text-md font-semibold text-gray-900 mb-3">Metadata</h3>
            <div className="border border-gray-300 rounded-md p-3 bg-gray-50">
              <pre className="text-xs text-gray-700 overflow-auto max-h-40">
                {JSON.stringify(table.metadata, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {/* Tags */}
        {table.tags && table.tags.length > 0 && (
          <div>
            <span className="block text-sm font-medium text-gray-700 mb-2">Tags</span>
            <div className="flex flex-wrap gap-2">
              {table.tags.map((tag, index) => (
                <span key={index} className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
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
                            <label
                              htmlFor="table-sql-dialect"
                              className="block text-xs font-medium text-gray-600 mb-1"
                            >
                              SQL Dialect:
                            </label>
                            <select
                              id="table-sql-dialect"
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
                      {/* Documentation Export */}
                      <div className="border-t border-gray-200 pt-1">
                        <div className="px-4 py-1 text-xs font-medium text-gray-500 uppercase tracking-wide">
                          Documentation
                        </div>
                        <button
                          onClick={() => handleExportTable('markdown')}
                          disabled={isExporting || !sdkLoader.hasODCSExport()}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between"
                        >
                          <span>Markdown (.md)</span>
                          {exportFormat === 'markdown' && <span className="text-green-600">✓</span>}
                        </button>
                        <button
                          onClick={() => handleExportTable('pdf')}
                          disabled={isExporting || !sdkLoader.hasODCSExport()}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between"
                        >
                          <span>PDF Document</span>
                          {exportFormat === 'pdf' && <span className="text-green-600">✓</span>}
                        </button>
                      </div>
                    </div>
                    {/* Branding footer */}
                    <div className="border-t border-gray-100 px-4 py-2 bg-gray-50">
                      <p className="text-xs text-gray-400 text-center">
                        Powered by opendatamodelling.com
                      </p>
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
              renderColumnHierarchy(columns)
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
