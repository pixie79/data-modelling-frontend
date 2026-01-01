/**
 * Model Editor Page
 * Main page for editing data models with infinite canvas
 */

import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { InfiniteCanvas } from '@/components/canvas/InfiniteCanvas';
import { DomainTabs } from '@/components/domain/DomainTabs';
import { DomainSelector } from '@/components/domain/DomainSelector';
import { TableEditor } from '@/components/table/TableEditor';
import { TableProperties } from '@/components/table/TableProperties';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useModelStore } from '@/stores/modelStore';
import { workspaceService } from '@/services/api/workspaceService';
import { Loading } from '@/components/common/Loading';
import { OnlineOfflineToggle } from '@/components/common/OnlineOfflineToggle';
import { useSDKModeStore } from '@/services/sdk/sdkMode';
import { useUIStore } from '@/stores/uiStore';

const ModelEditor: React.FC = () => {
  const { workspaceId, domainId } = useParams<{ workspaceId: string; domainId?: string }>();
  const { fetchWorkspace, workspaces, setCurrentWorkspace } = useWorkspaceStore();
  const {
    selectedDomainId,
    selectedTableId,
    fetchTables,
    fetchRelationships,
    setSelectedDomain,
    setSelectedTable,
    setTables,
    setRelationships,
    setDomains,
  } = useModelStore();
  const { addToast } = useUIStore();

  const [isLoading, setIsLoading] = useState(true);
  const [showTableEditor, setShowTableEditor] = useState(false);
  const [showTableProperties, setShowTableProperties] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
            
            // Load tables and relationships from workspace
            // Workspace loaded from ODCS file may have tables/relationships stored separately
            // Check if workspace has tables/relationships in metadata
            const workspaceData = workspace as any;
            if (workspaceData.tables && Array.isArray(workspaceData.tables)) {
              setTables(workspaceData.tables);
            }
            if (workspaceData.relationships && Array.isArray(workspaceData.relationships)) {
              setRelationships(workspaceData.relationships);
            }
            
            // Set domains from workspace
            if (workspace.domains && workspace.domains.length > 0) {
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

        // Fetch tables and relationships
        await Promise.all([
          fetchTables(selectedDomain),
          fetchRelationships(selectedDomain),
        ]);
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
  }, [workspaceId, domainId, fetchWorkspace, fetchTables, fetchRelationships, setSelectedDomain]);



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
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-2">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Data Model Editor</h1>
          <div className="flex items-center gap-4">
            <OnlineOfflineToggle />
            <DomainSelector workspaceId={workspaceId ?? ''} />
          </div>
        </div>
      </div>

      {/* Domain Tabs */}
          <DomainTabs workspaceId={workspaceId ?? ''} />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Canvas */}
        <div className="flex-1 relative">
          {selectedDomainId && (
            <InfiniteCanvas workspaceId={workspaceId ?? ''} domainId={selectedDomainId} />
          )}
        </div>

        {/* Sidebar */}
        {selectedTableId && (
          <div className="w-96 bg-white border-l border-gray-200 overflow-y-auto">
            {showTableEditor && (
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Edit Table</h2>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setShowTableProperties(true);
                        setShowTableEditor(false);
                      }}
                      className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                    >
                      Properties
                    </button>
                    <button
                      onClick={() => {
                        setShowTableEditor(false);
                        setSelectedTable(null);
                      }}
                      className="px-3 py-1 text-sm text-gray-500 hover:text-gray-700"
                    >
                      ✕
                    </button>
                  </div>
                </div>
                <TableEditor tableId={selectedTableId} workspaceId={workspaceId ?? ''} />
              </div>
            )}

            {showTableProperties && (
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Table Properties</h2>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setShowTableEditor(true);
                        setShowTableProperties(false);
                      }}
                      className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        setShowTableProperties(false);
                        setSelectedTable(null);
                      }}
                      className="px-3 py-1 text-sm text-gray-500 hover:text-gray-700"
                    >
                      ✕
                    </button>
                  </div>
                </div>
                <TableProperties tableId={selectedTableId} workspaceId={workspaceId ?? ''} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ModelEditor;
