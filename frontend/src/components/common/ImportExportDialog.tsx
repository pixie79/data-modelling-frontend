/**
 * Import/Export Dialog Component
 * Unified UI for importing and exporting data models
 */

import React, { useState } from 'react';
import { Dialog } from './Dialog';
import { FileUpload } from './FileUpload';
import { UrlImport } from './UrlImport';
import { PasteImport } from './PasteImport';
import { importExportService } from '@/services/sdk/importExportService';
import { odcsService, type ODCSWorkspace } from '@/services/sdk/odcsService';
import { useModelStore } from '@/stores/modelStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useUIStore } from '@/stores/uiStore';
import type { Table } from '@/types/table';

export interface ImportExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

type ImportFormat =
  | 'odcs'
  | 'odcl'
  | 'sql'
  | 'avro'
  | 'json-schema'
  | 'protobuf'
  | 'odps'
  | 'cads'
  | 'bpmn'
  | 'dmn'
  | 'openapi';
type ExportFormat =
  | 'odcs'
  | 'sql'
  | 'avro'
  | 'json-schema'
  | 'protobuf'
  | 'odps'
  | 'cads'
  | 'bpmn'
  | 'dmn'
  | 'openapi';
type SQLDialect = 'postgresql' | 'mysql' | 'sqlite' | 'mssql' | 'databricks';

