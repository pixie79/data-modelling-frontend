/**
 * Decision Panel Component
 * Main panel for viewing and managing MADR decisions within a domain
 */

import React, { useState } from 'react';
import { DecisionList } from './DecisionList';
import { DecisionEditor } from './DecisionEditor';
import { DecisionViewer } from './DecisionViewer';
import { useDecisionStore } from '@/stores/decisionStore';
import type { Decision } from '@/types/decision';

export interface DecisionPanelProps {
  workspacePath: string;
  domainId: string;
  className?: string;
}

type PanelMode = 'list' | 'view' | 'edit' | 'create';

export const DecisionPanel: React.FC<DecisionPanelProps> = ({
  workspacePath,
  domainId,
  className = '',
}) => {
  const { selectedDecision, setSelectedDecision } = useDecisionStore();
  const [mode, setMode] = useState<PanelMode>('list');

  const handleSelectDecision = (decision: Decision) => {
    setSelectedDecision(decision);
    setMode('view');
  };

  const handleCreateDecision = () => {
    setSelectedDecision(null);
    setMode('create');
  };

  const handleEditDecision = () => {
    setMode('edit');
  };

  const handleCloseViewer = () => {
    setSelectedDecision(null);
    setMode('list');
  };

  const handleSaveComplete = () => {
    setMode('view');
  };

  const handleCancelEdit = () => {
    if (selectedDecision) {
      setMode('view');
    } else {
      setMode('list');
    }
  };

  const handleDeleteComplete = () => {
    setSelectedDecision(null);
    setMode('list');
  };

  return (
    <div className={`flex h-full bg-white ${className}`}>
      {/* Left Panel - Decision List */}
      <div className="w-80 border-r border-gray-200 flex-shrink-0">
        <DecisionList
          workspacePath={workspacePath}
          domainId={domainId}
          onSelectDecision={handleSelectDecision}
          onCreateDecision={handleCreateDecision}
        />
      </div>

      {/* Right Panel - Viewer/Editor */}
      <div className="flex-1 overflow-hidden">
        {mode === 'list' && !selectedDecision && (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <svg
              className="w-16 h-16 text-gray-300 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="text-lg font-medium">No decision selected</p>
            <p className="text-sm mt-1">Select a decision from the list or create a new one</p>
            <button
              onClick={handleCreateDecision}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Create Decision
            </button>
          </div>
        )}

        {mode === 'view' && selectedDecision && (
          <DecisionViewer
            workspacePath={workspacePath}
            decision={selectedDecision}
            onEdit={handleEditDecision}
            onClose={handleCloseViewer}
          />
        )}

        {mode === 'edit' && selectedDecision && (
          <DecisionEditor
            workspacePath={workspacePath}
            decision={selectedDecision}
            domainId={domainId}
            onSave={handleSaveComplete}
            onCancel={handleCancelEdit}
            onDelete={handleDeleteComplete}
          />
        )}

        {mode === 'create' && (
          <DecisionEditor
            workspacePath={workspacePath}
            decision={null}
            domainId={domainId}
            onSave={handleSaveComplete}
            onCancel={handleCancelEdit}
          />
        )}
      </div>
    </div>
  );
};
