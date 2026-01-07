/**
 * Decision Status Badge Component
 * Displays color-coded status badge for decisions
 */

import React from 'react';
import { DecisionStatus, getDecisionStatusLabel, getDecisionStatusColor } from '@/types/decision';

export interface DecisionStatusBadgeProps {
  status: DecisionStatus;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

const statusIcons: Record<DecisionStatus, string> = {
  [DecisionStatus.Draft]:
    'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  [DecisionStatus.Proposed]:
    'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  [DecisionStatus.Accepted]: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  [DecisionStatus.Deprecated]:
    'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
  [DecisionStatus.Superseded]:
    'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
  [DecisionStatus.Rejected]: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
};

export const DecisionStatusBadge: React.FC<DecisionStatusBadgeProps> = ({
  status,
  size = 'md',
  showIcon = false,
}) => {
  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-xs px-2 py-1',
    lg: 'text-sm px-3 py-1.5',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4',
  };

  const color = getDecisionStatusColor(status);
  const colorClasses: Record<string, string> = {
    gray: 'bg-gray-100 text-gray-800 border-gray-300',
    blue: 'bg-blue-100 text-blue-800 border-blue-300',
    green: 'bg-green-100 text-green-800 border-green-300',
    orange: 'bg-orange-100 text-orange-800 border-orange-300',
    purple: 'bg-purple-100 text-purple-800 border-purple-300',
    red: 'bg-red-100 text-red-800 border-red-300',
  };

  return (
    <span
      className={`
        inline-flex items-center gap-1 font-medium rounded border
        ${sizeClasses[size]}
        ${colorClasses[color] || colorClasses.gray}
      `}
      title={`Status: ${getDecisionStatusLabel(status)}`}
    >
      {showIcon && (
        <svg className={iconSizes[size]} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d={statusIcons[status]}
          />
        </svg>
      )}
      {getDecisionStatusLabel(status)}
    </span>
  );
};
