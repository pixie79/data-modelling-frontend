/**
 * Create Node Dialog
 * Dialog for creating a new CADS node (AI/ML/App) manually or importing from CADS YAML
 */

import React, { useState, useEffect } from 'react';
import { DraggableModal } from '@/components/common/DraggableModal';
import { useModelStore } from '@/stores/modelStore';
import { useUIStore } from '@/stores/uiStore';
import { cadsService } from '@/services/sdk/cadsService';
import type { ComputeAsset } from '@/types/cads';

export interface CreateNodeDialogProps {
  domainId: string;
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (nodeId: string) => void;
}

export const CreateNodeDialog: React.FC<CreateNodeDialogProps> = ({
  domainId,
  isOpen,
  onClose,
  onCreated,
}) => {
  const { addComputeAsset, selectedSystemId, systems, updateSystem } = useModelStore();
  const { addToast } = useUIStore();
  const [isCreating, setIsCreating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importMode, setImportMode] = useState(false);
  const [importYaml, setImportYaml] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<'ai' | 'ml' | 'app'>('app');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      setImportMode(false);
      setImportYaml('');
      setImportFile(null);
      setName('');
      setType('app');
      setDescription('');
      setError(null);
    }
  }, [isOpen]);

  const handleImport = async () => {
    if (!importYaml.trim() && !importFile) {
      addToast({
        type: 'error',
        message: 'Please paste CADS YAML content or select a file',
      });
      return;
    }

    setIsImporting(true);
    setError(null);

    try {
      const content = importYaml.trim() || (importFile ? await importFile.text() : '');
      const asset = await cadsService.parseYAML(content);

      // Get canvas center position for new asset
      const centerX = window.innerWidth / 2 - 200;
      const centerY = window.innerHeight / 2 - 150;

      // Ensure required fields are set
      const importedAsset: ComputeAsset = {
        ...asset,
        id: asset.id || crypto.randomUUID(),
        domain_id: domainId,
        name: asset.name || 'Untitled Asset',
        position_x: asset.position_x ?? centerX,
        position_y: asset.position_y ?? centerY,
        width: asset.width ?? 200,
        height: asset.height ?? 150,
        created_at: asset.created_at || new Date().toISOString(),
        last_modified_at: new Date().toISOString(),
      };

      addComputeAsset(importedAsset);

      // If a system is selected, add the asset to that system
      if (selectedSystemId) {
        const selectedSystem = systems.find((s) => s.id === selectedSystemId);
        if (selectedSystem) {
          const updatedAssetIds = [...(selectedSystem.asset_ids || []), importedAsset.id];
          const uniqueAssetIds = Array.from(new Set(updatedAssetIds));
          updateSystem(selectedSystemId, { asset_ids: uniqueAssetIds });
        }
      }

      addToast({
        type: 'success',
        message: `Successfully imported CADS asset: ${importedAsset.name}`,
      });

      // Call onCreated callback if provided
      if (onCreated) {
        onCreated(importedAsset.id);
      }

      // Reset form
      setImportYaml('');
      setImportFile(null);
      setError(null);

      // Small delay to ensure store updates propagate before closing
      await new Promise((resolve) => setTimeout(resolve, 100));

      onClose();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to import CADS asset';
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
      setError('Asset name is required');
      return;
    }

    setIsCreating(true);
    try {
      // Get canvas center position for new asset
      const centerX = window.innerWidth / 2 - 200;
      const centerY = window.innerHeight / 2 - 150;

      // Always use UUIDs for compute asset IDs
      const { generateUUID } = await import('@/utils/validation');
      const asset: ComputeAsset = {
        id: generateUUID(),
        domain_id: domainId,
        name: name.trim(),
        type,
        description: description.trim() || undefined,
        status: 'development',
        position_x: centerX,
        position_y: centerY,
        width: 200,
        height: 150,
        created_at: new Date().toISOString(),
        last_modified_at: new Date().toISOString(),
      };

      addComputeAsset(asset);

      // If a system is selected, add the asset to that system
      if (selectedSystemId) {
        const selectedSystem = systems.find((s) => s.id === selectedSystemId);
        if (selectedSystem) {
          const updatedAssetIds = [...(selectedSystem.asset_ids || []), asset.id];
          const uniqueAssetIds = Array.from(new Set(updatedAssetIds));
          updateSystem(selectedSystemId, { asset_ids: uniqueAssetIds });
        }
      }

      addToast({
        type: 'success',
        message: `Compute asset "${asset.name}" created successfully`,
      });

      // Reset form
      setName('');
      setType('app');
      setDescription('');
      setError(null);

      // Call onCreated callback if provided
      if (onCreated) {
        onCreated(asset.id);
      }

      // Small delay to ensure store updates propagate before closing
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Close dialog
      onClose();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create compute asset';
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
      title={importMode ? 'Import Node' : 'Create New Node'}
      size="lg"
      initialPosition={{
        x: window.innerWidth / 2 - 400,
        y: window.innerHeight / 2 - 300,
      }}
    >
      <div className="space-y-4 max-h-[80vh] overflow-y-auto">
        {/* Mode Toggle */}
        <div className="flex gap-2 border-b pb-3">
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
              setType('app');
              setDescription('');
              setError(null);
            }}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded ${
              importMode ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Import
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {importMode ? (
          /* Import Mode */
          <div className="space-y-4">
            <div>
              <label htmlFor="import-file" className="block text-sm font-medium text-gray-700 mb-2">
                Load CADS YAML File (Optional)
              </label>
              <input
                id="import-file"
                type="file"
                accept=".yaml,.yml"
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
              <label htmlFor="import-yaml" className="block text-sm font-medium text-gray-700 mb-2">
                Or Paste CADS YAML Content
              </label>
              <textarea
                id="import-yaml"
                value={importYaml}
                onChange={(e) => {
                  setImportYaml(e.target.value);
                  setImportFile(null);
                }}
                placeholder="Paste your CADS YAML schema here..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                rows={15}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
                disabled={isImporting}
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isImporting || (!importYaml.trim() && !importFile)}
              >
                {isImporting ? 'Importing...' : 'Import'}
              </button>
            </div>
          </div>
        ) : (
          /* Create Mode */
          <>
            <div>
              <label htmlFor="node-name" className="block text-sm font-medium text-gray-700 mb-2">
                Node Name *
              </label>
              <input
                id="node-name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError(null);
                }}
                onKeyDown={handleKeyDown}
                placeholder="e.g., Customer ML Model, Order Processing App"
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  error ? 'border-red-500' : 'border-gray-300'
                }`}
                disabled={isCreating}
              />
            </div>

            <div>
              <label htmlFor="node-type" className="block text-sm font-medium text-gray-700 mb-2">
                Node Type *
              </label>
              <select
                id="node-type"
                value={type}
                onChange={(e) => setType(e.target.value as 'ai' | 'ml' | 'app')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isCreating}
              >
                <option value="ai">AI Model</option>
                <option value="ml">ML Pipeline</option>
                <option value="app">Application</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="node-description"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Description (Optional)
              </label>
              <textarea
                id="node-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Describe the purpose and functionality of this node"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                disabled={isCreating}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
                disabled={isCreating}
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isCreating || !name.trim()}
              >
                {isCreating ? 'Creating...' : 'Create Node'}
              </button>
            </div>
          </>
        )}
      </div>
    </DraggableModal>
  );
};
