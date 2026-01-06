/**
 * Create Domain Dialog Component
 * Allows creating a new domain (canvas tab)
 */

import React, { useState } from 'react';
import { DraggableModal } from '@/components/common/DraggableModal';
import { useModelStore } from '@/stores/modelStore';
import { useUIStore } from '@/stores/uiStore';
import { workspaceService } from '@/services/api/workspaceService';
import { useSDKModeStore } from '@/services/sdk/sdkMode';
import { getPlatform } from '@/services/platform/platform';
import { electronFileService as platformFileService } from '@/services/platform/electron';
import { electronFileService } from '@/services/storage/electronFileService';

export interface CreateDomainDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (domainId: string) => void;
  workspaceId?: string;
}

export const CreateDomainDialog: React.FC<CreateDomainDialogProps> = ({
  isOpen,
  onClose,
  onCreated,
  workspaceId,
}) => {
  const {
    addDomain,
    domains,
    setDomains,
    setSelectedDomain,
    setTables,
    setProducts,
    setComputeAssets,
    setBPMNProcesses,
    setDMNDecisions,
  } = useModelStore();
  const { addToast } = useUIStore();
  const { mode } = useSDKModeStore();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importMode, setImportMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLoadDomain = async () => {
    if (getPlatform() !== 'electron') {
      addToast({
        type: 'error',
        message: 'Load Domain is only available in Electron offline mode',
      });
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Import validation utilities
      const { generateUUID, isValidUUID } = await import('@/utils/validation');

      // Show folder selection dialog
      const result = await platformFileService.showOpenDialog({
        properties: ['openDirectory'],
        title: 'Select Domain Folder',
      });

      if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
        setIsLoading(false);
        return;
      }

      const domainPath = result.filePaths[0];
      if (!domainPath) {
        setIsLoading(false);
        return;
      }

      // Load domain folder
      const domainData = await electronFileService.loadDomainFolder(domainPath);

      // Extract workspace path from domain path (parent directory)
      const pathParts = domainPath.split(/[/\\]/);
      const domainName = pathParts[pathParts.length - 1];
      const workspacePath = pathParts.slice(0, -1).join('/');

      // Convert domain to Domain format expected by store
      // Ensure domain ID is a valid UUID
      const domain = {
        id:
          domainData.domain.id && isValidUUID(domainData.domain.id)
            ? domainData.domain.id
            : generateUUID(),
        workspace_id: workspaceId || '',
        name: domainData.domain.name || domainName || 'Loaded Domain',
        description: domainData.domain.description,
        created_at: domainData.domain.created_at || new Date().toISOString(),
        last_modified_at: domainData.domain.last_modified_at || new Date().toISOString(),
        folder_path: domainPath, // Store the domain folder path
        workspace_path: workspacePath, // Store the workspace root path
      };

      // Check if domain name already exists
      if (domains.some((d) => d.name.toLowerCase() === domain.name.toLowerCase())) {
        setError('A domain with this name already exists.');
        setIsLoading(false);
        return;
      }

      // Update model store with loaded data
      setDomains([...domains, domain]);
      setSelectedDomain(domain.id);
      setTables(domainData.tables);
      setProducts(domainData.products);
      setComputeAssets(domainData.assets);
      setBPMNProcesses(domainData.bpmnProcesses);
      setDMNDecisions(domainData.dmnDecisions);

      addToast({
        type: 'success',
        message: `Loaded domain: ${domain.name}`,
      });
      onCreated(domain.id);
      onClose();
      setImportMode(false);
    } catch (err) {
      console.error('Failed to load domain:', err);
      setError(err instanceof Error ? err.message : 'Failed to load domain.');
      addToast({
        type: 'error',
        message: `Failed to load domain: ${err instanceof Error ? err.message : 'Unknown error'}`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    setError(null);

    if (!name.trim()) {
      setError('Domain name is required.');
      return;
    }

    // Check if domain name already exists
    if (domains.some((d) => d.name.toLowerCase() === name.trim().toLowerCase())) {
      setError('A domain with this name already exists.');
      return;
    }

    setIsCreating(true);
    try {
      // Import generateUUID to ensure valid UUID format
      const { generateUUID } = await import('@/utils/validation');
      const domainId = generateUUID();
      const currentWorkspaceId =
        workspaceId || useModelStore.getState().tables[0]?.workspace_id || 'offline-workspace';

      if (mode === 'online') {
        // Create domain via API
        await workspaceService.createDomain(name.trim());
      }

      // Add domain to store (business domain, not model-type domain)
      const newDomain = {
        id: domainId,
        workspace_id: currentWorkspaceId,
        name: name.trim(),
        description: description.trim() || undefined,
        created_at: new Date().toISOString(),
        last_modified_at: new Date().toISOString(),
      };

      addDomain(newDomain);
      addToast({
        type: 'success',
        message: `Domain '${name.trim()}' created successfully!`,
      });
      onCreated(domainId);
      onClose();
      setName('');
      setDescription('');
      setImportMode(false);
    } catch (err) {
      console.error('Failed to create domain:', err);
      setError(err instanceof Error ? err.message : 'Failed to create domain.');
      addToast({
        type: 'error',
        message: `Failed to create domain: ${err instanceof Error ? err.message : 'Unknown error'}`,
      });
    } finally {
      setIsCreating(false);
    }
  };

  const isOffline = mode === 'offline';
  const showImportOption = isOffline && getPlatform() === 'electron';

  return (
    <DraggableModal
      isOpen={isOpen}
      onClose={onClose}
      title={importMode ? 'Import Domain from Folder' : 'Create New Domain'}
      size="sm"
    >
      <div className="p-4 space-y-4">
        {error && (
          <div
            className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative"
            role="alert"
          >
            <strong className="font-bold">Error:</strong>
            <span className="block sm:inline"> {error}</span>
          </div>
        )}

        {/* Mode Toggle - only show in offline mode */}
        {showImportOption && (
          <div className="flex gap-2 border-b pb-3">
            <button
              type="button"
              onClick={() => {
                setImportMode(false);
                setError(null);
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
                setError(null);
              }}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded ${
                importMode
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Import from Folder
            </button>
          </div>
        )}

        {importMode ? (
          /* Import Mode */
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Select a folder containing domain files (domain.yaml, tables, products, etc.)
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleLoadDomain}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isLoading}
              >
                {isLoading ? 'Loading...' : 'Select Folder'}
              </button>
            </div>
          </div>
        ) : (
          /* Create Mode */
          <>
            <div>
              <label htmlFor="domain-name" className="block text-sm font-medium text-gray-700 mb-2">
                Domain Name *
              </label>
              <input
                id="domain-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Customer Domain"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isCreating && name.trim()) {
                    handleCreate();
                  }
                }}
              />
            </div>
            <div>
              <label
                htmlFor="domain-description"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Description (Optional)
              </label>
              <textarea
                id="domain-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., Customer service domain for managing customer data"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
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
                {isCreating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </>
        )}
      </div>
    </DraggableModal>
  );
};
