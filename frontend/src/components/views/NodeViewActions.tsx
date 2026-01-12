/**
 * Node View Actions Component
 * Provides Create/Import Node button for Process View
 */

import React, { useState } from 'react';
import { useModelStore } from '@/stores/modelStore';
import { CreateNodeDialog } from './CreateNodeDialog';
import { Tooltip } from '@/components/common/Tooltip';

export interface NodeViewActionsProps {
  domainId: string;
}

export const NodeViewActions: React.FC<NodeViewActionsProps> = ({ domainId }) => {
  const { currentView, selectedSystemId } = useModelStore();
  const [showCreateNodeDialog, setShowCreateNodeDialog] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  // Only show in Process View
  if (currentView !== 'process') {
    return null;
  }

  // Require a system to be selected
  if (!selectedSystemId) {
    return null;
  }

  const handleCreate = () => {
    setShowCreateNodeDialog(true);
  };

  return (
    <>
      <div className="absolute top-28 right-4 z-10">
        <div className="relative">
          <button
            onClick={handleCreate}
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            className="p-2 text-white bg-purple-600 rounded-lg shadow-lg hover:bg-purple-700 flex items-center justify-center"
            title="Create or import an AI/ML/App node (CADS node)"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
          </button>
          {showTooltip && (
            <Tooltip
              content="Add AI, ML, or App nodes to this system. These are CADS (Compute Asset Definition Standard) nodes that represent compute assets."
              position="left"
            >
              <span />
            </Tooltip>
          )}
        </div>
      </div>

      {/* Create/Import Node Dialog */}
      <CreateNodeDialog
        domainId={domainId}
        isOpen={showCreateNodeDialog}
        onClose={() => setShowCreateNodeDialog(false)}
        onCreated={() => {
          setShowCreateNodeDialog(false);
        }}
      />
    </>
  );
};
