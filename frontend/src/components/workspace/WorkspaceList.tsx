/**
 * Workspace List Component
 * Displays list of workspaces with type indicators
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useUIStore } from '@/stores/uiStore';
import type { Workspace } from '@/types/workspace';

export interface WorkspaceListProps {
  className?: string;
  onWorkspaceSelect?: (workspaceId: string) => void;
}

export const WorkspaceList: React.FC<WorkspaceListProps> = ({
  className = '',
  onWorkspaceSelect,
}) => {
  const {
    workspaces,
    currentWorkspaceId,
    isLoading,
    setCurrentWorkspace,
    deleteWorkspaceRemote,
    reloadWorkspaceFromDisk,
  } = useWorkspaceStore();
  const { addToast } = useUIStore();
  const navigate = useNavigate();
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [loadingId, setLoadingId] = React.useState<string | null>(null);

  const handleWorkspaceClick = async (workspace: Workspace) => {
    setLoadingId(workspace.id);

    try {
      // Try to reload from disk first (checks for persisted directory handle)
      const result = await reloadWorkspaceFromDisk(workspace.id);

      if (result.reloaded) {
        // Successfully loaded fresh data from disk
        addToast({
          type: 'info',
          message: 'Loaded latest files from disk',
        });
      } else if (!result.success && result.error) {
        // Failed to reload - show warning but continue with workspace data
        addToast({
          type: 'warning',
          message: result.error,
        });
        // Load from workspace object if it has embedded data
        await loadWorkspaceDataFromObject(workspace);
      } else {
        // No directory handle available - load from workspace object if it has data
        await loadWorkspaceDataFromObject(workspace);
      }
    } catch (error) {
      console.error('[WorkspaceList] Error reloading from disk:', error);
      // Try loading from workspace object as fallback
      await loadWorkspaceDataFromObject(workspace);
    }

    setCurrentWorkspace(workspace.id);
    onWorkspaceSelect?.(workspace.id);
    setLoadingId(null);
    navigate(`/workspace/${workspace.id}`);
  };

  // Helper function to load data from workspace object into model store
  const loadWorkspaceDataFromObject = async (workspace: Workspace) => {
    const workspaceData = workspace as any;

    // Only load if workspace has embedded data
    const hasData =
      workspaceData.tables ||
      workspaceData.systems ||
      workspaceData.relationships ||
      workspaceData.domains;

    if (!hasData) {
      console.log(
        '[WorkspaceList] Workspace has no embedded data, ModelEditor will handle loading'
      );
      return;
    }

    console.log('[WorkspaceList] Loading data from workspace object');

    // Import model store dynamically
    const { useModelStore } = await import('@/stores/modelStore');
    const modelStore = useModelStore.getState();

    // Load all data types if present
    if (workspaceData.domains && Array.isArray(workspaceData.domains)) {
      modelStore.setDomains(workspaceData.domains);
      if (workspaceData.domains.length > 0) {
        modelStore.setSelectedDomain(workspaceData.domains[0].id);
      }
    }
    if (workspaceData.tables && Array.isArray(workspaceData.tables)) {
      modelStore.setTables(workspaceData.tables);
    }
    if (workspaceData.relationships && Array.isArray(workspaceData.relationships)) {
      modelStore.setRelationships(workspaceData.relationships);
    }
    if (workspaceData.systems && Array.isArray(workspaceData.systems)) {
      modelStore.setSystems(workspaceData.systems);
    }
    if (workspaceData.products && Array.isArray(workspaceData.products)) {
      modelStore.setProducts(workspaceData.products);
    }
    if (workspaceData.assets && Array.isArray(workspaceData.assets)) {
      modelStore.setComputeAssets(workspaceData.assets);
    }
    if (workspaceData.bpmnProcesses && Array.isArray(workspaceData.bpmnProcesses)) {
      modelStore.setBPMNProcesses(workspaceData.bpmnProcesses);
    }
    if (workspaceData.dmnDecisions && Array.isArray(workspaceData.dmnDecisions)) {
      modelStore.setDMNDecisions(workspaceData.dmnDecisions);
    }

    // Load knowledge and decision records if present
    if (workspaceData.knowledgeArticles && Array.isArray(workspaceData.knowledgeArticles)) {
      const { useKnowledgeStore } = await import('@/stores/knowledgeStore');
      // Clear filter first to prevent stale domain_id filtering out new articles
      useKnowledgeStore.getState().setFilter({});
      useKnowledgeStore.getState().setArticles(workspaceData.knowledgeArticles);
    }
    if (workspaceData.decisionRecords && Array.isArray(workspaceData.decisionRecords)) {
      const { useDecisionStore } = await import('@/stores/decisionStore');
      useDecisionStore.getState().setDecisions(workspaceData.decisionRecords);
    }

    console.log('[WorkspaceList] Loaded data from workspace object:', {
      domains: workspaceData.domains?.length || 0,
      tables: workspaceData.tables?.length || 0,
      systems: workspaceData.systems?.length || 0,
      relationships: workspaceData.relationships?.length || 0,
    });
  };

  const handleDelete = async (workspaceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this workspace?')) {
      return;
    }

    setDeletingId(workspaceId);
    try {
      await deleteWorkspaceRemote(workspaceId);
    } catch (error) {
      console.error('Failed to delete workspace:', error);
      alert('Failed to delete workspace. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className={`p-4 ${className}`}>
        <div className="text-center text-gray-500">Loading workspaces...</div>
      </div>
    );
  }

  if (workspaces.length === 0) {
    return (
      <div className={`p-4 ${className}`}>
        <div className="text-center text-gray-500">
          No workspaces found. Create your first workspace to get started.
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {workspaces.map((workspace) => (
        <div
          key={workspace.id}
          onClick={() => !loadingId && handleWorkspaceClick(workspace)}
          className={`
            p-4 border rounded-lg cursor-pointer transition-colors
            ${loadingId === workspace.id ? 'bg-gray-50 border-gray-300' : ''}
            ${currentWorkspaceId === workspace.id ? 'bg-blue-50 border-blue-500' : 'bg-white border-gray-200 hover:border-gray-300'}
            ${loadingId && loadingId !== workspace.id ? 'opacity-50 pointer-events-none' : ''}
          `}
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                {loadingId === workspace.id && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                )}
                <h3 className="font-semibold text-gray-900">{workspace.name}</h3>
                <span
                  className={`
                    px-2 py-1 text-xs rounded
                    bg-gray-100 text-gray-800
                  `}
                >
                  Workspace
                </span>
              </div>
              {workspace.description && (
                <p className="text-sm text-gray-600 mt-1 line-clamp-2">{workspace.description}</p>
              )}
              <div className="flex items-center gap-4 mt-1">
                <p className="text-sm text-gray-500">
                  Last modified: {new Date(workspace.last_modified_at).toLocaleDateString()}
                </p>
                {workspace.domains && workspace.domains.length > 0 && (
                  <p className="text-sm text-gray-500">
                    {workspace.domains.length}{' '}
                    {workspace.domains.length === 1 ? 'domain' : 'domains'}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={(e) => handleDelete(workspace.id, e)}
              disabled={deletingId === workspace.id}
              className="ml-4 text-red-600 hover:text-red-800 disabled:opacity-50"
              aria-label={`Delete ${workspace.name}`}
            >
              {deletingId === workspace.id ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
