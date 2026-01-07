/**
 * Knowledge Search Component
 * Search interface for knowledge articles with results display
 */

import React, { useState, useCallback } from 'react';
import { useKnowledgeStore } from '@/stores/knowledgeStore';
import { ArticleTypeBadge } from './ArticleTypeBadge';
import { ArticleStatusBadge } from './ArticleStatusBadge';
import type { KnowledgeArticle, KnowledgeSearchResult } from '@/types/knowledge';
import { formatArticleNumber } from '@/types/knowledge';

export interface KnowledgeSearchProps {
  workspacePath: string;
  onSelectArticle?: (article: KnowledgeArticle) => void;
  className?: string;
}

export const KnowledgeSearch: React.FC<KnowledgeSearchProps> = ({
  workspacePath,
  onSelectArticle,
  className = '',
}) => {
  const { searchQuery, searchResults, isSearching, search, clearSearch } = useKnowledgeStore();

  const [inputValue, setInputValue] = useState(searchQuery);

  // Debounced search
  const handleSearchChange = useCallback(
    (value: string) => {
      setInputValue(value);

      // Debounce the actual search
      const timer = setTimeout(() => {
        if (value.trim()) {
          search(workspacePath, value);
        } else {
          clearSearch();
        }
      }, 300);

      return () => clearTimeout(timer);
    },
    [workspacePath, search, clearSearch]
  );

  const handleClear = () => {
    setInputValue('');
    clearSearch();
  };

  const handleResultClick = (result: KnowledgeSearchResult) => {
    onSelectArticle?.(result.article);
  };

  const highlightText = (text: string, query: string): React.ReactNode => {
    if (!query.trim()) return text;

    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={i} className="bg-yellow-200 px-0.5 rounded">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <div className={`flex flex-col ${className}`}>
      {/* Search Input */}
      <div className="relative">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search knowledge base..."
          className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
        />
        <svg
          className="absolute left-3 top-3.5 w-5 h-5 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        {inputValue && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Search Status */}
      {isSearching && (
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-sm text-gray-600">Searching...</span>
        </div>
      )}

      {/* Search Results */}
      {!isSearching && searchQuery && (
        <div className="mt-4">
          {searchResults.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <svg
                className="mx-auto w-12 h-12 text-gray-300 mb-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="font-medium">No results found</p>
              <p className="text-sm mt-1">Try different keywords or check your spelling</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-500">
                Found {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for
                &quot;{searchQuery}&quot;
              </p>

              {searchResults.map((result) => (
                <div
                  key={result.article.id}
                  onClick={() => handleResultClick(result)}
                  className="p-4 bg-white border border-gray-200 rounded-lg cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-gray-500">
                          KB-{formatArticleNumber(result.article.number)}
                        </span>
                        <ArticleTypeBadge type={result.article.type} size="sm" />
                        <ArticleStatusBadge status={result.article.status} size="sm" />
                      </div>

                      <h3 className="font-medium text-gray-900">
                        {result.highlights?.title
                          ? highlightText(result.article.title, searchQuery)
                          : result.article.title}
                      </h3>

                      {result.article.summary && (
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                          {result.highlights?.summary
                            ? highlightText(result.article.summary, searchQuery)
                            : result.article.summary}
                        </p>
                      )}

                      {result.highlights?.content && (
                        <p className="text-sm text-gray-500 mt-2 italic line-clamp-1">
                          ...{highlightText(result.highlights.content, searchQuery)}...
                        </p>
                      )}
                    </div>

                    {/* Relevance Score */}
                    <div className="flex-shrink-0">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-medium"
                        style={{
                          backgroundColor: `rgba(59, 130, 246, ${result.score})`,
                          color: result.score > 0.5 ? 'white' : 'rgb(59, 130, 246)',
                        }}
                        title={`Relevance: ${Math.round(result.score * 100)}%`}
                      >
                        {Math.round(result.score * 100)}%
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                    <span>Updated {new Date(result.article.updated_at).toLocaleDateString()}</span>
                    {result.article.authors.length > 0 && (
                      <span>By {result.article.authors[0]}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Empty State (no search) */}
      {!searchQuery && !isSearching && (
        <div className="mt-8 text-center text-gray-500">
          <svg
            className="mx-auto w-16 h-16 text-gray-300 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <p className="text-lg font-medium">Search the Knowledge Base</p>
          <p className="text-sm mt-1">Find guides, references, tutorials, and more</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <span className="px-2 py-1 text-xs bg-gray-100 rounded">guides</span>
            <span className="px-2 py-1 text-xs bg-gray-100 rounded">tutorials</span>
            <span className="px-2 py-1 text-xs bg-gray-100 rounded">troubleshooting</span>
            <span className="px-2 py-1 text-xs bg-gray-100 rounded">runbooks</span>
          </div>
        </div>
      )}
    </div>
  );
};
