/**
 * Decision Workflow Component
 * Visual status progression with one-click status transitions
 */

import React, { useState } from 'react';
import { useDecisionStore } from '@/stores/decisionStore';
import type { Decision } from '@/types/decision';
import {
  DecisionStatus,
  getDecisionStatusLabel,
  getDecisionStatusColor,
  VALID_STATUS_TRANSITIONS,
  isValidStatusTransition,
} from '@/types/decision';

export interface DecisionWorkflowProps {
  workspacePath: string;
  decision: Decision;
  onStatusChange?: (newStatus: DecisionStatus) => void;
  compact?: boolean;
  className?: string;
}

const WORKFLOW_ORDER: DecisionStatus[] = [
  DecisionStatus.Draft,
  DecisionStatus.Proposed,
  DecisionStatus.Accepted,
  DecisionStatus.Deprecated,
];

const TERMINAL_STATES: DecisionStatus[] = [DecisionStatus.Rejected, DecisionStatus.Superseded];

export const DecisionWorkflow: React.FC<DecisionWorkflowProps> = ({
  workspacePath: _workspacePath,
  decision,
  onStatusChange,
  compact = false,
  className = '',
}) => {
  const { changeDecisionStatus, isSaving } = useDecisionStore();
  const [hoveredStatus, setHoveredStatus] = useState<DecisionStatus | null>(null);
  const [showSupersede, setShowSupersede] = useState(false);

  const currentIndex = WORKFLOW_ORDER.indexOf(decision.status);
  const isTerminal = TERMINAL_STATES.includes(decision.status);

  const handleStatusClick = (targetStatus: DecisionStatus) => {
    if (isSaving) return;
    if (!isValidStatusTransition(decision.status, targetStatus)) return;

    const updated = changeDecisionStatus(decision.id, targetStatus);
    if (updated) {
      onStatusChange?.(targetStatus);
    }
  };

  const availableTransitions = VALID_STATUS_TRANSITIONS[decision.status];

  const getStatusColorClasses = (status: DecisionStatus, isActive: boolean, isPast: boolean) => {
    const color = getDecisionStatusColor(status);

    if (isActive) {
      const activeColors: Record<string, string> = {
        gray: 'bg-gray-500 text-white border-gray-500',
        blue: 'bg-blue-500 text-white border-blue-500',
        green: 'bg-green-500 text-white border-green-500',
        orange: 'bg-orange-500 text-white border-orange-500',
        purple: 'bg-purple-500 text-white border-purple-500',
        red: 'bg-red-500 text-white border-red-500',
      };
      return activeColors[color] || activeColors.gray;
    }

    if (isPast) {
      const pastColors: Record<string, string> = {
        gray: 'bg-gray-100 text-gray-600 border-gray-300',
        blue: 'bg-blue-100 text-blue-600 border-blue-300',
        green: 'bg-green-100 text-green-600 border-green-300',
        orange: 'bg-orange-100 text-orange-600 border-orange-300',
        purple: 'bg-purple-100 text-purple-600 border-purple-300',
        red: 'bg-red-100 text-red-600 border-red-300',
      };
      return pastColors[color] || pastColors.gray;
    }

    return 'bg-white text-gray-400 border-gray-200';
  };

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {availableTransitions.length > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500">Move to:</span>
            {availableTransitions.map((status) => (
              <button
                key={status}
                onClick={() => handleStatusClick(status)}
                disabled={isSaving}
                className={`px-2 py-1 text-xs font-medium rounded border transition-colors
                  ${getStatusColorClasses(status, false, false)}
                  hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed
                `}
              >
                {getDecisionStatusLabel(status)}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`${className}`}>
      {/* Main Workflow */}
      <div className="flex items-center justify-between mb-4">
        {WORKFLOW_ORDER.map((status, index) => {
          const isActive = decision.status === status;
          const isPast = !isTerminal && currentIndex > index;
          const canTransition = isValidStatusTransition(decision.status, status);
          const isHovered = hoveredStatus === status;

          return (
            <React.Fragment key={status}>
              {/* Status Node */}
              <div
                className="flex flex-col items-center"
                onMouseEnter={() => canTransition && setHoveredStatus(status)}
                onMouseLeave={() => setHoveredStatus(null)}
              >
                <button
                  onClick={() => canTransition && handleStatusClick(status)}
                  disabled={!canTransition || isSaving}
                  className={`
                    relative w-10 h-10 rounded-full border-2 flex items-center justify-center
                    transition-all duration-200
                    ${getStatusColorClasses(status, isActive, isPast)}
                    ${canTransition && !isSaving ? 'cursor-pointer hover:scale-110' : 'cursor-default'}
                    ${isHovered ? 'ring-2 ring-offset-2 ring-blue-400' : ''}
                  `}
                  title={
                    canTransition
                      ? `Click to change status to ${getDecisionStatusLabel(status)}`
                      : getDecisionStatusLabel(status)
                  }
                >
                  {isActive && (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                  {isPast && !isActive && (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                  {!isActive && !isPast && <span className="text-xs font-bold">{index + 1}</span>}
                </button>
                <span
                  className={`mt-2 text-xs font-medium ${
                    isActive ? 'text-gray-900' : isPast ? 'text-gray-600' : 'text-gray-400'
                  }`}
                >
                  {getDecisionStatusLabel(status)}
                </span>
              </div>

              {/* Connector Line */}
              {index < WORKFLOW_ORDER.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 ${
                    isPast || isActive ? 'bg-gray-300' : 'bg-gray-200'
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Terminal States (if applicable) */}
      {(decision.status === DecisionStatus.Rejected ||
        decision.status === DecisionStatus.Superseded ||
        availableTransitions.includes(DecisionStatus.Rejected) ||
        availableTransitions.includes(DecisionStatus.Superseded)) && (
        <div className="flex items-center justify-center gap-4 pt-4 border-t border-gray-200">
          {/* Rejected */}
          {(decision.status === DecisionStatus.Rejected ||
            availableTransitions.includes(DecisionStatus.Rejected)) && (
            <button
              onClick={() => handleStatusClick(DecisionStatus.Rejected)}
              disabled={decision.status === DecisionStatus.Rejected || isSaving}
              className={`
                px-4 py-2 text-sm font-medium rounded-md border transition-colors
                ${
                  decision.status === DecisionStatus.Rejected
                    ? 'bg-red-500 text-white border-red-500'
                    : 'bg-white text-red-600 border-red-300 hover:bg-red-50'
                }
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
            >
              {decision.status === DecisionStatus.Rejected ? 'Rejected' : 'Reject'}
            </button>
          )}

          {/* Superseded */}
          {(decision.status === DecisionStatus.Superseded ||
            availableTransitions.includes(DecisionStatus.Superseded)) && (
            <button
              onClick={() =>
                decision.status !== DecisionStatus.Superseded && setShowSupersede(true)
              }
              disabled={decision.status === DecisionStatus.Superseded || isSaving}
              className={`
                px-4 py-2 text-sm font-medium rounded-md border transition-colors
                ${
                  decision.status === DecisionStatus.Superseded
                    ? 'bg-purple-500 text-white border-purple-500'
                    : 'bg-white text-purple-600 border-purple-300 hover:bg-purple-50'
                }
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
            >
              {decision.status === DecisionStatus.Superseded ? 'Superseded' : 'Supersede'}
            </button>
          )}
        </div>
      )}

      {/* Supersede Dialog */}
      {showSupersede && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Supersede Decision</h3>
            <p className="text-sm text-gray-600 mb-4">
              To supersede this decision, you should create a new decision that references this one.
              This action will mark this decision as superseded.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowSupersede(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleStatusClick(DecisionStatus.Superseded);
                  setShowSupersede(false);
                }}
                disabled={isSaving}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:opacity-50"
              >
                Mark as Superseded
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
