/**
 * Export Dropdown Component
 * Provides export options for documents (Markdown, PDF) with OpenDataModelling branding
 */

import React, { useState, useRef, useEffect } from 'react';

export interface ExportOption {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  comingSoon?: boolean;
}

export interface ExportDropdownProps {
  options: ExportOption[];
  isExporting?: boolean;
  className?: string;
}

export const ExportDropdown: React.FC<ExportDropdownProps> = ({
  options,
  isExporting = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOptionClick = (option: ExportOption) => {
    if (option.disabled || option.comingSoon) return;
    option.onClick();
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isExporting}
        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
      >
        {isExporting ? (
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        )}
        Export
        <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-20 overflow-hidden">
          <div className="py-1">
            {options.map((option) => (
              <button
                key={option.id}
                onClick={() => handleOptionClick(option)}
                disabled={option.disabled || option.comingSoon}
                className={`w-full px-4 py-2 text-left flex items-start gap-3 ${
                  option.disabled || option.comingSoon
                    ? 'opacity-50 cursor-not-allowed bg-gray-50'
                    : 'hover:bg-gray-100'
                }`}
              >
                <span className="flex-shrink-0 mt-0.5 text-gray-500">{option.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">{option.label}</span>
                    {option.comingSoon && (
                      <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
                        Coming Soon
                      </span>
                    )}
                  </div>
                  {option.description && (
                    <p className="text-xs text-gray-500 mt-0.5">{option.description}</p>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Branding footer */}
          <div className="border-t border-gray-100 px-4 py-2 bg-gray-50">
            <p className="text-xs text-gray-400 text-center">Powered by opendatamodelling.com</p>
          </div>
        </div>
      )}
    </div>
  );
};

// Icon components for export options
export const MarkdownIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
    />
  </svg>
);

export const PDFIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
    />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h2m-2 2h4m-4 2h2" />
  </svg>
);

export const YAMLIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
    />
  </svg>
);

export default ExportDropdown;
