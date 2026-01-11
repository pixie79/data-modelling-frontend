/**
 * Data Product Editor Component
 * Full CRUD editor for ODPS data products
 */

import React, { useState, useEffect } from 'react';
import { Dialog } from '@/components/common/Dialog';
import { useModelStore } from '@/stores/modelStore';
import { useUIStore } from '@/stores/uiStore';
import { odpsService } from '@/services/sdk/odpsService';
import { sdkLoader } from '@/services/sdk/sdkLoader';
import type { DataProduct, ODPSInputPort, ODPSOutputPort, ODPSSupport } from '@/types/odps';

export interface DataProductEditorProps {
  product?: DataProduct;
  domainId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const DataProductEditor: React.FC<DataProductEditorProps> = ({
  product,
  domainId,
  isOpen,
  onClose,
}) => {
  const { tables, addProduct, updateProduct } = useModelStore();
  const { addToast } = useUIStore();
  const [importMode, setImportMode] = useState(false);
  const [importYaml, setImportYaml] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'draft' | 'published' | 'deprecated'>('draft');
  const [team, setTeam] = useState('');
  const [linkedTables, setLinkedTables] = useState<string[]>([]);
  const [inputPorts, setInputPorts] = useState<ODPSInputPort[]>([]);
  const [outputPorts, setOutputPorts] = useState<ODPSOutputPort[]>([]);
  const [support, setSupport] = useState<ODPSSupport>({});

  // Initialize form state from product prop
  useEffect(() => {
    if (product) {
      setName(product.name);
      setDescription(product.description || '');
      setStatus(product.status || 'draft');
      setTeam(product.team || '');
      setLinkedTables(product.linked_tables || []);
      setInputPorts(product.input_ports || []);
      setOutputPorts(product.output_ports || []);
      setSupport(product.support || {});
      setImportMode(false);
      setImportYaml('');
    } else {
      // Reset for new product
      setName('');
      setDescription('');
      setStatus('draft');
      setTeam('');
      setLinkedTables([]);
      setInputPorts([]);
      setOutputPorts([]);
      setSupport({});
      setImportMode(false);
      setImportYaml('');
    }
  }, [product, isOpen]);

  const handleImport = async () => {
    if (!importYaml.trim()) {
      addToast({
        type: 'error',
        message: 'Please paste ODPS YAML content',
      });
      return;
    }

    try {
      const importedProduct = await odpsService.parseYAML(importYaml);

      // Ensure domain_id is set
      const productData: DataProduct = {
        ...importedProduct,
        id: importedProduct.id || crypto.randomUUID(),
        domain_id: domainId,
        created_at: importedProduct.created_at || new Date().toISOString(),
        last_modified_at: new Date().toISOString(),
      };

      addProduct(productData);
      addToast({
        type: 'success',
        message: `Product "${productData.name}" imported successfully`,
      });
      onClose();
    } catch (error) {
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to import product',
      });
    }
  };

  const handleSave = () => {
    if (!name.trim()) {
      addToast({
        type: 'error',
        message: 'Product name is required',
      });
      return;
    }

    const productData: DataProduct = {
      id: product?.id || crypto.randomUUID(),
      domain_id: domainId,
      name: name.trim(),
      description: description.trim() || undefined,
      status,
      team: team.trim() || undefined,
      linked_tables: linkedTables,
      input_ports: inputPorts.length > 0 ? inputPorts : undefined,
      output_ports: outputPorts.length > 0 ? outputPorts : undefined,
      support: Object.keys(support).length > 0 ? support : undefined,
      created_at: product?.created_at || new Date().toISOString(),
      last_modified_at: new Date().toISOString(),
    };

    if (product) {
      updateProduct(product.id, productData);
      addToast({
        type: 'success',
        message: 'Data product updated',
      });
    } else {
      addProduct(productData);
      addToast({
        type: 'success',
        message: 'Data product created',
      });
    }

    onClose();
  };

  const handleAddInputPort = () => {
    setInputPorts([...inputPorts, { name: '', table_id: '', description: '' }]);
  };

  const handleRemoveInputPort = (index: number) => {
    setInputPorts(inputPorts.filter((_, i) => i !== index));
  };

  const handleUpdateInputPort = (index: number, updates: Partial<ODPSInputPort>) => {
    const updated = [...inputPorts];
    updated[index] = { name: '', table_id: '', description: '', ...updated[index], ...updates };
    setInputPorts(updated);
  };

  const handleAddOutputPort = () => {
    setOutputPorts([...outputPorts, { name: '', table_id: '', description: undefined }]);
  };

  const handleRemoveOutputPort = (index: number) => {
    setOutputPorts(outputPorts.filter((_, i) => i !== index));
  };

  const handleUpdateOutputPort = (index: number, updates: Partial<ODPSOutputPort>) => {
    const updated = [...outputPorts];
    updated[index] = { name: '', table_id: '', description: '', ...updated[index], ...updates };
    setOutputPorts(updated);
  };

  const handleExport = async (format: 'yaml' | 'markdown' | 'pdf') => {
    if (!product) return;

    setIsExporting(true);
    setShowExportMenu(false);

    try {
      switch (format) {
        case 'yaml': {
          const content = await odpsService.toYAML(product);
          const blob = new Blob([content], { type: 'text/yaml' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${product.name}.odps.yaml`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          addToast({
            type: 'success',
            message: `Data product "${product.name}" exported as YAML`,
          });
          break;
        }
        case 'markdown': {
          const content = await odpsService.exportToMarkdown(product);
          const blob = new Blob([content], { type: 'text/markdown' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${product.name}.md`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          addToast({
            type: 'success',
            message: `Data product "${product.name}" exported as Markdown`,
          });
          break;
        }
        case 'pdf': {
          const pdfResult = await odpsService.exportToPDF(product);
          const pdfBytes = Uint8Array.from(atob(pdfResult.pdf_base64), (c) => c.charCodeAt(0));
          const blob = new Blob([pdfBytes], { type: 'application/pdf' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${product.name}.pdf`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          addToast({
            type: 'success',
            message: `Data product "${product.name}" exported as PDF`,
          });
          break;
        }
      }
    } catch (error) {
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to export data product',
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Only show import mode when creating (not editing)
  const showImportMode = !product;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={
        product ? 'Edit Data Product' : importMode ? 'Import Data Product' : 'Create Data Product'
      }
      size="lg"
    >
      <div className="space-y-4 max-h-[80vh] overflow-y-auto">
        {/* Mode Toggle - only show when creating (not editing) */}
        {showImportMode && (
          <div className="flex gap-2 border-b pb-3">
            <button
              type="button"
              onClick={() => {
                setImportMode(false);
                setImportYaml('');
                setImportFile(null);
              }}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded ${
                !importMode
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Create New
            </button>
            <button
              type="button"
              onClick={() => {
                setImportMode(true);
                setName('');
                setDescription('');
                setStatus('draft');
                setTeam('');
                setLinkedTables([]);
                setInputPorts([]);
                setOutputPorts([]);
                setSupport({});
                setImportFile(null);
              }}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded ${
                importMode
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Import
            </button>
          </div>
        )}

        {importMode && showImportMode ? (
          /* Import Mode */
          <div className="space-y-4">
            <div>
              <label htmlFor="import-file" className="block text-sm font-medium text-gray-700 mb-2">
                Load ODPS YAML File (Optional)
              </label>
              <input
                id="import-file"
                type="file"
                accept=".yaml,.yml"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setImportFile(file);
                  if (file) {
                    // Read file and populate textarea
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
              <label htmlFor="import-yaml" className="block text-sm font-medium text-gray-700 mb-2">
                Or Paste ODPS YAML Schema
              </label>
              <textarea
                id="import-yaml"
                value={importYaml}
                onChange={(e) => {
                  setImportYaml(e.target.value);
                  setImportFile(null); // Clear file selection when manually editing
                }}
                placeholder="Paste your ODPS YAML schema here..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                rows={15}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!importYaml.trim() && !importFile}
              >
                Import
              </button>
            </div>
          </div>
        ) : (
          /* Create/Edit Mode */
          <>
            {/* Basic Information */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Product name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Product description"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  value={status}
                  onChange={(e) =>
                    setStatus(e.target.value as 'draft' | 'published' | 'deprecated')
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="deprecated">Deprecated</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Team</label>
                <input
                  type="text"
                  value={team}
                  onChange={(e) => setTeam(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Team name"
                />
              </div>
            </div>

            {/* Linked Tables */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Linked Tables</label>
              <select
                multiple
                value={linkedTables}
                onChange={(e) =>
                  setLinkedTables(Array.from(e.target.selectedOptions, (option) => option.value))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                size={5}
              >
                {tables.map((table) => (
                  <option key={table.id} value={table.id}>
                    {table.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">Hold Ctrl/Cmd to select multiple tables</p>
            </div>

            {/* Input Ports */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">Input Ports</label>
                <button
                  onClick={handleAddInputPort}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  + Add Port
                </button>
              </div>
              <div className="space-y-2">
                {inputPorts.map((port, index) => (
                  <div key={index} className="flex gap-2 items-start">
                    <input
                      type="text"
                      value={port.name}
                      onChange={(e) => handleUpdateInputPort(index, { name: e.target.value })}
                      placeholder="Port name"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <select
                      value={port.table_id}
                      onChange={(e) => handleUpdateInputPort(index, { table_id: e.target.value })}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select table</option>
                      {tables.map((table) => (
                        <option key={table.id} value={table.id}>
                          {table.name}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleRemoveInputPort(index)}
                      className="text-red-600 hover:text-red-800"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Output Ports */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">Output Ports</label>
                <button
                  onClick={handleAddOutputPort}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  + Add Port
                </button>
              </div>
              <div className="space-y-2">
                {outputPorts.map((port, index) => (
                  <div key={index} className="flex gap-2 items-start">
                    <input
                      type="text"
                      value={port.name}
                      onChange={(e) => handleUpdateOutputPort(index, { name: e.target.value })}
                      placeholder="Port name"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <select
                      value={port.table_id}
                      onChange={(e) => handleUpdateOutputPort(index, { table_id: e.target.value })}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select table</option>
                      {tables.map((table) => (
                        <option key={table.id} value={table.id}>
                          {table.name}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleRemoveOutputPort(index)}
                      className="text-red-600 hover:text-red-800"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Support Information */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Support Information
              </label>
              <div className="space-y-2">
                <input
                  type="text"
                  value={support.team || ''}
                  onChange={(e) => setSupport({ ...support, team: e.target.value })}
                  placeholder="Support team"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  value={support.contact || ''}
                  onChange={(e) => setSupport({ ...support, contact: e.target.value })}
                  placeholder="Contact email"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  value={support.slack_channel || ''}
                  onChange={(e) => setSupport({ ...support, slack_channel: e.target.value })}
                  placeholder="Slack channel"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="url"
                  value={support.documentation_url || ''}
                  onChange={(e) => setSupport({ ...support, documentation_url: e.target.value })}
                  placeholder="Documentation URL"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-between pt-4 border-t border-gray-200">
              {/* Export Menu - only show when editing existing product */}
              {product && (
                <div className="relative">
                  <button
                    onClick={() => setShowExportMenu(!showExportMenu)}
                    disabled={isExporting}
                    className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 flex items-center gap-1"
                  >
                    {isExporting ? (
                      <>
                        <svg
                          className="animate-spin h-4 w-4"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                        Exporting...
                      </>
                    ) : (
                      <>
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                          />
                        </svg>
                        Export
                      </>
                    )}
                  </button>
                  {showExportMenu && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setShowExportMenu(false)}
                      />
                      <div className="absolute left-0 bottom-full mb-1 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-20">
                        <div className="py-1">
                          <button
                            onClick={() => handleExport('yaml')}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          >
                            ODPS YAML
                          </button>
                          <div className="border-t border-gray-100">
                            <div className="px-4 py-1 text-xs font-medium text-gray-500 uppercase">
                              Documentation
                            </div>
                            <button
                              onClick={() => handleExport('markdown')}
                              disabled={!sdkLoader.hasODPSExport()}
                              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Markdown (.md)
                            </button>
                            <button
                              onClick={() => handleExport('pdf')}
                              disabled={!sdkLoader.hasODPSExport()}
                              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              PDF Document
                            </button>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
              {!product && <div />}
              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                >
                  {product ? 'Update' : 'Create'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
};
