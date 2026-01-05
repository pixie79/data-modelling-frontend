/**
 * BPMN Link Component
 * Component for linking BPMN processes to compute assets
 * Supports creating/importing BPMN processes directly from the asset editor
 */

import React, { useState } from 'react';
import { useModelStore } from '@/stores/modelStore';
import { useUIStore } from '@/stores/uiStore';
import { EditorModal } from '@/components/editors/EditorModal';
import { bpmnService } from '@/services/sdk/bpmnService';

export interface BPMNLinkProps {
  assetId: string;
  domainId: string;
  currentLinkId?: string;
  onLinkChange: (processId: string | undefined) => void;
}

export const BPMNLink: React.FC<BPMNLinkProps> = ({ assetId, domainId, currentLinkId, onLinkChange }) => {
  const { bpmnProcesses, addBPMNProcess, selectedDomainId } = useModelStore();
  const { addToast } = useUIStore();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);

  // Filter BPMN processes for current domain
  const domainBPMNProcesses = bpmnProcesses.filter((p) => p.domain_id === domainId || p.domain_id === selectedDomainId);

  const handleSelect = (processId: string) => {
    if (processId === currentLinkId) {
      onLinkChange(undefined); // Unlink if same process selected
    } else {
      onLinkChange(processId);
    }
  };

  const handleCreateBPMN = async (xml: string, name: string) => {
    try {
      const process = await bpmnService.parseXML(xml);
      const newProcess = {
        ...process,
        id: crypto.randomUUID(),
        name: name.trim() || process.name || 'Untitled Process',
        domain_id: domainId || selectedDomainId || '',
      };
      addBPMNProcess(newProcess);
      onLinkChange(newProcess.id); // Automatically link the newly created process
      addToast({
        type: 'success',
        message: 'BPMN process created and linked',
      });
      setShowCreateDialog(false);
    } catch (error) {
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to create BPMN process',
      });
    }
  };

  const handleImportBPMN = async (file: File) => {
    try {
      const xml = await file.text();
      const process = await bpmnService.parseXML(xml);
      const newProcess = {
        ...process,
        id: crypto.randomUUID(),
        domain_id: domainId || selectedDomainId || '',
      };
      addBPMNProcess(newProcess);
      onLinkChange(newProcess.id); // Automatically link the imported process
      addToast({
        type: 'success',
        message: 'BPMN process imported and linked',
      });
      setShowImportDialog(false);
    } catch (error) {
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to import BPMN process',
      });
    }
  };

  return (
    <div>
      <label htmlFor={`bpmn-process-${assetId}`} className="block text-sm font-medium text-gray-700 mb-2">
        BPMN Process
      </label>
      
      {/* Action Buttons */}
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => setShowCreateDialog(true)}
          className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded hover:bg-purple-700"
          title="Create new BPMN process"
        >
          + Create BPMN
        </button>
        <button
          onClick={() => setShowImportDialog(true)}
          className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700"
          title="Import BPMN process from file"
        >
          Import BPMN
        </button>
      </div>

      {/* Existing Processes List */}
      {domainBPMNProcesses.length === 0 ? (
        <p className="text-sm text-gray-500">No BPMN processes available. Create or import one to link.</p>
      ) : (
        <div className="space-y-2">
          {domainBPMNProcesses.map((process) => (
            <label
              key={process.id}
              htmlFor={`bpmn-process-${process.id}`}
              className="flex items-center gap-2 p-2 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50"
            >
              <input
                id={`bpmn-process-${process.id}`}
                type="radio"
                name={`bpmn-link-${assetId}`}
                checked={process.id === currentLinkId}
                onChange={() => handleSelect(process.id)}
                className="text-blue-600 focus:ring-blue-500"
              />
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900">{process.name}</div>
              </div>
            </label>
          ))}
          {currentLinkId && (
            <button
              onClick={() => onLinkChange(undefined)}
              className="text-sm text-red-600 hover:text-red-800"
            >
              Unlink BPMN Process
            </button>
          )}
        </div>
      )}

      {/* Create BPMN Dialog */}
      <EditorModal
        type="bpmn"
        isOpen={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        title="Create BPMN Process"
        size="full"
        bpmnProps={{
          onSave: handleCreateBPMN,
        }}
      />

      {/* Import BPMN Dialog */}
      {showImportDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Import BPMN Process</h3>
            <input
              type="file"
              accept=".bpmn,.xml"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleImportBPMN(file);
                }
              }}
              className="w-full mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowImportDialog(false)}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

