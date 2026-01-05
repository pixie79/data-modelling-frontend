/**
 * DMN Link Component
 * Component for linking DMN decisions to compute assets
 * Supports creating/importing DMN decisions directly from the asset editor
 */

import React, { useState } from 'react';
import { useModelStore } from '@/stores/modelStore';
import { useUIStore } from '@/stores/uiStore';
import { EditorModal } from '@/components/editors/EditorModal';
import { dmnService } from '@/services/sdk/dmnService';

export interface DMNLinkProps {
  assetId: string;
  domainId: string;
  currentLinkId?: string;
  onLinkChange: (decisionId: string | undefined) => void;
}

export const DMNLink: React.FC<DMNLinkProps> = ({ assetId, domainId, currentLinkId, onLinkChange }) => {
  const { dmnDecisions, addDMNDecision, selectedDomainId } = useModelStore();
  const { addToast } = useUIStore();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);

  // Filter DMN decisions for current domain
  const domainDMNDecisions = dmnDecisions.filter((d) => d.domain_id === domainId || d.domain_id === selectedDomainId);

  const handleSelect = (decisionId: string) => {
    if (decisionId === currentLinkId) {
      onLinkChange(undefined); // Unlink if same decision selected
    } else {
      onLinkChange(decisionId);
    }
  };

  const handleCreateDMN = async (xml: string, name: string) => {
    try {
      const decision = await dmnService.parseXML(xml);
      const newDecision = {
        ...decision,
        id: crypto.randomUUID(),
        name: name.trim() || decision.name || 'Untitled Decision',
        domain_id: domainId || selectedDomainId || '',
      };
      addDMNDecision(newDecision);
      onLinkChange(newDecision.id); // Automatically link the newly created decision
      addToast({
        type: 'success',
        message: 'DMN decision created and linked',
      });
      setShowCreateDialog(false);
    } catch (error) {
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to create DMN decision',
      });
    }
  };

  const handleImportDMN = async (file: File) => {
    try {
      const xml = await file.text();
      const decision = await dmnService.parseXML(xml);
      const newDecision = {
        ...decision,
        id: crypto.randomUUID(),
        domain_id: domainId || selectedDomainId || '',
      };
      addDMNDecision(newDecision);
      onLinkChange(newDecision.id); // Automatically link the imported decision
      addToast({
        type: 'success',
        message: 'DMN decision imported and linked',
      });
      setShowImportDialog(false);
    } catch (error) {
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to import DMN decision',
      });
    }
  };

  return (
    <div>
      <label htmlFor={`dmn-decision-${assetId}`} className="block text-sm font-medium text-gray-700 mb-2">
        DMN Decision
      </label>
      
      {/* Action Buttons */}
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => setShowCreateDialog(true)}
          className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded hover:bg-purple-700"
          title="Create new DMN decision"
        >
          + Create DMN
        </button>
        <button
          onClick={() => setShowImportDialog(true)}
          className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700"
          title="Import DMN decision from file"
        >
          Import DMN
        </button>
      </div>

      {/* Existing Decisions List */}
      {domainDMNDecisions.length === 0 ? (
        <p className="text-sm text-gray-500">No DMN decisions available. Create or import one to link.</p>
      ) : (
        <div className="space-y-2">
          {domainDMNDecisions.map((decision) => (
            <label
              key={decision.id}
              htmlFor={`dmn-decision-${decision.id}`}
              className="flex items-center gap-2 p-2 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50"
            >
              <input
                id={`dmn-decision-${decision.id}`}
                type="radio"
                name={`dmn-link-${assetId}`}
                checked={decision.id === currentLinkId}
                onChange={() => handleSelect(decision.id)}
                className="text-blue-600 focus:ring-blue-500"
              />
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900">{decision.name}</div>
              </div>
            </label>
          ))}
          {currentLinkId && (
            <button
              onClick={() => onLinkChange(undefined)}
              className="text-sm text-red-600 hover:text-red-800"
            >
              Unlink DMN Decision
            </button>
          )}
        </div>
      )}

      {/* Create DMN Dialog */}
      <EditorModal
        type="dmn"
        isOpen={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        title="Create DMN Decision"
        size="full"
        dmnProps={{
          xml: undefined, // Create new decision
          onSave: handleCreateDMN,
        }}
      />

      {/* Import DMN Dialog */}
      {showImportDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Import DMN Decision</h3>
            <input
              type="file"
              accept=".dmn,.xml"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleImportDMN(file);
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

