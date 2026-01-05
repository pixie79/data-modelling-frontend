/**
 * Model Editor Page
 * Main page for editing data models with infinite canvas
 */

import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { DomainCanvas } from '@/components/canvas/DomainCanvas';
import { DomainTabs } from '@/components/domain/DomainTabs';
import { DomainSelector } from '@/components/domain/DomainSelector';
import { ViewSelector } from '@/components/domain/ViewSelector';
import { EditorModal } from '@/components/editors/EditorModal';
import { bpmnService } from '@/services/sdk/bpmnService';
import { TableEditor } from '@/components/table/TableEditor';
import { TableProperties } from '@/components/table/TableProperties';
import { CreateTableDialog } from '@/components/table/CreateTableDialog';
import { CreateSystemDialog } from '@/components/system/CreateSystemDialog';
import { DraggableModal } from '@/components/common/DraggableModal';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useModelStore } from '@/stores/modelStore';
import { workspaceService } from '@/services/api/workspaceService';
import { Loading } from '@/components/common/Loading';
import { useSDKModeStore } from '@/services/sdk/sdkMode';
import { useUIStore } from '@/stores/uiStore';
import { useCollaboration } from '@/hooks/useCollaboration';
import { PresenceIndicator } from '@/components/collaboration/PresenceIndicator';
import { CollaborationStatus } from '@/components/collaboration/CollaborationStatus';
import { ConflictResolver } from '@/components/collaboration/ConflictResolver';
import { useCollaborationStore } from '@/stores/collaborationStore';
import { WorkspaceSettings } from '@/components/workspace/WorkspaceSettings';
import { VersionHistory } from '@/components/workspace/VersionHistory';
import { ImportExportDialog } from '@/components/common/ImportExportDialog';
import { ModelNavbar } from '@/components/navbar/ModelNavbar';
import { electronFileService } from '@/services/storage/electronFileService';
import { getPlatform } from '@/services/platform/platform';
import { electronFileService as platformFileService } from '@/services/platform/electron';

