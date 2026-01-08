/**
 * Tag Filter Component
 * Filter resources by tags with support for Simple, Keyword, and Keyword:List formats
 */

import React, { useState, useCallback } from 'react';

export interface TagFilterProps {
  onFilterChange: (tags: string[]) => void;
  placeholder?: string;
  className?: string;
}

/**
 * TagFilter component with input and tooltip
 *
 * Tag formats supported:
 * - Simple: "production"
 * - Keyword: "env:production"
 * - Keyword with list: "env:production,staging"
 */
export const TagFilter: React.FC<TagFilterProps> = ({
  onFilterChange,
  placeholder = 'Filter by tags...',
  className = '',
}) => {
  const [filterValue, setFilterValue] = useState('');
  const [showTooltip, setShowTooltip] = useState(false);

  const handleFilterChange = useCallback(
    (value: string) => {
      setFilterValue(value);

      // Parse comma-separated tags
      const tags = value
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);

      onFilterChange(tags);
    },
    [onFilterChange]
  );

  const handleClear = useCallback(() => {
    setFilterValue('');
    onFilterChange([]);
  }, [onFilterChange]);

  return (
    <div className={`relative flex items-center gap-2 ${className}`}>
      <div className="relative flex-1">
        <input
          type="text"
          value={filterValue}
          onChange={(e) => handleFilterChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        />
        {filterValue && (
          <button
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            title="Clear filter"
          >
            ✕
          </button>
        )}
      </div>

      <div className="relative">
        <button
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          className="w-6 h-6 flex items-center justify-center rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 text-xs font-semibold"
          title="Tag format help"
        >
          ?
        </button>

        {showTooltip && (
          <div className="absolute left-0 top-8 z-50 w-80 bg-white border border-gray-300 rounded-lg shadow-lg p-4 text-sm">
            <h4 className="font-semibold text-gray-900 mb-2">Tag Filter Formats</h4>
            <div className="space-y-2 text-gray-700">
              <div>
                <span className="font-medium">Simple:</span>
                <code className="ml-2 px-1 bg-gray-100 rounded">production</code>
                <p className="text-xs text-gray-600 mt-1">
                  Matches any tag containing &quot;production&quot;
                </p>
              </div>
              <div>
                <span className="font-medium">Keyword:</span>
                <code className="ml-2 px-1 bg-gray-100 rounded">env:production</code>
                <p className="text-xs text-gray-600 mt-1">
                  Matches tags with key &quot;env&quot; and value &quot;production&quot;
                </p>
              </div>
              <div>
                <span className="font-medium">Keyword with list:</span>
                <code className="ml-2 px-1 bg-gray-100 rounded">product:food,beverage</code>
                <p className="text-xs text-gray-600 mt-1">
                  Matches tags with key &quot;product&quot; and value &quot;food&quot; or
                  &quot;beverage&quot;
                </p>
              </div>
              <div className="pt-2 border-t border-gray-200 mt-2">
                <p className="text-xs text-gray-600">
                  <span className="font-medium">Multiple filters:</span> Use commas to filter by
                  multiple tags
                </p>
                <code className="block mt-1 px-1 bg-gray-100 rounded">
                  env:production, product:food
                </code>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