export const ImportExportDialog: React.FC<ImportExportDialogProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'import' | 'export'>('import');
  const [importFormat, setImportFormat] = useState<ImportFormat>('odcs');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('odcs');
  const [sqlDialect, setSqlDialect] = useState<SQLDialect>('postgresql');
  const [isProcessing, setIsProcessing] = useState(false);

  const { tables, relationships } = useModelStore();
  const { addToast } = useUIStore();

  const handleFileImport = async (file: File) => {
    setIsProcessing(true);
    try {
      const content = await file.text();
      await handleImportContent(content, importFormat);
      addToast({
        type: 'success',
        message: `Successfully imported from ${file.name}`,
      });
      // Close dialog after successful import
      onClose();
    } catch (error) {
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to import file',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUrlImport = async (content: string) => {
    setIsProcessing(true);
    try {
      await handleImportContent(content, importFormat);
      addToast({
        type: 'success',
        message: 'Successfully imported from URL',
      });
      // Close dialog after successful import
      onClose();
    } catch (error) {
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to import from URL',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePasteImport = async (content: string) => {
    setIsProcessing(true);
    try {
      await handleImportContent(content, importFormat);
      addToast({
        type: 'success',
        message: 'Successfully imported from pasted content',
      });
      // Close dialog after successful import
      onClose();
    } catch (error) {
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to import pasted content',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImportContent = async (content: string, format: ImportFormat) => {
    console.log('[ImportExportDialog] handleImportContent called with format:', format);
    console.log('[ImportExportDialog] Content length:', content.length);
    console.log('[ImportExportDialog] Content preview:', content.substring(0, 200));

    const {
      setTables,
      setRelationships,
      setDomains,
      setSystems,
      selectedDomainId: initialSelectedDomainId,
      selectedSystemId,
      systems: existingSystems,
      updateSystem,
      tables: existingTables,
      domains,
    } = useModelStore.getState();

    try {
      let workspace: ODCSWorkspace | null = null;

      switch (format) {
        case 'odcs':
          workspace = await odcsService.parseYAML(content);
          break;
        case 'odcl':
          workspace = await odcsService.parseODCL(content);
          break;
        case 'sql':
          workspace = await importExportService.importFromSQL(content, sqlDialect);
          break;
        case 'avro':
          workspace = await importExportService.importFromAVRO(content);
          break;
        case 'json-schema':
          workspace = await importExportService.importFromJSONSchema(content);
          break;
        case 'protobuf':
          workspace = await importExportService.importFromProtobuf(content);
          break;
        case 'odps': {
          const { odpsService } = await import('@/services/sdk/odpsService');
          const odpsProduct = await odpsService.parseYAML(content);
          // Add product to store
          useModelStore.getState().addProduct(odpsProduct);
          addToast({
            type: 'success',
            message: `Successfully imported ODPS product: ${odpsProduct.name}`,
          });
          onClose();
          return;
        }
        case 'cads': {
          const { cadsService } = await import('@/services/sdk/cadsService');
          const cadsAsset = await cadsService.parseYAML(content);
          // Add asset to store
          useModelStore.getState().addComputeAsset(cadsAsset);
          addToast({
            type: 'success',
            message: `Successfully imported CADS asset: ${cadsAsset.name}`,
          });
          onClose();
          return;
        }
        case 'bpmn': {
          const { bpmnService } = await import('@/services/sdk/bpmnService');
          const bpmnProcess = await bpmnService.parseXML(content);
          // Add process to store
          useModelStore.getState().addBPMNProcess(bpmnProcess);
          addToast({
            type: 'success',
            message: `Successfully imported BPMN process: ${bpmnProcess.name}`,
          });
          onClose();
          return;
        }
        case 'dmn': {
          const { dmnService } = await import('@/services/sdk/dmnService');
          const dmnDecision = await dmnService.parseXML(content);
          // Add decision to store
          useModelStore.getState().addDMNDecision(dmnDecision);
          addToast({
            type: 'success',
            message: `Successfully imported DMN decision: ${dmnDecision.name}`,
          });
          onClose();
          return;
        }
        case 'openapi': {
          const { openapiService } = await import('@/services/sdk/openapiService');
          const openapiSpec = await openapiService.parse(content, 'yaml');
          // Convert OpenAPI spec to workspace structure
          const openapiTables = await openapiService.toODCSTables(openapiSpec);
          workspace = { tables: openapiTables, relationships: [], domains: [] };
          break;
        }
        default:
          throw new Error(`Unsupported import format: ${format}`);
      }

      // Update store with imported data (only for formats that return workspace)
      if (workspace && workspace.tables && workspace.tables.length > 0) {
        console.log('[ImportExportDialog] Imported workspace:', workspace);
        console.log('[ImportExportDialog] Imported tables:', workspace.tables);

        // Map imported tables to current domain if available
        // Normalize UUIDs to ensure they're valid (critical for exports)
        // Import validation utilities once before processing tables
        const { normalizeWorkspaceUUIDs, normalizeUUID } = await import('@/utils/validation');

        // Get current selected domain ID, or use first available domain
        let currentDomainId = initialSelectedDomainId;

        // If no domain is selected, try to use the first available domain
        if (!currentDomainId && domains.length > 0 && domains[0]) {
          currentDomainId = domains[0].id;
          useModelStore.getState().setSelectedDomain(currentDomainId);
          console.log(
            '[ImportExportDialog] No domain selected, using first available domain:',
            currentDomainId
          );
        }

        // Validate that we have a domain ID (even if invalid UUID, we'll normalize it)
        if (!currentDomainId) {
          throw new Error('No domain available. Please create a domain before importing tables.');
        }

        // Don't normalize existing domain IDs - preserve them as-is
        // Only normalize IDs for imported data, not for existing domains
        // If the domain exists in the store, use its ID as-is (even if not a standard UUID)
        const domainToUpdate = domains.find((d) => d.id === currentDomainId);
        if (!domainToUpdate) {
          // Domain not found in store - this shouldn't happen, but if it does, log a warning
          console.warn('[ImportExportDialog] Domain not found in store:', currentDomainId);
        }
        // Use the domain ID as-is - don't normalize it
        // The domain ID should remain consistent throughout the application lifecycle

        // Use normalized domain ID for the rest of the function
        const selectedDomainId = currentDomainId;

        // Clear primary_domain_id from tables before normalization so we can set it to current domain
        const workspaceWithClearedDomainIds = {
          ...workspace,
          domain_id: undefined, // Don't use workspace domain_id - we'll set it per table
          tables: workspace.tables.map((table: any) => ({
            ...table,
            primary_domain_id: undefined, // Clear it so normalizeWorkspaceUUIDs doesn't normalize it
          })),
        };
        const normalizedWorkspace = normalizeWorkspaceUUIDs(workspaceWithClearedDomainIds);

        // Always use the current selectedDomainId (the domain where we're importing)
        // This ensures imported tables belong to the current domain and are editable
        // currentDomainId is already normalized above, so we can use it directly

        // Ensure all required fields are preserved, especially name and columns
        const tablesWithDomain = normalizedWorkspace.tables.map((table: Table, index: number) => {
          console.log(`[ImportExportDialog] Processing table ${index}:`, table);
          console.log(`[ImportExportDialog] Table name: "${table.name}", columns:`, table.columns);

          // Cast to any to access potential alternative property names
          const tableAny = table as any;

          // Preserve name - don't override if it exists, try alternative property names
          // The normalizeTable should have already set the name, but double-check
          const finalName =
            table.name ||
            tableAny.table_name ||
            tableAny.entity_name ||
            tableAny.label ||
            `Table_${index + 1}`;

          // Preserve columns if they exist, ensure it's an array
          const finalColumns = Array.isArray(table.columns)
            ? table.columns
            : table.columns
              ? [table.columns]
              : [];

          console.log(
            `[ImportExportDialog] Final name: "${finalName}", final columns count: ${finalColumns.length}`
          );

          // Ensure table has required fields - preserve original data first
          // Don't spread table first, as we want to ensure our resolved values are used
          const mappedTable: Table = {
            ...table,
            // Use the resolved name (normalizeTable should have set it, but ensure it's not empty)
            name: finalName.trim() || `Table_${index + 1}`,
            // Use the resolved columns (normalizeTable should have set them)
            columns: finalColumns,
            // Ensure required fields are set and normalize UUIDs
            id: normalizeUUID(table.id),
            workspace_id: normalizeUUID(
              table.workspace_id ||
                useWorkspaceStore.getState().currentWorkspaceId ||
                'offline-workspace'
            ),
            // Always override with current domain ID - never use what's in the imported table
            // selectedDomainId is already normalized above
            primary_domain_id: selectedDomainId,
            visible_domains: [selectedDomainId], // Also set visible_domains to current domain
            // Ensure position and size are set - try alternative property names
            position_x: table.position_x ?? tableAny.x ?? index * 250,
            position_y: table.position_y ?? tableAny.y ?? 0,
            width: table.width ?? 200,
            height: table.height ?? 150,
            // Ensure timestamps are set
            created_at: table.created_at || new Date().toISOString(),
            last_modified_at: table.last_modified_at || new Date().toISOString(),
          };

          // Normalize all UUIDs in the table (columns, compound keys, etc.)
          const normalizedTable = normalizeWorkspaceUUIDs({ tables: [mappedTable] }).tables[0];

          console.log(`[ImportExportDialog] Mapped table:`, normalizedTable);
          return normalizedTable;
        });

        console.log('[ImportExportDialog] Setting tables:', tablesWithDomain);

        // Merge with existing tables instead of replacing them
        const existingTableIds = new Set((existingTables || []).map((t) => t.id));

        // Filter out duplicates and merge
        const newTables = tablesWithDomain.filter((t: Table) => !existingTableIds.has(t.id));
        const mergedTables = [...(existingTables || []), ...newTables];

        setTables(mergedTables);

        // IMPORTANT: Preserve existing systems - never clear them during import
        // Systems are domain-specific and should not be affected by ODCS table imports
        console.log('[ImportExportDialog] Preserving existing systems:', existingSystems.length);

        // If a system is selected, add imported tables to that system
        if (selectedSystemId && newTables.length > 0) {
          const selectedSystem = existingSystems.find((s) => s.id === selectedSystemId);
          if (selectedSystem) {
            const newTableIds = newTables.map((t: Table) => t.id);
            const updatedTableIds = [...(selectedSystem.table_ids || []), ...newTableIds];
            // Remove duplicates
            const uniqueTableIds = Array.from(new Set(updatedTableIds));
            updateSystem(selectedSystemId, { table_ids: uniqueTableIds });
            console.log(
              `[ImportExportDialog] Added ${newTables.length} table(s) to system "${selectedSystem.name}"`
            );
          }
        }

        addToast({
          type: 'success',
          message: `Successfully imported ${workspace.tables.length} table(s)${selectedSystemId ? ' into selected system' : ''}`,
        });

        // Small delay to ensure store updates propagate before closing
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Close dialog after successful import
        onClose();
      } else {
        addToast({
          type: 'warning',
          message:
            format === 'sql'
              ? `No tables found in imported SQL content. Please ensure your SQL contains CREATE TABLE statements and that the dialect "${sqlDialect}" is correct.`
              : `No tables found in imported ${format.toUpperCase()} content.`,
        });
      }

      if (workspace && workspace.relationships && workspace.relationships.length > 0) {
        // Map imported relationships to current domain if available
        const currentDomainIdForRelationships =
          useModelStore.getState().selectedDomainId ||
          (domains.length > 0 && domains[0] ? domains[0].id : 'default-domain');
        const relationshipsWithDomain = workspace.relationships.map((rel) => ({
          ...rel,
          workspace_id: useWorkspaceStore.getState().currentWorkspaceId || 'offline-workspace',
          domain_id: currentDomainIdForRelationships,
        }));
        setRelationships(relationshipsWithDomain);
      }

      // If workspace has domains, add them (but don't replace existing ones)
      // IMPORTANT: When merging domains, preserve systems from existing domains
      if (
        workspace &&
        workspace.domains &&
        Array.isArray(workspace.domains) &&
        workspace.domains.length > 0
      ) {
        const currentState = useModelStore.getState();
        const existingDomains = currentState.domains || [];
        const existingSystems = currentState.systems || [];

        // Merge domains, preserving systems from existing domains
        const newDomains = workspace.domains.filter(
          (domain: any) => !existingDomains.some((d) => d.id === domain.id)
        );

        if (newDomains.length > 0) {
          // When adding new domains, preserve all existing systems
          setDomains([...existingDomains, ...newDomains]);
          console.log(
            '[ImportExportDialog] Added new domains, preserving existing systems:',
            existingSystems.length
          );
        }

        // IMPORTANT: Never clear or overwrite systems during ODCS import
        // Systems are managed separately and should only be modified explicitly
        // If imported domains have systems embedded, we should merge them, not replace
        if (workspace.systems && Array.isArray(workspace.systems) && workspace.systems.length > 0) {
          console.log(
            '[ImportExportDialog] Found systems in imported workspace, merging with existing systems'
          );
          const importedSystems = workspace.systems;
          const existingSystemIds = new Set(existingSystems.map((s) => s.id));
          const newSystems = importedSystems.filter((s: any) => !existingSystemIds.has(s.id));

          if (newSystems.length > 0) {
            // Only add new systems, never replace existing ones
            setSystems([...existingSystems, ...newSystems]);
            console.log(
              `[ImportExportDialog] Added ${newSystems.length} new system(s), preserved ${existingSystems.length} existing system(s)`
            );
          } else {
            console.log(
              '[ImportExportDialog] No new systems to add, all imported systems already exist'
            );
          }
        } else {
          // Ensure existing systems are preserved even if imported workspace has no systems
          console.log(
            '[ImportExportDialog] No systems in imported workspace, preserving existing systems:',
            existingSystems.length
          );
        }
      } else {
        // Even if no domains are imported, ensure systems are preserved
        console.log(
          '[ImportExportDialog] No domains in imported workspace, preserving existing systems:',
          existingSystems.length
        );
      }
    } catch (error) {
      throw new Error(
        `Failed to import ${format}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  };

  const handleExport = async () => {
    setIsProcessing(true);
    try {
      // Get current workspace data including all domain assets
      const { products, computeAssets, bpmnProcesses, dmnDecisions, domains } =
        useModelStore.getState();
      const workspace = {
        tables,
        relationships,
        domains,
        products,
        compute_assets: computeAssets,
        bpmn_processes: bpmnProcesses,
        dmn_decisions: dmnDecisions,
      };

      let content: string;
      let filename: string;
      let mimeType: string;

      switch (exportFormat) {
        case 'odcs':
          content = await odcsService.toYAML(workspace as any);
          filename = 'workspace.odcs.yaml';
          mimeType = 'application/yaml';
          break;
        case 'sql':
          content = await importExportService.exportToSQL(workspace as any, sqlDialect);
          filename = `workspace.${sqlDialect}.sql`;
          mimeType = 'text/sql';
          break;
        case 'avro':
          content = await importExportService.exportToAVRO(workspace as any);
          filename = 'workspace.avsc';
          mimeType = 'application/json';
          break;
        case 'json-schema':
          content = await importExportService.exportToJSONSchema(workspace as any);
          filename = 'workspace.schema.json';
          mimeType = 'application/json';
          break;
        case 'protobuf':
          content = await importExportService.exportToProtobuf(workspace as any);
          filename = 'workspace.proto';
          mimeType = 'text/plain';
          break;
        case 'odps': {
          if (products.length === 0) {
            throw new Error('No data products to export');
          }
          const { odpsService } = await import('@/services/sdk/odpsService');
          const productToExport = products[0];
          if (!productToExport) {
            throw new Error('No data products to export');
          }
          // Get domain name for ODPS export
          const productDomain = domains.find((d) => d.id === productToExport.domain_id);
          const productDomainName = productDomain?.name || 'unknown';
          content = await odpsService.toYAML(productToExport, productDomainName);
          filename = `${productToExport.name || 'product'}.odps.yaml`;
          mimeType = 'application/yaml';
          break;
        }
        case 'cads': {
          if (computeAssets.length === 0) {
            throw new Error('No compute assets to export');
          }
          const { cadsService } = await import('@/services/sdk/cadsService');
          const assetToExport = computeAssets[0];
          if (!assetToExport) {
            throw new Error('No compute assets to export');
          }
          content = await cadsService.toYAML(assetToExport);
          filename = `${assetToExport.name || 'asset'}.cads.yaml`;
          mimeType = 'application/yaml';
          break;
        }
        case 'bpmn': {
          if (bpmnProcesses.length === 0) {
            throw new Error('No BPMN processes to export');
          }
          const { bpmnService } = await import('@/services/sdk/bpmnService');
          const processToExport = bpmnProcesses[0];
          if (!processToExport) {
            throw new Error('No BPMN processes to export');
          }
          content = await bpmnService.toXML(processToExport);
          filename = `${processToExport.name || 'process'}.bpmn`;
          mimeType = 'application/xml';
          break;
        }
        case 'dmn': {
          if (dmnDecisions.length === 0) {
            throw new Error('No DMN decisions to export');
          }
          const { dmnService } = await import('@/services/sdk/dmnService');
          const decisionToExport = dmnDecisions[0];
          if (!decisionToExport) {
            throw new Error('No DMN decisions to export');
          }
          content = await dmnService.toXML(decisionToExport);
          filename = `${decisionToExport.name || 'decision'}.dmn`;
          mimeType = 'application/xml';
          break;
        }
        case 'openapi': {
          const { openapiService } = await import('@/services/sdk/openapiService');
          content = await openapiService.toFormat(workspace as any, 'yaml');
          filename = 'workspace.openapi.yaml';
          mimeType = 'application/yaml';
          break;
        }
        default:
          throw new Error(`Unsupported export format: ${exportFormat}`);
      }

      // Download file
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      addToast({
        type: 'success',
        message: `Successfully exported to ${filename}`,
      });
    } catch (error) {
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to export',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Import / Export" size="lg">
      <div className="space-y-4">
        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('import')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'import'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Import
          </button>
          <button
            onClick={() => setActiveTab('export')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'export'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Export
          </button>
        </div>

        {/* Import Tab */}
        {activeTab === 'import' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Import Format</label>
              <select
                value={importFormat}
                onChange={(e) => setImportFormat(e.target.value as ImportFormat)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="odcs">ODCS 3.1.0 (Data Contract Standard)</option>
                <option value="odcl">ODCL (Data Contract Language)</option>
                <option value="sql">SQL (CREATE TABLE)</option>
                <option value="avro">AVRO Schema</option>
                <option value="json-schema">JSON Schema</option>
                <option value="protobuf">Protobuf Schema</option>
                <option value="odps">ODPS (Data Product)</option>
                <option value="cads">CADS (Compute Asset)</option>
                <option value="bpmn">BPMN 2.0</option>
                <option value="dmn">DMN 1.3</option>
                <option value="openapi">OpenAPI</option>
              </select>
            </div>

            {importFormat === 'sql' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">SQL Dialect</label>
                <select
                  value={sqlDialect}
                  onChange={(e) => setSqlDialect(e.target.value as SQLDialect)}
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

            <div className="space-y-4">
              <FileUpload
                onFileSelect={handleFileImport}
                accept={
                  importFormat === 'odcs' ||
                  importFormat === 'odcl' ||
                  importFormat === 'odps' ||
                  importFormat === 'cads' ||
                  importFormat === 'openapi'
                    ? '.yaml,.yml'
                    : importFormat === 'sql'
                      ? '.sql'
                      : importFormat === 'bpmn' || importFormat === 'dmn'
                        ? '.xml,.bpmn,.dmn'
                        : '.json'
                }
                label="Upload File"
              />
              <UrlImport onImport={handleUrlImport} />
              <PasteImport onImport={handlePasteImport} />
            </div>
          </div>
        )}

        {/* Export Tab */}
        {activeTab === 'export' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Export Format</label>
              <select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="odcs">ODCS 3.1.0</option>
                <option value="sql">SQL (CREATE TABLE)</option>
                <option value="avro">AVRO Schema</option>
                <option value="json-schema">JSON Schema</option>
                <option value="protobuf">Protobuf Schema</option>
                <option value="odps">ODPS (Data Product)</option>
                <option value="cads">CADS (Compute Asset)</option>
                <option value="bpmn">BPMN 2.0</option>
                <option value="dmn">DMN 1.3</option>
                <option value="openapi">OpenAPI</option>
              </select>
            </div>

            {exportFormat === 'sql' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">SQL Dialect</label>
                <select
                  value={sqlDialect}
                  onChange={(e) => setSqlDialect(e.target.value as SQLDialect)}
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

            <button
              onClick={handleExport}
              disabled={isProcessing || tables.length === 0}
              className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? 'Exporting...' : 'Export'}
            </button>
          </div>
        )}
      </div>
    </Dialog>
  );
};
