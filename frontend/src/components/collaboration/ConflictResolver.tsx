/**
 * Conflict Resolver Component
 * Displays and handles conflict warnings
 */

import React from 'react';
import { useCollaborationStore } from '@/stores/collaborationStore';
import { Dialog } from '@/components/common/Dialog';

export interface ConflictResolverProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ConflictResolver: React.FC<ConflictResolverProps> = ({ isOpen, onClose }) => {
  const { conflicts, removeConflict } = useCollaborationStore();

  const handleDismiss = (conflictId: string) => {
    removeConflict(conflictId);
    if (conflicts.length === 1) {
      onClose();
    }
  };

  const handleDismissAll = () => {
    useCollaborationStore.getState().clearConflicts();
    onClose();
  };

  if (conflicts.length === 0) {
    return null;
  }

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Collaboration Conflicts">
      <div className="p-4">
        <div className="mb-4">
          <p className="text-sm text-gray-600">
            The following conflicts were detected while collaborating:
          </p>
        </div>

        <div className="space-y-3 max-h-96 overflow-y-auto">
          {conflicts.map((conflict) => (
            <div
              key={conflict.id}
              className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-yellow-800">
                      {conflict.elementType.charAt(0).toUpperCase() + conflict.elementType.slice(1)} Conflict
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(conflict.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700">{conflict.message}</p>
                  <p className="text-xs text-gray-500 mt-1">Element ID: {conflict.elementId}</p>
                </div>
                <button
                  onClick={() => handleDismiss(conflict.id)}
                  className="ml-2 px-2 py-1 text-xs text-gray-600 hover:text-gray-800"
                  title="Dismiss"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={handleDismissAll}
            className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
          >
            Dismiss All
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Close
          </button>
        </div>
      </div>
    </Dialog>
  );
};

