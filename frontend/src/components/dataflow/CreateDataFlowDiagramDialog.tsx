/**
 * Create Data Flow Diagram Dialog
 * Dialog for creating a new data flow diagram
 */

import React, { useState } from 'react';
import { Dialog } from '@/components/common/Dialog';
import { useModelStore } from '@/stores/modelStore';
import { useUIStore } from '@/stores/uiStore';
import type { CreateDataFlowDiagramRequest } from '@/types/api';

export interface CreateDataFlowDiagramDialogProps {
  workspaceId: string;
  isOpen: boolean;
  onClose: () => void;
  onCreated: (diagramId: string) => void;
}

export const CreateDataFlowDiagramDialog: React.FC<CreateDataFlowDiagramDialogProps> = ({
  workspaceId,
  isOpen,
  onClose,
  onCreated,
}) => {
  const [name, setName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const { createDataFlowDiagramRemote } = useModelStore();
  const { addToast } = useUIStore();

  const handleCreate = async () => {
    if (!name.trim()) {
      addToast({
        type: 'error',
        message: 'Please enter a diagram name',
      });
      return;
    }

    setIsCreating(true);
    try {
      const request: CreateDataFlowDiagramRequest = {
        name: name.trim(),
        nodes: [],
        connections: [],
      };

      const diagram = await createDataFlowDiagramRemote(workspaceId, request);
      addToast({
        type: 'success',
        message: `Created diagram "${diagram.name}"`,
      });
      setName('');
      onCreated(diagram.id);
      onClose();
    } catch (error) {
      addToast({
        type: 'error',
        message: `Failed to create diagram: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Create Data Flow Diagram">
      <div className="p-4">
        <div className="mb-4">
          <label htmlFor="diagram-name" className="block text-sm font-medium text-gray-700 mb-2">
            Diagram Name
          </label>
          <input
            id="diagram-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Customer Data Flow"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !isCreating) {
                handleCreate();
              }
            }}
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
      </div>
    </Dialog>
  );
};

