/**
 * Paste Import Component
 * Allows importing data by pasting content
 */

import React, { useState } from 'react';

export interface PasteImportProps {
  onImport: (content: string) => void;
  label?: string;
  placeholder?: string;
  rows?: number;
}

export const PasteImport: React.FC<PasteImportProps> = ({
  onImport,
  label = 'Paste Content',
  placeholder = 'Paste your schema content here...',
  rows = 10,
}) => {
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleImport = () => {
    if (!content.trim()) {
      setError('Content is required');
      return;
    }

    setError(null);
    onImport(content);
    setContent(''); // Clear content after import
  };

  const handlePaste = () => {
    // Clear error when user starts typing/pasting
    if (error) {
      setError(null);
    }
  };

  return (
    <div className="space-y-2">
      <label htmlFor="paste-import" className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      <textarea
        id="paste-import"
        value={content}
        onChange={(e) => {
          setContent(e.target.value);
          setError(null);
        }}
        onPaste={handlePaste}
        placeholder={placeholder}
        rows={rows}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
      />
      <div className="flex items-center justify-between">
        <button
          onClick={handleImport}
          disabled={!content.trim()}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Import
        </button>
        {content && (
          <span className="text-sm text-gray-500">
            {content.length} characters
          </span>
        )}
      </div>
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};

