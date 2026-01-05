/**
 * Workspace Settings Component
 * Manages workspace settings and permissions
 */

import React, { useState, useEffect } from 'react';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { workspaceService } from '@/services/api/workspaceService';
import { useUIStore } from '@/stores/uiStore';
import type { Workspace } from '@/types/workspace';

export interface WorkspaceSettingsProps {
  workspaceId: string;
  className?: string;
}

export interface Collaborator {
  email: string;
  access_level: 'read' | 'edit';
}

export const WorkspaceSettings: React.FC<WorkspaceSettingsProps> = ({ workspaceId, className = '' }) => {
  const { workspaces, updateWorkspaceRemote } = useWorkspaceStore();
  const { addToast } = useUIStore();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [workspaceName, setWorkspaceName] = useState('');
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newCollaboratorEmail, setNewCollaboratorEmail] = useState('');
  const [newCollaboratorAccess, setNewCollaboratorAccess] = useState<'read' | 'edit'>('edit');

  useEffect(() => {
    const ws = workspaces.find((w) => w.id === workspaceId);
    if (ws) {
      setWorkspace(ws);
      setWorkspaceName(ws.name);
    }

    // Load collaborators (if needed in future)
    if (false) { // Disabled - offline mode only
      loadCollaborators();
    }
  }, [workspaceId, workspaces]);

  const loadCollaborators = async () => {
    try {
      const collabs = await workspaceService.getCollaborators(workspaceId);
      setCollaborators(collabs);
    } catch (error) {
      console.error('Failed to load collaborators:', error);
    }
  };

  const handleNameChange = async (newName: string) => {
    if (!newName.trim() || newName === workspace?.name) {
      return;
    }

    setIsLoading(true);
    try {
      await updateWorkspaceRemote(workspaceId, { name: newName });
      addToast({
        type: 'success',
        message: 'Workspace name updated',
      });
    } catch (error) {
      addToast({
        type: 'error',
        message: 'Failed to update workspace name',
      });
      setWorkspaceName(workspace?.name || '');
    } finally {
      setIsLoading(false);
    }
  };


  const handleAddCollaborator = async () => {
    if (!newCollaboratorEmail.trim()) {
      return;
    }

    setIsLoading(true);
    try {
      await workspaceService.addCollaborator(workspaceId, newCollaboratorEmail, newCollaboratorAccess);
      addToast({
        type: 'success',
        message: 'Collaborator added',
      });
      setNewCollaboratorEmail('');
      await loadCollaborators();
    } catch (error) {
      addToast({
        type: 'error',
        message: 'Failed to add collaborator',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveCollaborator = async (email: string) => {
    setIsLoading(true);
    try {
      await workspaceService.removeCollaborator(workspaceId, email);
      addToast({
        type: 'success',
        message: 'Collaborator removed',
      });
      await loadCollaborators();
    } catch (error) {
      addToast({
        type: 'error',
        message: 'Failed to remove collaborator',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateCollaboratorAccess = async (email: string, accessLevel: 'read' | 'edit') => {
    setIsLoading(true);
    try {
      await workspaceService.updateCollaboratorAccess(workspaceId, email, accessLevel);
      addToast({
        type: 'success',
        message: 'Collaborator access updated',
      });
      await loadCollaborators();
    } catch (error) {
      addToast({
        type: 'error',
        message: 'Failed to update collaborator access',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!workspace) {
    return <div className={className}>Workspace not found</div>;
  }

  return (
    <div className={`p-6 space-y-6 ${className}`}>
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Workspace Settings</h2>

        {/* Workspace Name */}
        <div className="mb-6">
          <label htmlFor="workspace-name" className="block text-sm font-medium text-gray-700 mb-2">
            Workspace Name
          </label>
          <input
            id="workspace-name"
            type="text"
            value={workspaceName}
            onChange={(e) => setWorkspaceName(e.target.value)}
            onBlur={() => handleNameChange(workspaceName)}
            disabled={isLoading}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Domain Information */}
        {workspace.domains && workspace.domains.length > 0 && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Domains ({workspace.domains.length})
            </label>
            <div className="space-y-2">
              {workspace.domains.map((domain) => (
                <div
                  key={domain.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <span className="font-medium text-gray-900">{domain.name}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Collaborators Section (disabled - offline mode only) */}
        {false && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Collaborators</h3>

            {/* Add Collaborator */}
            <div className="mb-4 flex gap-2">
              <input
                type="email"
                placeholder="Collaborator email"
                value={newCollaboratorEmail}
                onChange={(e) => setNewCollaboratorEmail(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={newCollaboratorAccess}
                onChange={(e) => setNewCollaboratorAccess(e.target.value as 'read' | 'edit')}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="read">Read</option>
                <option value="edit">Edit</option>
              </select>
              <button
                onClick={handleAddCollaborator}
                disabled={isLoading || !newCollaboratorEmail.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Add
              </button>
            </div>

            {/* Collaborators List */}
            <div className="space-y-2">
              {collaborators.map((collaborator) => (
                <div
                  key={collaborator.email}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <span className="text-gray-900">{collaborator.email}</span>
                  <div className="flex items-center gap-2">
                    <select
                      value={collaborator.access_level}
                      onChange={(e) =>
                        handleUpdateCollaboratorAccess(collaborator.email, e.target.value as 'read' | 'edit')
                      }
                      disabled={isLoading}
                      className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="read">Read</option>
                      <option value="edit">Edit</option>
                    </select>
                    <button
                      onClick={() => handleRemoveCollaborator(collaborator.email)}
                      disabled={isLoading}
                      className="text-red-600 hover:text-red-800"
                      aria-label={`Remove ${collaborator.email}`}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

