/**
 * Article Status Badge Component
 * Displays color-coded status badge for knowledge articles
 */

import React from 'react';
import { ArticleStatus, getArticleStatusLabel, getArticleStatusColor } from '@/types/knowledge';

export interface ArticleStatusBadgeProps {
  status: ArticleStatus;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

const statusIcons: Record<ArticleStatus, string> = {
  [ArticleStatus.Draft]:
    'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  [ArticleStatus.Review]:
    'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
  [ArticleStatus.Published]: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  [ArticleStatus.Archived]:
    'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4',
  [ArticleStatus.Deprecated]:
    'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636',
};

export const ArticleStatusBadge: React.FC<ArticleStatusBadgeProps> = ({
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

  const color = getArticleStatusColor(status);
  const colorClasses: Record<string, string> = {
    gray: 'bg-gray-100 text-gray-800 border-gray-300',
    yellow: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    green: 'bg-green-100 text-green-800 border-green-300',
    slate: 'bg-slate-100 text-slate-800 border-slate-300',
    red: 'bg-red-100 text-red-800 border-red-300',
  };

  return (
    <span
      className={`
        inline-flex items-center gap-1 font-medium rounded border
        ${sizeClasses[size]}
        ${colorClasses[color] || colorClasses.gray}
      `}
      title={`Status: ${getArticleStatusLabel(status)}`}
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
      {getArticleStatusLabel(status)}
    </span>
  );
};