const ModelEditor: React.FC = () => {
  const { workspaceId, domainId } = useParams<{ workspaceId: string; domainId?: string }>();
  const { fetchWorkspace, workspaces, setCurrentWorkspace } = useWorkspaceStore();
  const {
    selectedDomainId,
    selectedTableId,
    fetchTables,
    fetchRelationships,
    loadDomainAssets,
    setSelectedDomain,
    setSelectedTable,
    setTables,
    setRelationships,
    setDomains,
    setSystems,
    setProducts,
    setComputeAssets,
    setBPMNProcesses,
    setDMNDecisions,
  } = useModelStore();
  const { addToast } = useUIStore();
  const { mode } = useSDKModeStore();
  const { conflicts } = useCollaborationStore();

  const [isLoading, setIsLoading] = useState(true);
  const [showTableEditor, setShowTableEditor] = useState(false);
  const [showTableProperties, setShowTableProperties] = useState(false);
  const [showConflictResolver, setShowConflictResolver] = useState(false);
  const [showWorkspaceSettings, setShowWorkspaceSettings] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showImportExportDialog, setShowImportExportDialog] = useState(false);
  const [showCreateTableDialog, setShowCreateTableDialog] = useState(false);
  const [showCreateSystemDialog, setShowCreateSystemDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Load Domain handler for offline mode
  const handleLoadDomain = async () => {
    if (getPlatform() !== 'electron') {
      addToast({
        type: 'error',
        message: 'Load Domain is only available in Electron offline mode',
      });
      return;
    }

    try {
      // Show folder selection dialog
      const result = await platformFileService.showOpenDialog({
        properties: ['openDirectory'],
        title: 'Select Domain Folder',
      });

      if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
        return;
      }

      const domainPath = result.filePaths[0];
      
      // Import validation utilities
      const { generateUUID, isValidUUID } = await import('@/utils/validation');
      
      // Load domain folder
      const domainData = await electronFileService.loadDomainFolder(domainPath);
      
      // Update model store with loaded data
      const modelStore = useModelStore.getState();
      
      // Extract workspace path from domain path (parent directory)
      const pathParts = domainPath.split(/[/\\]/);
      const domainName = pathParts[pathParts.length - 1];
      const workspacePath = pathParts.slice(0, -1).join('/');
      
      // Convert domain to Domain format expected by store
      // Ensure domain ID is a valid UUID
      const loadedDomainId = domainData.domain.id && isValidUUID(domainData.domain.id) 
        ? domainData.domain.id 
        : generateUUID();
      
      // Check if domain with same name already exists
      const existingDomain = modelStore.domains.find(d => d.name === (domainData.domain.name || domainName));
      
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
        modelStore.updateDomain(existingDomain.id, domain);
        modelStore.setSelectedDomain(existingDomain.id);
      } else {
        // Create new domain
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
        modelStore.setDomains([...modelStore.domains, domain]);
        modelStore.setSelectedDomain(domain.id);
      }
      
      // Merge loaded assets with existing ones (replace by ID if exists, otherwise add)
      if (domainData.tables.length > 0) {
        const existingTables = modelStore.tables;
        const mergedTables = [...existingTables];
        domainData.tables.forEach(table => {
          const index = mergedTables.findIndex(t => t.id === table.id);
          if (index >= 0) {
            mergedTables[index] = { ...mergedTables[index], ...table, domain_id: domain.id, primary_domain_id: domain.id };
          } else {
            mergedTables.push({ ...table, domain_id: domain.id, primary_domain_id: domain.id });
          }
        });
        modelStore.setTables(mergedTables);
      }
      
      if (domainData.products.length > 0) {
        const existingProducts = modelStore.products;
        const mergedProducts = [...existingProducts];
        domainData.products.forEach(product => {
          const index = mergedProducts.findIndex(p => p.id === product.id);
          if (index >= 0) {
            mergedProducts[index] = { ...mergedProducts[index], ...product, domain_id: domain.id };
          } else {
            mergedProducts.push({ ...product, domain_id: domain.id });
          }
        });
        modelStore.setProducts(mergedProducts);
      }
      
      if (domainData.assets.length > 0) {
        const existingAssets = modelStore.computeAssets;
        const mergedAssets = [...existingAssets];
        domainData.assets.forEach(asset => {
          const index = mergedAssets.findIndex(a => a.id === asset.id);
          if (index >= 0) {
            mergedAssets[index] = { ...mergedAssets[index], ...asset, domain_id: domain.id };
          } else {
            mergedAssets.push({ ...asset, domain_id: domain.id });
          }
        });
        modelStore.setComputeAssets(mergedAssets);
      }
      
      if (domainData.bpmnProcesses.length > 0) {
        const existingProcesses = modelStore.bpmnProcesses;
        const mergedProcesses = [...existingProcesses];
        domainData.bpmnProcesses.forEach(process => {
          const index = mergedProcesses.findIndex(p => p.id === process.id);
          if (index >= 0) {
            mergedProcesses[index] = { ...mergedProcesses[index], ...process, domain_id: domain.id };
          } else {
            mergedProcesses.push({ ...process, domain_id: domain.id });
          }
        });
        modelStore.setBPMNProcesses(mergedProcesses);
      }
      
      if (domainData.dmnDecisions.length > 0) {
        const existingDecisions = modelStore.dmnDecisions;
        const mergedDecisions = [...existingDecisions];
        domainData.dmnDecisions.forEach(decision => {
          const index = mergedDecisions.findIndex(d => d.id === decision.id);
          if (index >= 0) {
            mergedDecisions[index] = { ...mergedDecisions[index], ...decision, domain_id: domain.id };
          } else {
            mergedDecisions.push({ ...decision, domain_id: domain.id });
          }
        });
        modelStore.setDMNDecisions(mergedDecisions);
      }
      
      // Merge systems and relationships
      if (domainData.systems.length > 0) {
        const existingSystems = modelStore.systems;
        const mergedSystems = [...existingSystems];
        domainData.systems.forEach(system => {
          const index = mergedSystems.findIndex(s => s.id === system.id);
          if (index >= 0) {
            mergedSystems[index] = { ...mergedSystems[index], ...system, domain_id: domain.id };
          } else {
            mergedSystems.push({ ...system, domain_id: domain.id });
          }
        });
        modelStore.setSystems(mergedSystems);
      }
      
      if (domainData.relationships.length > 0) {
        const existingRelationships = modelStore.relationships;
        const mergedRelationships = [...existingRelationships];
        domainData.relationships.forEach(relationship => {
          const index = mergedRelationships.findIndex(r => r.id === relationship.id);
          if (index >= 0) {
            mergedRelationships[index] = { ...mergedRelationships[index], ...relationship, domain_id: domain.id };
          } else {
            mergedRelationships.push({ ...relationship, domain_id: domain.id });
          }
        });
        modelStore.setRelationships(mergedRelationships);
      }
      
      addToast({
        type: 'success',
        message: `Loaded domain: ${domain.name}`,
      });
    } catch (err) {
      console.error('Failed to load domain:', err);
      addToast({
        type: 'error',
        message: `Failed to load domain: ${err instanceof Error ? err.message : 'Unknown error'}`,
      });
    }
  };

  // Save Domain handler for offline mode
  const handleSaveDomain = async () => {
    if (getPlatform() !== 'electron') {
      addToast({
        type: 'error',
        message: 'Save Domain is only available in Electron offline mode',
      });
      return;
    }

    if (!selectedDomainId || !workspaceId) {
      addToast({
        type: 'error',
        message: 'Please select a domain and workspace first',
      });
      return;
    }

    try {
      const modelStore = useModelStore.getState();
      const domain = modelStore.domains.find((d) => d.id === selectedDomainId);
      
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
        return;
      }

      const domainPath = result.filePaths[0];
      
      // Get all domain assets
      const domainTables = modelStore.tables.filter((t) => t.domain_id === selectedDomainId || t.primary_domain_id === selectedDomainId);
      const domainProducts = modelStore.products.filter((p) => p.domain_id === selectedDomainId);
      const domainAssets = modelStore.computeAssets.filter((a) => a.domain_id === selectedDomainId);
      const domainBpmnProcesses = modelStore.bpmnProcesses.filter((p) => p.domain_id === selectedDomainId);
      const domainDmnDecisions = modelStore.dmnDecisions.filter((d) => d.domain_id === selectedDomainId);
      const domainSystems = modelStore.systems.filter((s) => s.domain_id === selectedDomainId);
      const domainRelationships = modelStore.relationships.filter((r) => r.domain_id === selectedDomainId);
      
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
      
      // Extract workspace path from domain path (parent directory)
      const pathParts = domainPath.split(/[/\\]/).filter(Boolean);
      const workspacePath = pathParts.slice(0, -1).join('/');
      
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
      
      // Save workspace.yaml with all domain IDs
      if (workspacePath && workspaceId) {
        const modelStore = useModelStore.getState();
        const allDomains = modelStore.domains;
        const workspaceMetadata = {
          id: workspaceId,
          name: workspaceId, // Use workspaceId as name if workspace name not available
          created_at: new Date().toISOString(),
          last_modified_at: new Date().toISOString(),
          domains: allDomains.map(d => ({
            id: d.id,
            name: d.name,
          })),
        };
        await electronFileService.saveWorkspaceMetadata(workspacePath, workspaceMetadata);
      }
      
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
    }
  };
  
  // Initialize collaboration
  useCollaboration({
    workspaceId: workspaceId ?? '',
    enabled: mode === 'online' && !!workspaceId,
  });
  
  // Show conflict resolver when conflicts exist
  useEffect(() => {
    if (conflicts.length > 0) {
      setShowConflictResolver(true);
    }
  }, [conflicts.length]);

  // Show table editor modal when table is selected
  useEffect(() => {
    if (selectedTableId) {
      setShowTableEditor(true);
      setShowTableProperties(false);
    } else {
      setShowTableEditor(false);
      setShowTableProperties(false);
    }
  }, [selectedTableId]);

  // Initialize auto-save when workspace is loaded
  useEffect(() => {
    if (!workspaceId) {
      return;
    }

    const workspaceStore = useWorkspaceStore.getState();
    workspaceStore.startAutoSave();

    return () => {
      workspaceStore.stopAutoSave();
    };
  }, [workspaceId]);

  // Handle browser refresh
  useEffect(() => {
    const handleBeforeUnload = async (e: BeforeUnloadEvent) => {
      const { handleBrowserRefresh } = useWorkspaceStore.getState();
      const { pendingChanges } = useWorkspaceStore.getState();
      
      if (pendingChanges) {
        const result = await handleBrowserRefresh();
        if (result.hasLocalChanges || result.hasRemoteChanges) {
          e.preventDefault();
          e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
          return e.returnValue;
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [workspaceId]);

  // Load workspace and domain on mount
  useEffect(() => {
    const loadWorkspace = async () => {
      if (!workspaceId) {
        setError('Workspace ID is required');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        // Check if we're in offline mode - skip API calls
        const currentMode = useSDKModeStore.getState().mode;
        if (currentMode === 'offline') {
          // In offline mode, load from workspace store (loaded from file)
          const workspace = workspaces.find((w) => w.id === workspaceId);
          if (workspace) {
            // Set current workspace
            setCurrentWorkspace(workspace.id);
            
            // Load all assets from workspace
            // Workspace loaded from file may have all assets stored separately
            const workspaceData = workspace as any;
            
            // Load tables
            if (workspaceData.tables && Array.isArray(workspaceData.tables)) {
              console.log(`[ModelEditor] Loading ${workspaceData.tables.length} table(s) from workspace`);
              setTables(workspaceData.tables);
            }
            
            // Load relationships
            if (workspaceData.relationships && Array.isArray(workspaceData.relationships)) {
              console.log(`[ModelEditor] Loading ${workspaceData.relationships.length} relationship(s) from workspace`);
              setRelationships(workspaceData.relationships);
            }
            
            // Load systems
            if (workspaceData.systems && Array.isArray(workspaceData.systems)) {
              console.log(`[ModelEditor] Loading ${workspaceData.systems.length} system(s) from workspace`);
              console.log(`[ModelEditor] Systems domain_ids:`, workspaceData.systems.map((s: any) => ({ id: s.id, name: s.name, domain_id: s.domain_id })));
              console.log(`[ModelEditor] Workspace domains:`, workspace.domains?.map((d: any) => ({ id: d.id, name: d.name })));
              setSystems(workspaceData.systems);
            }
            
            // Load products
            if (workspaceData.products && Array.isArray(workspaceData.products)) {
              console.log(`[ModelEditor] Loading ${workspaceData.products.length} product(s) from workspace`);
              setProducts(workspaceData.products);
            }
            
            // Load assets
            if (workspaceData.assets && Array.isArray(workspaceData.assets)) {
              console.log(`[ModelEditor] Loading ${workspaceData.assets.length} asset(s) from workspace`);
              setComputeAssets(workspaceData.assets);
            }
            
            // Load BPMN processes
            if (workspaceData.bpmnProcesses && Array.isArray(workspaceData.bpmnProcesses)) {
              console.log(`[ModelEditor] Loading ${workspaceData.bpmnProcesses.length} BPMN process(es) from workspace`);
              setBPMNProcesses(workspaceData.bpmnProcesses);
            }
            
            // Load DMN decisions
            if (workspaceData.dmnDecisions && Array.isArray(workspaceData.dmnDecisions)) {
              console.log(`[ModelEditor] Loading ${workspaceData.dmnDecisions.length} DMN decision(s) from workspace`);
              setDMNDecisions(workspaceData.dmnDecisions);
            }
            
            // Set domains from workspace
            if (workspace.domains && workspace.domains.length > 0) {
              console.log(`[ModelEditor] Loading ${workspace.domains.length} domain(s) from workspace`);
              setDomains(workspace.domains);
              const firstDomain = workspace.domains[0];
              if (firstDomain) {
                setSelectedDomain(firstDomain.id);
              }
            } else {
              // Create a default domain if none exist
              const defaultDomain = {
                id: `domain-${workspaceId}`,
                workspace_id: workspaceId,
                name: 'Default',
                model_type: 'conceptual' as const,
                is_primary: true,
                created_at: new Date().toISOString(),
                last_modified_at: new Date().toISOString(),
              };
              setDomains([defaultDomain]);
              setSelectedDomain(defaultDomain.id);
            }
            
            addToast({
              type: 'success',
              message: `Loaded workspace: ${workspace.name || workspaceId}`,
            });
          } else {
            setError('Workspace not found. Please open a file in offline mode.');
          }
          setIsLoading(false);
          return;
        }

        // Load workspace info (online mode only)
        await fetchWorkspace(workspaceId);

        // Load domains
        const domainList = await workspaceService.listDomains();
        if (domainList.length === 0) {
          // Create default domain if none exist
          await workspaceService.createDomain('default');
          domainList.push('default');
        }

        // Set selected domain
        const selectedDomain = domainId || domainList[0];
        if (!selectedDomain) {
          setError('No domain available');
          setIsLoading(false);
          return;
        }

        setSelectedDomain(selectedDomain);

        // Load domain into model service
        await workspaceService.loadDomain(selectedDomain);

        // Load all domain assets (tables, relationships, products, compute assets, BPMN, DMN)
        if (workspaceId) {
          await loadDomainAssets(workspaceId, selectedDomain);
        } else {
          // Fallback: fetch tables and relationships separately
          await Promise.all([
            fetchTables(selectedDomain),
            fetchRelationships(selectedDomain),
          ]);
        }
      } catch (err) {
        // In offline mode, API errors are expected
        const currentMode = useSDKModeStore.getState().mode;
        if (currentMode === 'offline') {
          setError(null); // Clear error in offline mode
        } else {
          setError(err instanceof Error ? err.message : 'Failed to load workspace');
          console.error('Failed to load workspace:', err);
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadWorkspace();
  }, [workspaceId, domainId, fetchWorkspace, fetchTables, fetchRelationships, loadDomainAssets, setSelectedDomain]);



  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loading />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-600 mb-2">Error</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!selectedDomainId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-gray-600">No domain selected</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Navbar */}
      <ModelNavbar
        onShowSettings={() => setShowWorkspaceSettings(!showWorkspaceSettings)}
        onShowVersionHistory={mode === 'online' && workspaceId ? () => setShowVersionHistory(!showVersionHistory) : undefined}
        workspaceId={workspaceId}
        domainId={selectedDomainId}
      />
      
      {/* Collaboration Status - moved below navbar */}
      {mode === 'online' && workspaceId && (
        <div className="bg-gray-50 border-b border-gray-200 px-4 py-1">
          <div className="flex items-center gap-4">
            <CollaborationStatus workspaceId={workspaceId} />
            <PresenceIndicator workspaceId={workspaceId} />
          </div>
        </div>
      )}
      
      {/* Domain Selector */}
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-2">
        <div className="flex items-center justify-between">
          <DomainSelector workspaceId={workspaceId ?? ''} />
        </div>
      </div>

      {/* Domain Tabs */}
      <DomainTabs workspaceId={workspaceId ?? ''} />
      
      {/* View Selector */}
      {selectedDomainId && <ViewSelector domainId={selectedDomainId} />}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Canvas */}
        <div className="flex-1 relative">
          {selectedDomainId && workspaceId && (
            <DomainCanvas workspaceId={workspaceId} domainId={selectedDomainId} />
          )}
        </div>
      </div>

      {/* BPMN/DMN creation is now only available inside CADS nodes (AI/ML/App) */}

      {/* Conflict Resolver */}
      <ConflictResolver
        isOpen={showConflictResolver}
        onClose={() => setShowConflictResolver(false)}
      />

      {/* Workspace Settings Dialog */}
      {showWorkspaceSettings && workspaceId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Workspace Settings</h2>
              <button
                onClick={() => setShowWorkspaceSettings(false)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <WorkspaceSettings workspaceId={workspaceId} />
          </div>
        </div>
      )}

      {/* Version History Dialog */}
      {showVersionHistory && workspaceId && mode === 'online' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Version History</h2>
              <button
                onClick={() => setShowVersionHistory(false)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <VersionHistory workspaceId={workspaceId} />
          </div>
        </div>
      )}

      {/* Import/Export Dialog */}
      <ImportExportDialog
        isOpen={showImportExportDialog}
        onClose={() => setShowImportExportDialog(false)}
      />

      {/* Table Editor Modal */}
      {selectedTableId && selectedDomainId && (
        <DraggableModal
          isOpen={showTableEditor}
          onClose={() => {
            setShowTableEditor(false);
            setSelectedTable(null);
          }}
          title="Edit Table"
          size="lg"
          initialPosition={{
            x: Math.max(50, window.innerWidth / 2 - 400),
            y: Math.max(50, window.innerHeight / 2 - 300),
          }}
        >
          <TableEditor 
            tableId={selectedTableId} 
            workspaceId={workspaceId ?? ''}
            onClose={async () => {
              // Small delay to ensure canvas updates before closing
              await new Promise(resolve => setTimeout(resolve, 150));
              setShowTableEditor(false);
              setSelectedTable(null);
            }}
          />
        </DraggableModal>
      )}

      {/* Table Properties Modal */}
      {selectedTableId && (
        <DraggableModal
          isOpen={showTableProperties}
          onClose={() => {
            setShowTableProperties(false);
            setSelectedTable(null);
          }}
          title="Table Properties"
          size="md"
          initialPosition={{
            x: window.innerWidth / 2 - 300,
            y: window.innerHeight / 2 - 200,
          }}
        >
          <div className="flex gap-2 mb-4 border-b border-gray-200 pb-4">
            <button
              onClick={() => {
                setShowTableEditor(true);
                setShowTableProperties(false);
              }}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Edit Table
            </button>
          </div>
          <TableProperties tableId={selectedTableId} workspaceId={workspaceId ?? ''} />
        </DraggableModal>
      )}

      {/* Create Table Dialog */}
      {selectedDomainId && (
        <CreateTableDialog
          workspaceId={workspaceId ?? ''}
          domainId={selectedDomainId}
          isOpen={showCreateTableDialog}
          onClose={() => setShowCreateTableDialog(false)}
          onCreated={(tableId) => {
            setSelectedTable(tableId);
            setShowCreateTableDialog(false);
          }}
        />
      )}

      {/* Create System Dialog */}
      {selectedDomainId && (
        <CreateSystemDialog
          domainId={selectedDomainId}
          isOpen={showCreateSystemDialog}
          onClose={() => setShowCreateSystemDialog(false)}
          onCreated={(systemId) => {
            setShowCreateSystemDialog(false);
            // Optionally select the system
            useModelStore.getState().setSelectedSystem(systemId);
          }}
        />
      )}
    </div>
  );
};

export default ModelEditor;
