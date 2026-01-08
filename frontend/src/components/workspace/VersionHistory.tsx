/**
 * Version History Component
 * Displays workspace version history and allows restoration
 */

import React, { useEffect, useState } from 'react';
import { versioningService, type Version } from '@/services/api/versioningService';
import { useUIStore } from '@/stores/uiStore';

export interface VersionHistoryProps {
  workspaceId: string;
  className?: string;
}

export const VersionHistory: React.FC<VersionHistoryProps> = ({ workspaceId, className = '' }) => {
  const { addToast } = useUIStore();
  const [versions, setVersions] = useState<Version[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  useEffect(() => {
    loadVersions();
  }, [workspaceId]);

  const loadVersions = async () => {
    setIsLoading(true);
    try {
      const versionList = await versioningService.getVersionHistory(workspaceId);
      setVersions(versionList);
    } catch {
      addToast({
        type: 'error',
        message: 'Failed to load version history',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async (versionId: string) => {
    if (
      !confirm(
        'Are you sure you want to restore this version? This will overwrite the current workspace.'
      )
    ) {
      return;
    }

    setRestoringId(versionId);
    try {
      await versioningService.restoreVersion(workspaceId, versionId);
      addToast({
        type: 'success',
        message: 'Version restored successfully',
      });
      await loadVersions();
    } catch {
      addToast({
        type: 'error',
        message: 'Failed to restore version',
      });
    } finally {
      setRestoringId(null);
    }
  };

  if (isLoading) {
    return (
      <div className={`p-4 ${className}`}>
        <div className="text-center text-gray-500">Loading version history...</div>
      </div>
    );
  }

  return (
    <div className={`p-4 ${className}`}>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Version History</h3>

      {versions.length === 0 ? (
        <div className="text-center text-gray-500 py-8">No versions found</div>
      ) : (
        <div className="space-y-2">
          {versions.map((version) => (
            <div
              key={version.version_id}
              className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="font-medium text-gray-900">
                    {version.description || 'No description'}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    Created by {version.created_by} on{' '}
                    {new Date(version.created_at).toLocaleString()}
                  </div>
                </div>
                <button
                  onClick={() => handleRestore(version.version_id)}
                  disabled={restoringId === version.version_id}
                  className="ml-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {restoringId === version.version_id ? 'Restoring...' : 'Restore'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
