/**
 * Decision Category Badge Component
 * Displays color-coded category badge for decisions
 */

import React from 'react';
import {
  DecisionCategory,
  getDecisionCategoryLabel,
  getDecisionCategoryColor,
} from '@/types/decision';

export interface DecisionCategoryBadgeProps {
  category: DecisionCategory;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

const categoryIcons: Record<DecisionCategory, string> = {
  [DecisionCategory.Architecture]:
    'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
  [DecisionCategory.Technology]:
    'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  [DecisionCategory.Process]:
    'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
  [DecisionCategory.Security]:
    'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  [DecisionCategory.Data]:
    'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4',
  [DecisionCategory.Integration]:
    'M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
};

export const DecisionCategoryBadge: React.FC<DecisionCategoryBadgeProps> = ({
  category,
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

  const color = getDecisionCategoryColor(category);
  const colorClasses: Record<string, string> = {
    indigo: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    cyan: 'bg-cyan-100 text-cyan-800 border-cyan-300',
    teal: 'bg-teal-100 text-teal-800 border-teal-300',
    red: 'bg-red-100 text-red-800 border-red-300',
    violet: 'bg-violet-100 text-violet-800 border-violet-300',
    amber: 'bg-amber-100 text-amber-800 border-amber-300',
  };

  return (
    <span
      className={`
        inline-flex items-center gap-1 font-medium rounded border
        ${sizeClasses[size]}
        ${colorClasses[color] || colorClasses.indigo}
      `}
      title={`Category: ${getDecisionCategoryLabel(category)}`}
    >
      {showIcon && (
        <svg className={iconSizes[size]} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d={categoryIcons[category]}
          />
        </svg>
      )}
      {getDecisionCategoryLabel(category)}
    </span>
  );
};
