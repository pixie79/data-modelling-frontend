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
import { odcsService } from '@/services/sdk/odcsService';
import { useModelStore } from '@/stores/modelStore';
import { useUIStore } from '@/stores/uiStore';

export interface ImportExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

type ImportFormat = 'odcs' | 'sql' | 'avro' | 'json-schema' | 'protobuf';
type ExportFormat = 'odcs' | 'sql' | 'avro' | 'json-schema' | 'protobuf';
type SQLDialect = 'postgresql' | 'mysql' | 'sqlite' | 'mssql';

export const ImportExportDialog: React.FC<ImportExportDialogProps> = ({
  isOpen,
  onClose,
}) => {
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
    } catch (error) {
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to import pasted content',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImportContent = async (_content: string, format: ImportFormat) => {
    // TODO: Implement import when SDK is available
    switch (format) {
      case 'odcs':
        // await odcsService.parseYAML(content);
        break;
      case 'sql':
        // await importExportService.importFromSQL(content, sqlDialect);
        break;
      case 'avro':
        // await importExportService.importFromAVRO(content);
        break;
      case 'json-schema':
        // await importExportService.importFromJSONSchema(content);
        break;
      case 'protobuf':
        // await importExportService.importFromProtobuf(content);
        break;
      default:
        throw new Error(`Unsupported import format: ${format}`);
    }

    // Update store with imported data
    // TODO: Map workspace to tables and relationships when SDK is integrated
  };

  const handleExport = async () => {
    setIsProcessing(true);
    try {
      // Get current workspace data including data flow diagrams
      const { dataFlowDiagrams } = useModelStore.getState();
      const workspace = {
        tables,
        relationships,
        data_flow_diagrams: dataFlowDiagrams,
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
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Import Format
              </label>
              <select
                value={importFormat}
                onChange={(e) => setImportFormat(e.target.value as ImportFormat)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="odcs">ODCS 3.1.0</option>
                <option value="sql">SQL (CREATE TABLE)</option>
                <option value="avro">AVRO Schema</option>
                <option value="json-schema">JSON Schema</option>
                <option value="protobuf">Protobuf Schema</option>
              </select>
            </div>

            {importFormat === 'sql' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  SQL Dialect
                </label>
                <select
                  value={sqlDialect}
                  onChange={(e) => setSqlDialect(e.target.value as SQLDialect)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="postgresql">PostgreSQL</option>
                  <option value="mysql">MySQL</option>
                  <option value="sqlite">SQLite</option>
                  <option value="mssql">SQL Server</option>
                </select>
              </div>
            )}

            <div className="space-y-4">
              <FileUpload
                onFileSelect={handleFileImport}
                accept={importFormat === 'odcs' ? '.yaml,.yml' : importFormat === 'sql' ? '.sql' : '.json'}
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
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Export Format
              </label>
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
              </select>
            </div>

            {exportFormat === 'sql' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  SQL Dialect
                </label>
                <select
                  value={sqlDialect}
                  onChange={(e) => setSqlDialect(e.target.value as SQLDialect)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="postgresql">PostgreSQL</option>
                  <option value="mysql">MySQL</option>
                  <option value="sqlite">SQLite</option>
                  <option value="mssql">SQL Server</option>
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

