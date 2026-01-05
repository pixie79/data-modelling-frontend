/**
 * BPMN Domain Process Dialog Component
 * Allows creating and editing domain-level BPMN processes
 */

import React, { useState, useEffect } from 'react';
import { useModelStore } from '@/stores/modelStore';
import { useUIStore } from '@/stores/uiStore';
import { EditorModal } from '@/components/editors/EditorModal';
import { bpmnService } from '@/services/sdk/bpmnService';
import type { BPMNProcess } from '@/types/bpmn';

export interface BPMNDomainProcessDialogProps {
  domainId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const BPMNDomainProcessDialog: React.FC<BPMNDomainProcessDialogProps> = ({
  domainId,
  isOpen,
  onClose,
}) => {
  const { bpmnProcesses, addBPMNProcess, updateBPMNProcess, removeBPMNProcess } = useModelStore();
  const { addToast } = useUIStore();
  const [showBPMNEditor, setShowBPMNEditor] = useState(false);
  const [editingProcessId, setEditingProcessId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  // Filter BPMN processes for this domain
  const domainBPMNProcesses = bpmnProcesses.filter((p) => p.domain_id === domainId);

  const handleCreateNew = () => {
    setEditingProcessId(null);
    setShowBPMNEditor(true);
  };

  const handleEdit = (processId: string) => {
    setEditingProcessId(processId);
    setShowBPMNEditor(true);
  };

  const handleDelete = async (processId: string) => {
    if (!window.confirm('Are you sure you want to delete this BPMN process?')) {
      return;
    }

    setIsDeleting(processId);
    try {
      removeBPMNProcess(processId);
      addToast({
        type: 'success',
        message: 'BPMN process deleted successfully',
      });
    } catch (error) {
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to delete BPMN process',
      });
    } finally {
      setIsDeleting(null);
    }
  };

  const handleSaveBPMN = async (xml: string, name: string) => {
    try {
      const process = await bpmnService.parseXML(xml);
      const processName = name.trim() || process.name || 'Untitled Process';

      if (editingProcessId) {
        // Update existing process
        updateBPMNProcess(editingProcessId, {
          ...process,
          id: editingProcessId,
          name: processName,
          domain_id: domainId,
        });
        addToast({
          type: 'success',
          message: 'BPMN process updated successfully',
        });
      } else {
        // Create new process
        const newProcess: BPMNProcess = {
          ...process,
          id: typeof crypto !== 'undefined' ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
          name: processName,
          domain_id: domainId,
          created_at: new Date().toISOString(),
          last_modified_at: new Date().toISOString(),
        };
        addBPMNProcess(newProcess);
        addToast({
          type: 'success',
          message: 'BPMN process created successfully',
        });
      }

      setShowBPMNEditor(false);
      setEditingProcessId(null);
    } catch (error) {
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to save BPMN process',
      });
    }
  };

  const editingProcess = editingProcessId
    ? bpmnProcesses.find((p) => p.id === editingProcessId)
    : null;

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">BPMN Domain Processes</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="mb-4 flex justify-end">
              <button
                onClick={handleCreateNew}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 flex items-center gap-2"
              >
                <span>+</span>
                <span>Create New BPMN Process</span>
              </button>
            </div>

            {domainBPMNProcesses.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p className="text-lg mb-2">No BPMN processes found</p>
                <p className="text-sm">Create a new BPMN process to model domain-level business processes</p>
              </div>
            ) : (
              <div className="space-y-3">
                {domainBPMNProcesses.map((process) => (
                  <div
                    key={process.id}
                    className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-medium text-gray-900">{process.name}</h3>
                        <p className="text-sm text-gray-500 mt-1">
                          Created: {new Date(process.created_at).toLocaleDateString()}
                          {process.last_modified_at !== process.created_at && (
                            <span className="ml-2">
                              • Modified: {new Date(process.last_modified_at).toLocaleDateString()}
                            </span>
                          )}
                        </p>
                        {process.linked_assets && process.linked_assets.length > 0 && (
                          <p className="text-xs text-gray-400 mt-1">
                            Linked to {process.linked_assets.length} compute asset(s)
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <button
                          onClick={() => handleEdit(process.id)}
                          className="px-3 py-1 text-sm font-medium text-blue-700 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
                          title="Edit BPMN process"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(process.id)}
                          disabled={isDeleting === process.id}
                          className="px-3 py-1 text-sm font-medium text-red-700 bg-red-50 rounded hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Delete BPMN process"
                        >
                          {isDeleting === process.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
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
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* BPMN Editor Modal */}
      {showBPMNEditor && (
        <EditorModal
          type="bpmn"
          isOpen={showBPMNEditor}
          onClose={() => {
            setShowBPMNEditor(false);
            setEditingProcessId(null);
          }}
          title={editingProcessId ? `Edit BPMN Process: ${editingProcess?.name || ''}` : 'Create New BPMN Process'}
          size="full"
          bpmnProps={{
            xml: editingProcess?.bpmn_xml,
            name: editingProcess?.name,
            onSave: handleSaveBPMN,
          }}
        />
      )}
    </>
  );
};

