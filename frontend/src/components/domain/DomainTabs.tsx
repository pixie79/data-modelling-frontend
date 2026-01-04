/**
 * Domain Tabs Component
 * Displays domain-based canvas tabs for organizing large models
 */

import React, { useState } from 'react';
import { useModelStore } from '@/stores/modelStore';
import { useUIStore } from '@/stores/uiStore';
import { workspaceService } from '@/services/api/workspaceService';
import { useSDKModeStore } from '@/services/sdk/sdkMode';
import { HelpText } from '@/components/common/HelpText';
import { CreateDomainDialog } from './CreateDomainDialog';
import { MoveResourcesDialog } from './MoveResourcesDialog';
import { EditorModal } from '@/components/editors/EditorModal';
import { bpmnService } from '@/services/sdk/bpmnService';
import { getPlatform } from '@/services/platform/platform';
import { electronFileService as platformFileService } from '@/services/platform/electron';
import { electronFileService } from '@/services/storage/electronFileService';

export interface DomainTabsProps {
  workspaceId: string;
}

export const DomainTabs: React.FC<DomainTabsProps> = ({ workspaceId }) => {
  const { domains, selectedDomainId, setSelectedDomain, removeDomain, updateDomain, bpmnProcesses, updateBPMNProcess, tables, products, computeAssets, dmnDecisions, systems, relationships } = useModelStore();
  const { addToast } = useUIStore();
  const { mode } = useSDKModeStore();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showBPMNEditor, setShowBPMNEditor] = useState(false);
  const [editingProcessId, setEditingProcessId] = useState<string | null>(null);
  const [showSaveMenu, setShowSaveMenu] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showMoveResourcesDialog, setShowMoveResourcesDialog] = useState(false);

  const handleTabClick = (domainId: string) => {
    setSelectedDomain(domainId);
  };

  const handleDeleteDomain = async (domainId: string, domainName: string) => {
    // Prevent deleting the last domain
    if (domains.length <= 1) {
      addToast({
        type: 'error',
        message: 'Cannot delete the last domain. At least one domain is required.',
      });
      return;
    }

    // Check if this is the only domain (cannot delete last domain)
    if (domains.length === 1) {
      addToast({
        type: 'error',
        message: 'Cannot delete the last domain. Please create another domain first.',
      });
      return;
    }

    if (!window.confirm(`Are you sure you want to delete domain "${domainName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      if (mode === 'online') {
        await workspaceService.deleteDomain(domainName);
      }
      removeDomain(domainId);
      addToast({
        type: 'success',
        message: `Domain "${domainName}" deleted successfully`,
      });
    } catch (error) {
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to delete domain',
      });
    }
  };

  const handleLoadDomain = async () => {
    if (getPlatform() !== 'electron') {
      addToast({
        type: 'error',
        message: 'Load Domain is only available in Electron offline mode',
      });
      return;
    }

    setIsLoading(true);
    try {
      // Show folder selection dialog
      const result = await platformFileService.showOpenDialog({
        properties: ['openDirectory'],
        title: 'Select Domain Folder to Load',
      });

      if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
        setIsLoading(false);
        return;
      }

      const domainPath = result.filePaths[0];
      
      // Import validation utilities
      const { generateUUID, isValidUUID } = await import('@/utils/validation');
      
      // Load domain folder
      const domainData = await electronFileService.loadDomainFolder(domainPath);
      
      // Extract workspace path from domain path (parent directory)
      const pathParts = domainPath.split(/[/\\]/);
      const domainName = pathParts[pathParts.length - 1];
      const workspacePath = pathParts.slice(0, -1).join('/');
      
      // Check if domain with same name already exists
      const existingDomain = domains.find(d => d.name === (domainData.domain.name || domainName));
      
      let domain;
      if (existingDomain) {
        // Merge with existing domain - update it instead of creating new
        domain = {
          ...existingDomain,
          ...domainData.domain,
          id: existingDomain.id, // Keep existing ID
          name: domainData.domain.name || domainName || existingDomain.name,
          description: domainData.domain.description || existingDomain.description,
          last_modified_at: new Date().toISOString(),
          folder_path: domainPath,
          workspace_path: workspacePath,
        };
        updateDomain(existingDomain.id, domain);
        setSelectedDomain(existingDomain.id);
      } else {
        // Create new domain
        const loadedDomainId = domainData.domain.id && isValidUUID(domainData.domain.id) 
          ? domainData.domain.id 
          : generateUUID();
        domain = {
          id: loadedDomainId,
          workspace_id: workspaceId || '',
          name: domainData.domain.name || domainName || 'Loaded Domain',
          description: domainData.domain.description,
          model_type: domainData.domain.model_type || 'conceptual',
          is_primary: domainData.domain.is_primary || false,
          created_at: domainData.domain.created_at || new Date().toISOString(),
          last_modified_at: domainData.domain.last_modified_at || new Date().toISOString(),
          folder_path: domainPath,
          workspace_path: workspacePath,
        };
        useModelStore.getState().setDomains([...domains, domain]);
        setSelectedDomain(domain.id);
      }
      
      // Merge loaded assets with existing ones
      const modelStore = useModelStore.getState();
      
      if (domainData.tables.length > 0) {
        console.log(`[DomainTabs] Merging ${domainData.tables.length} table(s) into store`);
        const mergedTables = [...tables];
        domainData.tables.forEach(table => {
          const index = mergedTables.findIndex(t => t.id === table.id);
          if (index >= 0) {
            mergedTables[index] = { ...mergedTables[index], ...table, domain_id: domain.id, primary_domain_id: domain.id, workspace_id: workspaceId };
          } else {
            mergedTables.push({ ...table, domain_id: domain.id, primary_domain_id: domain.id, workspace_id: workspaceId });
          }
        });
        modelStore.setTables(mergedTables);
        console.log(`[DomainTabs] Total tables in store: ${mergedTables.length}`);
      }
      
      if (domainData.products.length > 0) {
        console.log(`[DomainTabs] Merging ${domainData.products.length} product(s) into store`);
        const mergedProducts = [...products];
        domainData.products.forEach(product => {
          const index = mergedProducts.findIndex(p => p.id === product.id);
          if (index >= 0) {
            mergedProducts[index] = { ...mergedProducts[index], ...product, domain_id: domain.id, workspace_id: workspaceId };
          } else {
            mergedProducts.push({ ...product, domain_id: domain.id, workspace_id: workspaceId });
          }
        });
        modelStore.setProducts(mergedProducts);
        console.log(`[DomainTabs] Total products in store: ${mergedProducts.length}`);
      }
      
      if (domainData.assets.length > 0) {
        console.log(`[DomainTabs] Merging ${domainData.assets.length} asset(s) into store`);
        const mergedAssets = [...computeAssets];
        domainData.assets.forEach(asset => {
          const index = mergedAssets.findIndex(a => a.id === asset.id);
          if (index >= 0) {
            mergedAssets[index] = { ...mergedAssets[index], ...asset, domain_id: domain.id, workspace_id: workspaceId };
          } else {
            mergedAssets.push({ ...asset, domain_id: domain.id, workspace_id: workspaceId });
          }
        });
        modelStore.setComputeAssets(mergedAssets);
        console.log(`[DomainTabs] Total assets in store: ${mergedAssets.length}`);
      }
      
      if (domainData.bpmnProcesses.length > 0) {
        console.log(`[DomainTabs] Merging ${domainData.bpmnProcesses.length} BPMN process(es) into store`);
        const mergedProcesses = [...bpmnProcesses];
        domainData.bpmnProcesses.forEach(process => {
          const index = mergedProcesses.findIndex(p => p.id === process.id);
          if (index >= 0) {
            mergedProcesses[index] = { ...mergedProcesses[index], ...process, domain_id: domain.id, workspace_id: workspaceId };
          } else {
            mergedProcesses.push({ ...process, domain_id: domain.id, workspace_id: workspaceId });
          }
        });
        modelStore.setBPMNProcesses(mergedProcesses);
        console.log(`[DomainTabs] Total BPMN processes in store: ${mergedProcesses.length}`);
      }
      
      if (domainData.dmnDecisions.length > 0) {
        console.log(`[DomainTabs] Merging ${domainData.dmnDecisions.length} DMN decision(s) into store`);
        const mergedDecisions = [...dmnDecisions];
        domainData.dmnDecisions.forEach(decision => {
          const index = mergedDecisions.findIndex(d => d.id === decision.id);
          if (index >= 0) {
            mergedDecisions[index] = { ...mergedDecisions[index], ...decision, domain_id: domain.id, workspace_id: workspaceId };
          } else {
            mergedDecisions.push({ ...decision, domain_id: domain.id, workspace_id: workspaceId });
          }
        });
        modelStore.setDMNDecisions(mergedDecisions);
        console.log(`[DomainTabs] Total DMN decisions in store: ${mergedDecisions.length}`);
      }
      
      // Merge systems and relationships
      if (domainData.systems.length > 0) {
        console.log(`[DomainTabs] Merging ${domainData.systems.length} system(s) into store`);
        const mergedSystems = [...systems];
        domainData.systems.forEach(system => {
          const index = mergedSystems.findIndex(s => s.id === system.id);
          if (index >= 0) {
            mergedSystems[index] = { ...mergedSystems[index], ...system, domain_id: domain.id, workspace_id: workspaceId };
          } else {
            mergedSystems.push({ ...system, domain_id: domain.id, workspace_id: workspaceId });
          }
        });
        modelStore.setSystems(mergedSystems);
        console.log(`[DomainTabs] Total systems in store: ${mergedSystems.length}`);
      }
      
      if (domainData.relationships.length > 0) {
        console.log(`[DomainTabs] Merging ${domainData.relationships.length} relationship(s) into store`);
        const mergedRelationships = [...relationships];
        domainData.relationships.forEach(relationship => {
          const index = mergedRelationships.findIndex(r => r.id === relationship.id);
          if (index >= 0) {
            mergedRelationships[index] = { ...mergedRelationships[index], ...relationship, domain_id: domain.id, workspace_id: workspaceId };
          } else {
            mergedRelationships.push({ ...relationship, domain_id: domain.id, workspace_id: workspaceId });
          }
        });
        modelStore.setRelationships(mergedRelationships);
        console.log(`[DomainTabs] Total relationships in store: ${mergedRelationships.length}`);
      }
      
      // Also ensure workspace_id is set on all other loaded assets
      if (domainData.tables.length > 0) {
        console.log(`[DomainTabs] Merging ${domainData.tables.length} table(s) into store`);
      }
      if (domainData.assets.length > 0) {
        console.log(`[DomainTabs] Merging ${domainData.assets.length} asset(s) into store`);
      }
      
      addToast({
        type: 'success',
        message: existingDomain 
          ? `Merged domain "${domain.name}" with existing domain` 
          : `Loaded domain: ${domain.name}`,
      });
    } catch (err) {
      console.error('Failed to load domain:', err);
      addToast({
        type: 'error',
        message: `Failed to load domain: ${err instanceof Error ? err.message : 'Unknown error'}`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveDomain = async (domainId?: string) => {
    if (getPlatform() !== 'electron') {
      addToast({
        type: 'error',
        message: 'Save Domain is only available in Electron offline mode',
      });
      return;
    }

    const targetDomainId = domainId || selectedDomainId;
    if (!targetDomainId || !workspaceId) {
      addToast({
        type: 'error',
        message: 'Please select a domain and workspace first',
      });
      return;
    }

    setIsSaving(true);
    setShowSaveMenu(false);

    try {
      const domain = domains.find((d) => d.id === targetDomainId);
      
      if (!domain) {
        addToast({
          type: 'error',
          message: 'Domain not found',
        });
        return;
      }

      // Show folder selection dialog
      const result = await platformFileService.showOpenDialog({
        properties: ['openDirectory'],
        title: 'Select Domain Folder to Save',
      });

      if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
        setIsSaving(false);
        return;
      }

      const selectedPath = result.filePaths[0];
      
      // Get all domain assets
      const domainTables = tables.filter((t) => t.domain_id === targetDomainId || t.primary_domain_id === targetDomainId);
      const domainProducts = products.filter((p) => p.domain_id === targetDomainId);
      const domainAssets = computeAssets.filter((a) => a.domain_id === targetDomainId);
      const domainBpmnProcesses = bpmnProcesses.filter((p) => p.domain_id === targetDomainId);
      const domainDmnDecisions = dmnDecisions.filter((d) => d.domain_id === targetDomainId);
      const domainSystems = systems.filter((s) => s.domain_id === targetDomainId);
      const domainRelationships = relationships.filter((r) => r.domain_id === targetDomainId);
      
      // Convert domain to DomainType format
      const domainType = {
        id: domain.id,
        workspace_id: domain.workspace_id || '',
        name: domain.name,
        description: domain.description,
        owner: domain.owner,
        model_type: domain.model_type,
        is_primary: domain.is_primary,
        created_at: domain.created_at,
        last_modified_at: domain.last_modified_at,
      } as any;
      
      // Determine workspace path and domain path
      // If user selects a folder that ends with domain name, use parent as workspace
      // Otherwise, use selected path as workspace (will create subfolder)
      const pathParts = selectedPath.split(/[/\\]/).filter(Boolean);
      const lastPart = pathParts[pathParts.length - 1];
      const workspacePath = (lastPart === domain.name && pathParts.length > 1)
        ? pathParts.slice(0, -1).join('/')
        : selectedPath;
      
      const domainPath = (lastPart === domain.name && pathParts.length > 1)
        ? selectedPath
        : `${selectedPath}/${domain.name}`;
      
      // Save domain folder (saveDomainFolder expects domainPath, not workspacePath)
      await electronFileService.saveDomainFolder(
        domainPath,
        domainType,
        domainTables,
        domainProducts,
        domainAssets,
        domainBpmnProcesses,
        domainDmnDecisions,
        domainSystems,
        domainRelationships
      );
      
      // Update domain with folder paths
      updateDomain(domain.id, {
        workspace_path: workspacePath,
        folder_path: domainPath,
      });
      
      addToast({
        type: 'success',
        message: `Saved domain: ${domain.name}`,
      });
    } catch (err) {
      console.error('Failed to save domain:', err);
      addToast({
        type: 'error',
        message: `Failed to save domain: ${err instanceof Error ? err.message : 'Unknown error'}`,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoadWorkspace = async () => {
    if (getPlatform() !== 'electron') {
      addToast({
        type: 'error',
        message: 'Load Workspace is only available in Electron offline mode',
      });
      return;
    }

    setIsLoading(true);
    try {
      // Show folder selection dialog for workspace root
      const result = await platformFileService.showOpenDialog({
        properties: ['openDirectory'],
        title: 'Select Workspace Folder to Load',
      });

      if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
        setIsLoading(false);
        return;
      }

      const workspacePath = result.filePaths[0];
      
      // Import validation utilities
      const { generateUUID, isValidUUID } = await import('@/utils/validation');
      
      // For now, we'll require the user to manually select domain folders
      // In the future, we could add directory listing to automatically find all domain folders
      // For now, show a message that they should use "Load Domain" for each domain folder
      addToast({
        type: 'info',
        message: 'Please use "Load Domain" to load individual domain folders. Workspace auto-detection coming soon.',
      });
      
      setIsLoading(false);
    } catch (err) {
      console.error('Failed to load workspace:', err);
      addToast({
        type: 'error',
        message: `Failed to load workspace: ${err instanceof Error ? err.message : 'Unknown error'}`,
      });
      setIsLoading(false);
    }
  };

  const handleSaveAllDomains = async () => {
    if (getPlatform() !== 'electron') {
      addToast({
        type: 'error',
        message: 'Save All Domains is only available in Electron offline mode',
      });
      return;
    }

    if (!workspaceId) {
      addToast({
        type: 'error',
        message: 'Workspace ID is required',
      });
      return;
    }

    setIsSaving(true);
    setShowSaveMenu(false);

    try {
      // Show folder selection dialog for workspace root
      const result = await platformFileService.showOpenDialog({
        properties: ['openDirectory'],
        title: 'Select Workspace Folder to Save All Domains',
      });

      if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
        setIsSaving(false);
        return;
      }

      const workspacePath = result.filePaths[0];
      
      // Save each domain to its own subfolder
      for (const domain of domains) {
        const domainPath = `${workspacePath}/${domain.name}`;
        
        // Get all domain assets
        const domainTables = tables.filter((t) => t.domain_id === domain.id || t.primary_domain_id === domain.id);
        const domainProducts = products.filter((p) => p.domain_id === domain.id);
        const domainAssets = computeAssets.filter((a) => a.domain_id === domain.id);
        const domainBpmnProcesses = bpmnProcesses.filter((p) => p.domain_id === domain.id);
        const domainDmnDecisions = dmnDecisions.filter((d) => d.domain_id === domain.id);
        const domainSystems = systems.filter((s) => s.domain_id === domain.id);
        const domainRelationships = relationships.filter((r) => r.domain_id === domain.id);
        
        // Convert domain to DomainType format
        const domainType = {
          id: domain.id,
          workspace_id: domain.workspace_id || '',
          name: domain.name,
          description: domain.description,
          owner: domain.owner,
          model_type: domain.model_type,
          is_primary: domain.is_primary,
          created_at: domain.created_at,
          last_modified_at: domain.last_modified_at,
        } as any;
        
        // Save domain folder
        await electronFileService.saveDomainFolder(
          domainPath,
          domainType,
          domainTables,
          domainProducts,
          domainAssets,
          domainBpmnProcesses,
          domainDmnDecisions,
          domainSystems,
          domainRelationships
        );
        
        // Update domain with folder paths
        useModelStore.getState().updateDomain(domain.id, {
          workspace_path: workspacePath,
          folder_path: domainPath,
        });
      }
      
      addToast({
        type: 'success',
        message: `Saved all ${domains.length} domain(s)`,
      });
    } catch (err) {
      console.error('Failed to save all domains:', err);
      addToast({
        type: 'error',
        message: `Failed to save all domains: ${err instanceof Error ? err.message : 'Unknown error'}`,
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!domains || domains.length === 0) {
    return (
      <div className="flex items-center justify-center p-4 text-gray-500">
        <p>No domains available. Create a domain to get started.</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center border-b border-gray-200 bg-white" role="tablist" aria-label="Domain tabs">
        {domains.map((domain) => {
          const isSelected = selectedDomainId === domain.id;
          return (
            <div key={domain.id} className="flex items-center group">
              <button
                onClick={() => handleTabClick(domain.id)}
                role="tab"
                aria-selected={isSelected}
                aria-controls={`domain-panel-${domain.id}`}
                id={`domain-tab-${domain.id}`}
                className={`
                  px-4 py-2 text-sm font-medium border-b-2 transition-colors
                  ${isSelected
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                  }
                `}
              >
                <div className="flex items-center gap-2">
                  <span>{domain.name}</span>
                </div>
              </button>
              {domains.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteDomain(domain.id, domain.name);
                  }}
                  className="ml-1 px-2 py-1 text-xs text-red-600 hover:text-red-800 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label={`Delete domain ${domain.name}`}
                  title={`Delete domain ${domain.name}`}
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
        <button
          onClick={() => setShowCreateDialog(true)}
          className="ml-2 px-3 py-1 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded border border-blue-200"
          aria-label="Create new domain"
        >
          + Add Domain
        </button>
        
        {/* Move Resources button */}
        {selectedDomainId && (
          <button
            onClick={() => setShowMoveResourcesDialog(true)}
            className="ml-2 px-3 py-1 text-sm font-medium text-purple-700 bg-purple-50 rounded hover:bg-purple-100 transition-colors border border-purple-200"
            aria-label="Move Resources"
            title="Move tables, compute assets, or systems between systems and domains"
          >
            Move Resources
          </button>
        )}
        
        {/* Save/Load Domain buttons - only in offline mode */}
        {mode === 'offline' && getPlatform() === 'electron' && (
          <div className="ml-2 flex items-center gap-2">
            <button
              onClick={handleLoadDomain}
              disabled={isLoading}
              className="px-3 py-1 text-sm font-medium text-blue-700 bg-blue-50 rounded hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-blue-200"
              aria-label="Load Domain"
              title="Load domain from disk"
            >
              {isLoading ? 'Loading...' : 'Load Domain'}
            </button>
            <div className="relative">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleSaveDomain()}
                  disabled={isSaving || !selectedDomainId}
                  className="px-3 py-1 text-sm font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Save Domain"
                  title="Save current domain"
                >
                  {isSaving ? 'Saving...' : 'Save Domain'}
                </button>
                {domains.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowSaveMenu(!showSaveMenu);
                    }}
                    disabled={isSaving}
                    className="px-2 py-1 text-sm font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Save options"
                    title="Save options"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                )}
              </div>
              
              {/* Dropdown menu for save options */}
              {showSaveMenu && domains.length > 1 && (
                <>
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setShowSaveMenu(false)}
                  />
                  <div className="absolute right-0 mt-1 w-56 bg-white rounded-md shadow-lg border border-gray-200 z-20">
                    <button
                      onClick={() => handleSaveDomain()}
                      disabled={isSaving || !selectedDomainId}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Save Current Domain ({domains.find((d) => d.id === selectedDomainId)?.name || 'None'})
                    </button>
                    <button
                      onClick={handleSaveAllDomains}
                      disabled={isSaving}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 border-t border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Save All Domains ({domains.length})
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
        
        <div className="ml-auto px-4">
          <HelpText
            text="Business domains organize your model into separate canvases. Tables can appear on multiple domains but are only editable on their primary domain."
            title="About Business Domains"
          />
        </div>
      </div>
      
      {/* BPMN Process Links */}
      {selectedDomainId && bpmnProcesses.length > 0 && (
        <div className="bg-gray-50 border-b border-gray-200 px-4 py-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-gray-600">BPMN Processes:</span>
            {bpmnProcesses
              .filter((p) => p.domain_id === selectedDomainId)
              .map((process) => (
                <button
                  key={process.id}
                  onClick={() => {
                    setEditingProcessId(process.id);
                    setShowBPMNEditor(true);
                  }}
                  className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                  title={`Edit ${process.name}`}
                >
                  {process.name}
                </button>
              ))}
          </div>
        </div>
      )}
      
      <CreateDomainDialog
        isOpen={showCreateDialog}
        onClose={() => {
          setShowCreateDialog(false);
        }}
        onCreated={(domainId) => {
          setSelectedDomain(domainId);
          setShowCreateDialog(false);
        }}
        workspaceId={workspaceId}
      />
      
      {/* BPMN Editor Modal */}
      {editingProcessId && (
        <EditorModal
          type="bpmn"
          isOpen={showBPMNEditor}
          onClose={() => {
            setShowBPMNEditor(false);
            setEditingProcessId(null);
          }}
          title={`Edit BPMN Process: ${bpmnProcesses.find((p) => p.id === editingProcessId)?.name || ''}`}
          size="full"
          bpmnProps={{
            xml: bpmnProcesses.find((p) => p.id === editingProcessId)?.bpmn_xml,
            name: bpmnProcesses.find((p) => p.id === editingProcessId)?.name,
            onSave: async (xml: string, name: string) => {
              try {
                const process = await bpmnService.parseXML(xml);
                updateBPMNProcess(editingProcessId, { ...process, id: editingProcessId, name: name.trim() || process.name || 'Untitled Process' });
                addToast({
                  type: 'success',
                  message: 'BPMN process saved successfully',
                });
                setShowBPMNEditor(false);
                setEditingProcessId(null);
              } catch (error) {
                addToast({
                  type: 'error',
                  message: error instanceof Error ? error.message : 'Failed to save BPMN process',
                });
              }
            },
          }}
        />
      )}

      {/* Move Resources Dialog */}
      {selectedDomainId && (
        <MoveResourcesDialog
          isOpen={showMoveResourcesDialog}
          onClose={() => setShowMoveResourcesDialog(false)}
          domainId={selectedDomainId}
        />
      )}
    </>
  );
};

