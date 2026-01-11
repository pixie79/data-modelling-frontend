/**
 * Unlinked Tables Dialog
 * Dialog for managing tables that are not linked to any system
 * Allows creating new systems or linking to existing systems
 */

import React, { useState, useMemo } from 'react';
import { useModelStore } from '@/stores/modelStore';
import { useUIStore } from '@/stores/uiStore';
import { CreateSystemDialog } from './CreateSystemDialog';

export interface UnlinkedTablesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  domainId: string;
}

export const UnlinkedTablesDialog: React.FC<UnlinkedTablesDialogProps> = ({
  isOpen,
  onClose,
  domainId,
}) => {
  const { tables, systems, updateSystem } = useModelStore();
  const { addToast } = useUIStore();

  const [_selectedTableId, _setSelectedTableId] = useState<string | null>(null);
  const [showCreateSystemDialog, setShowCreateSystemDialog] = useState(false);
  const [creatingSystemForTable, setCreatingSystemForTable] = useState<string | null>(null);

  // Find unlinked tables (tables that don't appear in any system's table_ids)
  const unlinkedTables = useMemo(() => {
    const allTableIdsInSystems = new Set(
      systems.filter((s) => s.domain_id === domainId).flatMap((s) => s.table_ids || [])
    );

    return tables.filter(
      (t) => t.primary_domain_id === domainId && !allTableIdsInSystems.has(t.id)
    );
  }, [tables, systems, domainId]);

  // Get systems in the current domain
  const domainSystems = useMemo(() => {
    return systems.filter((s) => s.domain_id === domainId);
  }, [systems, domainId]);

  const handleLinkToSystem = (tableId: string, systemId: string) => {
    const system = systems.find((s) => s.id === systemId);
    if (!system) return;

    const currentTableIds = system.table_ids || [];
    if (currentTableIds.includes(tableId)) {
      addToast({
        type: 'info',
        message: 'Table is already linked to this system',
      });
      return;
    }

    updateSystem(systemId, {
      table_ids: [...currentTableIds, tableId],
    });

    addToast({
      type: 'success',
      message: `Linked "${tables.find((t) => t.id === tableId)?.name || 'table'}" to "${system.name}"`,
    });
  };

  const handleCreateSystemForTable = (tableId: string) => {
    setCreatingSystemForTable(tableId);
    setShowCreateSystemDialog(true);
  };

  const handleSystemCreated = (systemId: string) => {
    if (creatingSystemForTable) {
      // Link the table to the newly created system
      handleLinkToSystem(creatingSystemForTable, systemId);
      setCreatingSystemForTable(null);
    }
    setShowCreateSystemDialog(false);
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Unlinked Tables</h2>
              <p className="text-sm text-gray-500 mt-1">
                {unlinkedTables.length} table{unlinkedTables.length !== 1 ? 's' : ''} not linked to
                any system
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              title="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {unlinkedTables.length === 0 ? (
              <div className="text-center py-12">
                <svg
                  className="mx-auto h-12 w-12 text-green-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <h3 className="mt-4 text-lg font-medium text-gray-900">All tables are linked!</h3>
                <p className="mt-2 text-sm text-gray-500">
                  All tables in this domain are linked to systems.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {unlinkedTables.map((table) => (
                  <div
                    key={table.id}
                    className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-medium text-gray-900">{table.name}</h3>
                        {table.description && (
                          <p className="text-sm text-gray-500 mt-1">{table.description}</p>
                        )}
                        <div className="mt-2 flex flex-wrap gap-2">
                          {table.data_level && (
                            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                              {table.data_level}
                            </span>
                          )}
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800">
                            {table.columns.length} column{table.columns.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {/* Link to existing system */}
                      {domainSystems.length > 0 && (
                        <div className="flex-1 min-w-[200px]">
                          <label
                            htmlFor={`link-system-${table.id}`}
                            className="block text-xs font-medium text-gray-700 mb-1"
                          >
                            Link to existing system:
                          </label>
                          <select
                            id={`link-system-${table.id}`}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            onChange={(e) => {
                              if (e.target.value) {
                                handleLinkToSystem(table.id, e.target.value);
                              }
                            }}
                            value=""
                          >
                            <option value="">Select a system...</option>
                            {domainSystems.map((system) => (
                              <option key={system.id} value={system.id}>
                                {system.name} ({system.system_type})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Create new system for this table */}
                      <button
                        onClick={() => handleCreateSystemForTable(table.id)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium whitespace-nowrap"
                      >
                        Create New System
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors text-sm font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Create System Dialog */}
      {showCreateSystemDialog && (
        <CreateSystemDialog
          domainId={domainId}
          isOpen={showCreateSystemDialog}
          onClose={() => {
            setShowCreateSystemDialog(false);
            setCreatingSystemForTable(null);
          }}
          onCreated={handleSystemCreated}
          linkTableId={creatingSystemForTable || undefined}
        />
      )}
    </>
  );
};
