/**
 * Table View Actions Component
 * Provides Create/Import Table button for Process, Operational, and Analytical views
 */

import React, { useState } from 'react';
import { useModelStore } from '@/stores/modelStore';
import { CreateTableDialog } from '@/components/table/CreateTableDialog';

export interface TableViewActionsProps {
  workspaceId: string;
  domainId: string;
}

export const TableViewActions: React.FC<TableViewActionsProps> = ({ workspaceId, domainId }) => {
  const { currentView, selectedSystemId, setSelectedTable } = useModelStore();
  const [showCreateTableDialog, setShowCreateTableDialog] = useState(false);

  // Only show in Process, Operational, and Analytical views
  if (currentView !== 'process' && currentView !== 'operational' && currentView !== 'analytical') {
    return null;
  }

  // Require a system to be selected
  if (!selectedSystemId) {
    return null;
  }

  const handleCreate = () => {
    setShowCreateTableDialog(true);
  };

  return (
    <>
      <div className="absolute top-16 right-4 z-10">
        <button
          onClick={handleCreate}
          className="p-2 text-white bg-blue-600 rounded-lg shadow-lg hover:bg-blue-700 flex items-center justify-center"
          title="Create or import a table"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
        </button>
      </div>

      {/* Create/Import Table Dialog */}
      <CreateTableDialog
        workspaceId={workspaceId}
        domainId={domainId}
        isOpen={showCreateTableDialog}
        onClose={() => setShowCreateTableDialog(false)}
        onCreated={(tableId) => {
          setShowCreateTableDialog(false);
          // Select the newly created table to open the edit dialog
          setSelectedTable(tableId);
        }}
      />
    </>
  );
};
