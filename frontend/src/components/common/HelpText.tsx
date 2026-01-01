/**
 * Help Text Component
 * Displays contextual help information
 */

import React from 'react';
import { Tooltip } from './Tooltip';

export interface HelpTextProps {
  text: string;
  title?: string;
  icon?: React.ReactNode;
  className?: string;
}

export const HelpText: React.FC<HelpTextProps> = ({
  text,
  title,
  icon,
  className = '',
}) => {
  const defaultIcon = (
    <svg
      className="w-4 h-4 text-gray-400"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );

  return (
    <Tooltip content={text} position="right" ariaLabel={title || 'Help'}>
      <div className={`inline-flex items-center ${className}`}>
        {icon || defaultIcon}
        {title && <span className="ml-2 text-sm text-gray-600">{title}</span>}
      </div>
    </Tooltip>
  );
};

export interface HelpSectionProps {
  title: string;
  items: Array<{ label: string; description: string }>;
}

export const HelpSection: React.FC<HelpSectionProps> = ({ title, items }) => {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-blue-900 mb-2">{title}</h3>
      <dl className="space-y-2">
        {items.map((item, index) => (
          <div key={index}>
            <dt className="text-sm font-medium text-blue-800">{item.label}</dt>
            <dd className="text-sm text-blue-700 ml-4">{item.description}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
};

