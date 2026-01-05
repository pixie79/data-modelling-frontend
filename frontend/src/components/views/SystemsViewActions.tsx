/**
 * Systems View Actions Component
 * Provides Create/Import System button and BPMN Domain Process button for Systems view
 */

import React, { useState } from 'react';
import { CreateSystemDialog } from '@/components/system/CreateSystemDialog';
import { BPMNDomainProcessDialog } from '@/components/system/BPMNDomainProcessDialog';
import { useModelStore } from '@/stores/modelStore';

export interface SystemsViewActionsProps {
  domainId: string;
}

export const SystemsViewActions: React.FC<SystemsViewActionsProps> = ({ domainId }) => {
  const [showCreateSystemDialog, setShowCreateSystemDialog] = useState(false);
  const [showBPMNDialog, setShowBPMNDialog] = useState(false);
  const { bpmnProcesses } = useModelStore();
  
  // Count domain-level BPMN processes
  const domainBPMNCount = bpmnProcesses.filter((p) => p.domain_id === domainId).length;

  const handleCreate = () => {
    setShowCreateSystemDialog(true);
  };

  const handleBPMNClick = () => {
    setShowBPMNDialog(true);
  };

  return (
    <>
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        <button
          onClick={handleBPMNClick}
          className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg shadow-lg hover:bg-purple-700 flex items-center gap-2"
          title="Create or edit domain-level BPMN processes"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <span>BPMN Domain Process</span>
          {domainBPMNCount > 0 && (
            <span className="px-2 py-0.5 text-xs font-semibold bg-purple-800 rounded-full">
              {domainBPMNCount}
            </span>
          )}
        </button>
        <button
          onClick={handleCreate}
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg shadow-lg hover:bg-indigo-700 flex items-center gap-2"
          title="Create or import a system (database, schema, namespace)"
        >
          <span>+</span>
          <span>Create/Import System</span>
        </button>
      </div>

      {/* Create System Dialog */}
      <CreateSystemDialog
        domainId={domainId}
        isOpen={showCreateSystemDialog}
        onClose={() => setShowCreateSystemDialog(false)}
        onCreated={(systemId) => {
          setShowCreateSystemDialog(false);
          // Optionally select the system
          useModelStore.getState().setSelectedSystem(systemId);
        }}
      />

      {/* BPMN Domain Process Dialog */}
      <BPMNDomainProcessDialog
        domainId={domainId}
        isOpen={showBPMNDialog}
        onClose={() => setShowBPMNDialog(false)}
      />
    </>
  );
};


