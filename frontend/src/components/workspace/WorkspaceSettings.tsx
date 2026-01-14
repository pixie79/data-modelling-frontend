/**
 * Workspace Settings Component
 * Manages workspace settings and permissions
 */

import React, { useState, useEffect } from 'react';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { workspaceService } from '@/services/api/workspaceService';
import { useUIStore } from '@/stores/uiStore';
import type { Workspace } from '@/types/workspace';
import { AutoSaveSettings } from '@/components/settings/AutoSaveSettings';
import { DatabaseSettings } from '@/components/settings/DatabaseSettings';
import { sdkLoader } from '@/services/sdk/sdkLoader';
import { getDuckDBService } from '@/services/database/duckdbService';

// App version from build-time constant
declare const __APP_VERSION__: string;
const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';

export interface WorkspaceSettingsProps {
  workspaceId: string;
  className?: string;
}

export interface Collaborator {
  email: string;
  access_level: 'read' | 'edit';
}

export const WorkspaceSettings: React.FC<WorkspaceSettingsProps> = ({
  workspaceId,
  className = '',
}) => {
  const { workspaces, updateWorkspaceRemote } = useWorkspaceStore();
  const { addToast } = useUIStore();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [workspaceName, setWorkspaceName] = useState('');
  const [workspaceDescription, setWorkspaceDescription] = useState('');
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newCollaboratorEmail, setNewCollaboratorEmail] = useState('');
  const [newCollaboratorAccess, setNewCollaboratorAccess] = useState<'read' | 'edit'>('edit');
  const [duckdbVersion, setDuckdbVersion] = useState<string>('Not initialized');

  // Load DuckDB version on mount
  useEffect(() => {
    const loadDuckDBVersion = async () => {
      try {
        const duckdb = getDuckDBService();
        const stats = await duckdb.getStats();
        setDuckdbVersion(stats.version || 'Unknown');
      } catch {
        setDuckdbVersion('Not available');
      }
    };
    loadDuckDBVersion();
  }, []);

  useEffect(() => {
    const ws = workspaces.find((w) => w.id === workspaceId);
    if (ws) {
      setWorkspace(ws);
      setWorkspaceName(ws.name);
      setWorkspaceDescription(ws.description || '');
    }

    // Load collaborators (if needed in future)
    // Disabled - offline mode only
    // loadCollaborators();
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
    } catch {
      addToast({
        type: 'error',
        message: 'Failed to update workspace name',
      });
      setWorkspaceName(workspace?.name || '');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDescriptionChange = async (newDescription: string) => {
    // Allow empty description (to clear it)
    if (newDescription === (workspace?.description || '')) {
      return;
    }

    setIsLoading(true);
    try {
      await updateWorkspaceRemote(workspaceId, { description: newDescription });
      addToast({
        type: 'success',
        message: 'Workspace description updated',
      });
    } catch {
      addToast({
        type: 'error',
        message: 'Failed to update workspace description',
      });
      setWorkspaceDescription(workspace?.description || '');
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
      await workspaceService.addCollaborator(
        workspaceId,
        newCollaboratorEmail,
        newCollaboratorAccess
      );
      addToast({
        type: 'success',
        message: 'Collaborator added',
      });
      setNewCollaboratorEmail('');
      await loadCollaborators();
    } catch {
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
    } catch {
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
    } catch {
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

        {/* Workspace Description */}
        <div className="mb-6">
          <label
            htmlFor="workspace-description"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Description
          </label>
          <textarea
            id="workspace-description"
            value={workspaceDescription}
            onChange={(e) => setWorkspaceDescription(e.target.value)}
            onBlur={() => handleDescriptionChange(workspaceDescription)}
            disabled={isLoading}
            rows={4}
            placeholder="Describe the purpose of this workspace..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
          />
          <p className="mt-1 text-sm text-gray-500">
            This description is saved in the README.md file when the workspace is exported.
          </p>
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

        {/* Auto-Save Settings */}
        <div className="mb-6 border-t pt-6">
          <AutoSaveSettings />
        </div>

        {/* Version Information */}
        <div className="mb-6 border-t pt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Version Information</h3>
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-600">Application Version</span>
              <span className="text-sm text-gray-900 font-mono">{APP_VERSION}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-600">WASM SDK Version</span>
              <span className="text-sm text-gray-900 font-mono">
                {sdkLoader.isLoaded() ? sdkLoader.getSDKVersion() : 'Not loaded'}+
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-600">DuckDB WASM Version</span>
              <span className="text-sm text-gray-900 font-mono">{duckdbVersion}</span>
            </div>
          </div>
        </div>

        {/* Database Settings (SDK 1.13.1+) */}
        {workspace.domains && workspace.domains[0]?.workspace_path && (
          <div className="mb-6 border-t pt-6">
            <DatabaseSettings workspacePath={workspace.domains[0].workspace_path} />
          </div>
        )}

        {/* Collaborators Section (disabled - offline mode only) */}
        {/* eslint-disable-next-line no-constant-binary-expression */}
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
                        handleUpdateCollaboratorAccess(
                          collaborator.email,
                          e.target.value as 'read' | 'edit'
                        )
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
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
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
