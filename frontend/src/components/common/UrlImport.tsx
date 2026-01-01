/**
 * URL Import Component
 * Allows importing data from web URLs
 */

import React, { useState } from 'react';

export interface UrlImportProps {
  onImport: (content: string) => void;
  label?: string;
  placeholder?: string;
}

export const UrlImport: React.FC<UrlImportProps> = ({
  onImport,
  label = 'Import from URL',
  placeholder = 'https://example.com/schema.yaml',
}) => {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateUrl = (urlString: string): boolean => {
    try {
      const urlObj = new URL(urlString);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const handleImport = async () => {
    if (!url.trim()) {
      setError('URL is required');
      return;
    }

    if (!validateUrl(url)) {
      setError('Invalid URL format');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const content = await response.text();
      onImport(content);
      setUrl(''); // Clear URL after successful import
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch content from URL');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleImport();
    }
  };

  return (
    <div className="space-y-2">
      <label htmlFor="url-import" className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      <div className="flex gap-2">
        <input
          id="url-import"
          type="url"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setError(null);
          }}
          onKeyPress={handleKeyPress}
          placeholder={placeholder}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={isLoading}
        />
        <button
          onClick={handleImport}
          disabled={isLoading || !url.trim()}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Loading...' : 'Import'}
        </button>
      </div>
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};

