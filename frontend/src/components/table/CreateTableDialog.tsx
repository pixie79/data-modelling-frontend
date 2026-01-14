/**
 * Create Table Dialog
 * Dialog for creating a new table manually or importing from ODCS YAML
 */

import React, { useState, useEffect } from 'react';
import { DraggableModal } from '@/components/common/DraggableModal';
import { useModelStore } from '@/stores/modelStore';
import { useUIStore } from '@/stores/uiStore';
import { isValidTableName, generateUUID } from '@/utils/validation';
import { odcsService } from '@/services/sdk/odcsService';
import { importExportService } from '@/services/sdk/importExportService';
import { openapiService } from '@/services/sdk/openapiService';
import type { CreateTableRequest } from '@/types/api';
import type { Table } from '@/types/table';

export interface CreateTableDialogProps {
  workspaceId: string;
  domainId: string;
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (tableId: string) => void;
}

export const CreateTableDialog: React.FC<CreateTableDialogProps> = ({
  workspaceId,
  domainId,
  isOpen,
  onClose,
  onCreated,
}) => {
  const {
    createTable,
    selectedSystemId,
    systems,
    updateSystem,
    addTable,
    selectedDomainId,
    domains,
  } = useModelStore();
  const { addToast } = useUIStore();
  const [isCreating, setIsCreating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importMode, setImportMode] = useState(false);
  const [importYaml, setImportYaml] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importFormat, setImportFormat] = useState<
    'odcs' | 'sql' | 'avro' | 'json-schema' | 'protobuf' | 'openapi'
  >('odcs');
  const [sqlDialect, setSqlDialect] = useState<
    'postgresql' | 'mysql' | 'sqlite' | 'mssql' | 'databricks'
  >('postgresql');
  const [openapiFormat, setOpenapiFormat] = useState<'yaml' | 'json'>('yaml');
  const [name, setName] = useState('');
  const [alias, setAlias] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Reset form when dialog closes (but preserve import format settings)
  useEffect(() => {
    if (!isOpen) {
      // Only reset import mode and content, not format settings
      setImportMode(false);
      setImportYaml('');
      setImportFile(null);
      setName('');
      setAlias('');
      setError(null);
      // Preserve importFormat, sqlDialect, and openapiFormat for next use
    }
  }, [isOpen]);

  const handleImport = async () => {
    if (!importYaml.trim() && !importFile) {
      addToast({
        type: 'error',
        message: `Please paste ${importFormat.toUpperCase()} content or select a file`,
      });
      return;
    }

    setIsImporting(true);
    setError(null);

    try {
      const content = importYaml.trim() || (importFile ? await importFile.text() : '');

      let workspace;
      if (importFormat === 'odcs') {
        workspace = await odcsService.parseYAML(content);
      } else if (importFormat === 'sql') {
        workspace = await importExportService.importFromSQL(content, sqlDialect);
      } else if (importFormat === 'avro') {
        workspace = await importExportService.importFromAVRO(content);
      } else if (importFormat === 'json-schema') {
        workspace = await importExportService.importFromJSONSchema(content);
      } else if (importFormat === 'protobuf') {
        workspace = await importExportService.importFromProtobuf(content);
      } else if (importFormat === 'openapi') {
        // OpenAPI needs special handling - convert to ODCS tables
        const spec = await openapiService.parse(content, openapiFormat);
        const tables = await openapiService.toODCSTables(spec);
        // Get canvas center position for new tables
        const centerX = window.innerWidth / 2 - 200;
        const centerY = window.innerHeight / 2 - 150;
        workspace = {
          tables: tables.map((t: any, index: number) => ({
            ...t,
            id: t.id && isValidUUID(t.id) ? t.id : generateUUID(),
            workspace_id: workspaceId || 'offline-workspace',
            primary_domain_id: domainId,
            columns: t.columns || [],
            position_x: t.position_x ?? centerX + index * 250,
            position_y: t.position_y ?? centerY,
            width: t.width ?? 200,
            height: t.height ?? 150,
            created_at: t.created_at || new Date().toISOString(),
            last_modified_at: t.last_modified_at || new Date().toISOString(),
          })),
          relationships: [],
        } as any;
      } else {
        throw new Error(`Unsupported import format: ${importFormat}`);
      }

      if (!workspace.tables || workspace.tables.length === 0) {
        // Provide more helpful error message based on import format
        const formatHint =
          importFormat === 'sql'
            ? ` Please ensure your SQL contains CREATE TABLE statements and that the dialect "${sqlDialect}" is correct.`
            : '';
        throw new Error(
          `No tables found in imported ${importFormat.toUpperCase()} content.${formatHint}`
        );
      }

      // Get canvas center position for new tables
      const centerX = window.innerWidth / 2 - 200;
      const centerY = window.innerHeight / 2 - 150;

      // Import all tables from the workspace - normalize UUIDs to ensure validity
      const { normalizeUUID, normalizeWorkspaceUUIDs, isValidUUID } =
        await import('@/utils/validation');

      // Use current workspace/domain IDs if workspace doesn't have valid UUIDs
      // ODCL format might have string identifiers instead of UUIDs
      // Always prefer selectedDomainId from store over prop (more reliable)
      let currentDomainIdFromStore = selectedDomainId || domainId;

      // If no domain is selected, try to use the first available domain
      if (!currentDomainIdFromStore && domains.length > 0 && domains[0]) {
        currentDomainIdFromStore = domains[0].id;
        console.log(
          '[CreateTableDialog] No domain selected, using first available domain:',
          currentDomainIdFromStore
        );
      }

      // Validate that we have a domain ID (even if invalid UUID, we'll normalize it)
      if (!currentDomainIdFromStore) {
        throw new Error('No domain available. Please create a domain before importing tables.');
      }

      // Use the domain ID as-is - don't normalize it
      // The domain ID should remain consistent throughout the application lifecycle
      // Only normalize IDs for imported data (tables, relationships, etc.), not for the domain we're importing into
      const domainToCheck = domains.find((d) => d.id === currentDomainIdFromStore);
      if (!domainToCheck) {
        // Domain not found in store - this shouldn't happen, but if it does, log a warning
        console.warn('[CreateTableDialog] Domain not found in store:', currentDomainIdFromStore);
      }

      // Use domain ID as-is - preserve it exactly as it exists in the store
      const currentDomainId = currentDomainIdFromStore;

      const finalWorkspaceId =
        workspace.workspace_id && isValidUUID(workspace.workspace_id)
          ? workspace.workspace_id
          : workspaceId || 'offline-workspace';

      // Normalize workspace with proper IDs
      // Clear primary_domain_id from tables before normalization so we can set it to current domain
      const workspaceWithValidIds = {
        ...workspace,
        workspace_id: normalizeUUID(finalWorkspaceId),
        domain_id: undefined, // Don't use workspace domain_id - we'll set it per table
        tables: workspace.tables.map((table: any) => ({
          ...table,
          primary_domain_id: undefined, // Clear it so normalizeWorkspaceUUIDs doesn't normalize it
        })),
      };
      const normalizedWorkspace = normalizeWorkspaceUUIDs(workspaceWithValidIds);

      console.log('[CreateTableDialog] Importing tables with domain ID:', {
        selectedDomainIdFromStore: selectedDomainId,
        domainIdProp: domainId,
        currentDomainIdFromStore,
        currentDomainId,
        isValid: isValidUUID(currentDomainId),
      });

      const importedTables: Table[] = normalizedWorkspace.tables.map(
        (table: Table, index: number) => {
          const importedTable = {
            ...table,
            id: normalizeUUID(table.id),
            workspace_id: normalizedWorkspace.workspace_id || normalizeUUID(finalWorkspaceId),
            // Always override with current domain ID - never use what's in the imported table
            primary_domain_id: currentDomainId,
            visible_domains: [currentDomainId], // Also set visible_domains to current domain
            position_x: table.position_x ?? centerX + index * 250,
            position_y: table.position_y ?? centerY,
            width: table.width ?? 200,
            height: table.height ?? 150,
            created_at: table.created_at || new Date().toISOString(),
            last_modified_at: table.last_modified_at || new Date().toISOString(),
          };

          console.log(`[CreateTableDialog] Imported table ${index} (${importedTable.name}):`, {
            id: importedTable.id,
            primary_domain_id: importedTable.primary_domain_id,
            selectedDomainId,
            matches: importedTable.primary_domain_id === selectedDomainId,
            // Debug: ODCS table-level fields
            physicalName: importedTable.physicalName,
            businessName: importedTable.businessName,
            physicalType: importedTable.physicalType,
            description: importedTable.description,
            status: importedTable.status,
          });

          return importedTable;
        }
      );

      // Add tables to store
      importedTables.forEach((table) => {
        addTable(table);
      });

      // If a system is selected, add imported tables to that system
      if (selectedSystemId && importedTables.length > 0) {
        const selectedSystem = systems.find((s) => s.id === selectedSystemId);
        if (selectedSystem) {
          const newTableIds = importedTables.map((t) => t.id);
          const updatedTableIds = [...(selectedSystem.table_ids || []), ...newTableIds];
          const uniqueTableIds = Array.from(new Set(updatedTableIds));
          updateSystem(selectedSystemId, { table_ids: uniqueTableIds });
        }
      }

      addToast({
        type: 'success',
        message: `Successfully imported ${importedTables.length} table(s)${selectedSystemId ? ' into selected system' : ''}`,
      });

      // Call onCreated callback with first table if provided
      if (onCreated && importedTables.length > 0 && importedTables[0]) {
        onCreated(importedTables[0].id);
      }

      // Reset form and close
      setImportYaml('');
      setImportFile(null);
      setError(null);

      // Small delay to ensure store updates propagate before closing
      await new Promise((resolve) => setTimeout(resolve, 100));

      onClose();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to import table';
      setError(errorMessage);
      addToast({
        type: 'error',
        message: errorMessage,
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleCreate = async () => {
    setError(null);

    // Validate name
    if (!name.trim()) {
      setError('Table name is required');
      return;
    }

    if (!isValidTableName(name.trim())) {
      setError('Table name must be alphanumeric with underscores only');
      return;
    }

    setIsCreating(true);
    try {
      // Get canvas center position for new table
      const centerX = window.innerWidth / 2 - 200;
      const centerY = window.innerHeight / 2 - 150;

      const request: CreateTableRequest = {
        name: name.trim(),
        alias: alias.trim() || undefined,
        model_type: 'conceptual', // Legacy field - views now handle model types
        primary_domain_id: domainId,
        position_x: centerX,
        position_y: centerY,
        width: 200,
        height: 150,
        columns: [],
      };

      const table = await createTable(domainId, request);

      // If a system is selected, add the table to that system
      if (selectedSystemId) {
        const selectedSystem = systems.find((s) => s.id === selectedSystemId);
        if (selectedSystem) {
          const updatedTableIds = [...(selectedSystem.table_ids || []), table.id];
          const uniqueTableIds = Array.from(new Set(updatedTableIds));
          updateSystem(selectedSystemId, { table_ids: uniqueTableIds });
        }
      }

      addToast({
        type: 'success',
        message: `Table "${table.name}" created successfully${selectedSystemId ? ' and added to selected system' : ''}`,
      });

      // Reset form
      setName('');
      setAlias('');
      setError(null);

      // Call onCreated callback if provided
      if (onCreated) {
        onCreated(table.id);
      }

      // Small delay to ensure store updates propagate before closing
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Close dialog
      onClose();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create table';
      setError(errorMessage);
      addToast({
        type: 'error',
        message: errorMessage,
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isCreating && name.trim()) {
      handleCreate();
    }
  };

  return (
    <DraggableModal
      isOpen={isOpen}
      onClose={onClose}
      title={importMode ? 'Import Table' : 'Create New Table'}
      size="lg"
      initialPosition={{
        x: window.innerWidth / 2 - 400,
        y: window.innerHeight / 2 - 300,
      }}
    >
      <div className="flex flex-col h-full max-h-[80vh]">
        {/* Mode Toggle - Fixed at top */}
        <div className="flex gap-2 border-b pb-3 flex-shrink-0">
          <button
            type="button"
            onClick={() => {
              setImportMode(false);
              setImportYaml('');
              setImportFile(null);
              setError(null);
            }}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded ${
              !importMode ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Create New
          </button>
          <button
            type="button"
            onClick={() => {
              setImportMode(true);
              setName('');
              setAlias('');
              setError(null);
            }}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded ${
              importMode ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            title="Switch to import mode"
          >
            Import Mode
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md flex-shrink-0">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto pr-2 -mr-2">
          {importMode ? (
            /* Import Mode */
            <div className="space-y-4 pb-4">
              <div>
                <label
                  htmlFor="import-format"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Import Format
                </label>
                <select
                  id="import-format"
                  value={importFormat}
                  onChange={(e) => {
                    setImportFormat(e.target.value as typeof importFormat);
                    setImportYaml('');
                    setImportFile(null);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="odcs">ODCS 3.1.0</option>
                  <option value="sql">SQL (CREATE TABLE)</option>
                  <option value="avro">AVRO Schema</option>
                  <option value="json-schema">JSON Schema</option>
                  <option value="protobuf">Protobuf Schema</option>
                  <option value="openapi">OpenAPI Specification</option>
                </select>
              </div>

              {importFormat === 'sql' && (
                <div>
                  <label
                    htmlFor="import-sql-dialect"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    SQL Dialect
                  </label>
                  <select
                    id="import-sql-dialect"
                    value={sqlDialect}
                    onChange={(e) => setSqlDialect(e.target.value as typeof sqlDialect)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="postgresql">PostgreSQL</option>
                    <option value="mysql">MySQL</option>
                    <option value="sqlite">SQLite</option>
                    <option value="mssql">SQL Server</option>
                    <option value="databricks">Databricks</option>
                  </select>
                </div>
              )}

              {importFormat === 'openapi' && (
                <div>
                  <label
                    htmlFor="import-openapi-format"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    OpenAPI Format
                  </label>
                  <select
                    id="import-openapi-format"
                    value={openapiFormat}
                    onChange={(e) => setOpenapiFormat(e.target.value as 'yaml' | 'json')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="yaml">YAML</option>
                    <option value="json">JSON</option>
                  </select>
                </div>
              )}

              <div>
                <label
                  htmlFor="import-file"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Load{' '}
                  {importFormat === 'odcs'
                    ? 'ODCS'
                    : importFormat === 'sql'
                      ? 'SQL'
                      : importFormat === 'avro'
                        ? 'AVRO'
                        : importFormat === 'json-schema'
                          ? 'JSON Schema'
                          : importFormat === 'protobuf'
                            ? 'Protobuf'
                            : 'OpenAPI'}{' '}
                  File (Optional)
                </label>
                <input
                  id="import-file"
                  type="file"
                  accept={
                    importFormat === 'odcs'
                      ? '.yaml,.yml'
                      : importFormat === 'sql'
                        ? '.sql'
                        : importFormat === 'avro'
                          ? '.avsc,.avro'
                          : importFormat === 'json-schema'
                            ? '.json,.schema.json'
                            : importFormat === 'protobuf'
                              ? '.proto'
                              : importFormat === 'openapi'
                                ? openapiFormat === 'yaml'
                                  ? '.yaml,.yml'
                                  : '.json'
                                : '*'
                  }
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setImportFile(file);
                    if (file) {
                      file
                        .text()
                        .then((text) => {
                          setImportYaml(text);
                        })
                        .catch((_error) => {
                          addToast({
                            type: 'error',
                            message: 'Failed to read file',
                          });
                        });
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label
                  htmlFor="import-yaml"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Or Paste{' '}
                  {importFormat === 'odcs'
                    ? 'ODCS'
                    : importFormat === 'sql'
                      ? 'SQL'
                      : importFormat === 'avro'
                        ? 'AVRO'
                        : importFormat === 'json-schema'
                          ? 'JSON Schema'
                          : importFormat === 'protobuf'
                            ? 'Protobuf'
                            : 'OpenAPI'}{' '}
                  Content
                </label>
                <textarea
                  id="import-yaml"
                  value={importYaml}
                  onChange={(e) => {
                    setImportYaml(e.target.value);
                    setImportFile(null);
                  }}
                  placeholder={
                    importFormat === 'odcs'
                      ? 'Paste your ODCS YAML schema here...'
                      : importFormat === 'sql'
                        ? 'Paste your SQL CREATE TABLE statement here...'
                        : importFormat === 'avro'
                          ? 'Paste your AVRO schema JSON here...'
                          : importFormat === 'json-schema'
                            ? 'Paste your JSON Schema here...'
                            : importFormat === 'protobuf'
                              ? 'Paste your Protobuf schema here...'
                              : 'Paste your OpenAPI specification here...'
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  rows={15}
                />
              </div>
            </div>
          ) : (
            /* Create Mode */
            <div className="space-y-4 pb-4">
              <div>
                <label
                  htmlFor="table-name"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Table Name *
                </label>
                <input
                  id="table-name"
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setError(null);
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="e.g., Users, Orders, Products"
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    error ? 'border-red-500' : 'border-gray-300'
                  }`}
                  disabled={isCreating}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Alphanumeric characters and underscores only
                </p>
              </div>

              <div>
                <label
                  htmlFor="table-alias"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Alias (Optional)
                </label>
                <input
                  id="table-alias"
                  type="text"
                  value={alias}
                  onChange={(e) => setAlias(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Display name for the table"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isCreating}
                />
              </div>
            </div>
          )}
        </div>

        {/* Fixed Footer with Action Buttons */}
        <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 mt-4 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
            disabled={isCreating || isImporting}
          >
            Cancel
          </button>
          {importMode ? (
            <button
              onClick={handleImport}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isImporting || (!importYaml.trim() && !importFile)}
            >
              {isImporting ? 'Importing...' : 'Import Table'}
            </button>
          ) : (
            <button
              onClick={handleCreate}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isCreating || !name.trim()}
            >
              {isCreating ? 'Creating...' : 'Create Table'}
            </button>
          )}
        </div>
      </div>
    </DraggableModal>
  );
};
