/**
 * Collaboration Status Component
 * Shows collaboration connection status and warnings
 */

import React from 'react';
import { useCollaborationStore } from '@/stores/collaborationStore';
import { useSDKModeStore } from '@/services/sdk/sdkMode';

export interface CollaborationStatusProps {
  workspaceId: string;
}

export const CollaborationStatus: React.FC<CollaborationStatusProps> = () => {
  const { session } = useCollaborationStore();
  const { mode } = useSDKModeStore();

  // Don't show collaboration status in offline mode
  if (mode === 'offline') {
    return (
      <div className="px-3 py-1 text-xs text-gray-500 bg-yellow-50 rounded">
        <span className="inline-block w-2 h-2 bg-yellow-500 rounded-full mr-2"></span>
        Collaboration disabled (offline mode)
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const getStatusColor = () => {
    switch (session.connectionStatus) {
      case 'connected':
        return 'bg-green-500';
      case 'reconnecting':
        return 'bg-yellow-500';
      case 'disconnected':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusText = () => {
    switch (session.connectionStatus) {
      case 'connected':
        return 'Connected';
      case 'reconnecting':
        return 'Reconnecting...';
      case 'disconnected':
        return 'Disconnected';
      default:
        return 'Unknown';
    }
  };

  return (
    <div className="px-3 py-1 text-xs text-gray-600 bg-gray-50 rounded flex items-center gap-2">
      <span className={`inline-block w-2 h-2 ${getStatusColor()} rounded-full`}></span>
      <span>{getStatusText()}</span>
      {session.connectionStatus === 'disconnected' && (
        <span className="text-red-600">(Changes saved locally)</span>
      )}
    </div>
  );
};

