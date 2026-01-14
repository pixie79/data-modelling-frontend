/**
 * Knowledge List Component
 * Displays a list of knowledge articles with filtering and sorting
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useKnowledgeStore } from '@/stores/knowledgeStore';
import { ArticleTypeBadge } from './ArticleTypeBadge';
import { ArticleStatusBadge } from './ArticleStatusBadge';
import { ArticleImportDialog } from './ArticleImportDialog';
import type { KnowledgeArticle } from '@/types/knowledge';
import {
  ArticleType,
  ArticleStatus,
  formatArticleNumber,
  getArticleTypeLabel,
  getArticleStatusLabel,
} from '@/types/knowledge';

export interface KnowledgeListProps {
  workspacePath: string;
  domainId?: string;
  onSelectArticle?: (article: KnowledgeArticle) => void;
  onCreateArticle?: () => void;
  className?: string;
}

type SortField = 'number' | 'title' | 'type' | 'updated_at';
type SortOrder = 'asc' | 'desc';

export const KnowledgeList: React.FC<KnowledgeListProps> = ({
  workspacePath: _workspacePath,
  domainId,
  onSelectArticle,
  onCreateArticle,
  className = '',
}) => {
  const {
    filteredArticles,
    selectedArticle,
    filter,
    isLoading,
    error,
    setFilter,
    setSelectedArticle,
  } = useKnowledgeStore();

  const [searchInput, setSearchInput] = useState(filter.search || '');
  const [sortField, setSortField] = useState<SortField>('number');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [showFilters, setShowFilters] = useState(false);
  const [showNewDropdown, setShowNewDropdown] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const newDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (newDropdownRef.current && !newDropdownRef.current.contains(event.target as Node)) {
        setShowNewDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Set domain filter on mount if provided
  React.useEffect(() => {
    if (domainId) {
      setFilter({ ...filter, domain_id: domainId });
    }
  }, [domainId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced search - use functional update to avoid filter in dependencies
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setFilter((prev) => ({ ...prev, search: searchInput || undefined }));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, setFilter]);

  // Sort articles
  const sortedArticles = useMemo(() => {
    const sorted = [...filteredArticles];
    sorted.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'number':
          comparison = a.number - b.number;
          break;
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'type':
          comparison = a.type.localeCompare(b.type);
          break;
        case 'updated_at':
          comparison = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    return sorted;
  }, [filteredArticles, sortField, sortOrder]);

  const handleArticleClick = (article: KnowledgeArticle) => {
    setSelectedArticle(article);
    onSelectArticle?.(article);
  };

  const handleTypeFilterChange = (type: ArticleType, checked: boolean) => {
    const currentTypes = filter.type || [];
    const newTypes = checked ? [...currentTypes, type] : currentTypes.filter((t) => t !== type);
    setFilter({ ...filter, type: newTypes.length > 0 ? newTypes : undefined });
  };

  const handleStatusFilterChange = (status: ArticleStatus, checked: boolean) => {
    const currentStatuses = filter.status || [];
    const newStatuses = checked
      ? [...currentStatuses, status]
      : currentStatuses.filter((s) => s !== status);
    setFilter({ ...filter, status: newStatuses.length > 0 ? newStatuses : undefined });
  };

  const clearFilters = () => {
    setSearchInput('');
    setFilter({ domain_id: domainId });
  };

  const hasActiveFilters = !!(filter.type?.length || filter.status?.length || filter.search);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  if (isLoading) {
    return (
      <div className={`p-4 ${className}`}>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">Loading articles...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-4 ${className}`}>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
          <button
            onClick={() => setFilter({ domain_id: domainId })}
            className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Knowledge Base</h2>
        {onCreateArticle && (
          <div ref={newDropdownRef} className="relative">
            <button
              onClick={() => setShowNewDropdown(!showNewDropdown)}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              New Article
              <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
            {showNewDropdown && (
              <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
                <div className="py-1">
                  <button
                    onClick={() => {
                      onCreateArticle();
                      setShowNewDropdown(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                  >
                    <svg
                      className="w-4 h-4 text-gray-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                    New Article
                  </button>
                  <button
                    onClick={() => {
                      setShowImportDialog(true);
                      setShowNewDropdown(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                  >
                    <svg
                      className="w-4 h-4 text-gray-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                      />
                    </svg>
                    Import from YAML
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Import Dialog */}
      <ArticleImportDialog
        isOpen={showImportDialog}
        onClose={() => setShowImportDialog(false)}
        domainId={domainId}
      />

      {/* Search and Filters */}
      <div className="p-4 border-b border-gray-200 space-y-3">
        {/* Search */}
        <div className="relative">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search articles..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <svg
            className="absolute left-3 top-2.5 w-5 h-5 text-gray-400"
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
        </div>

        {/* Filter Toggle */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-800"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
              />
            </svg>
            Filters
            {hasActiveFilters && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-blue-100 text-blue-800 rounded-full">
                Active
              </span>
            )}
          </button>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="text-sm text-gray-500 hover:text-gray-700">
              Clear filters
            </button>
          )}
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="grid grid-cols-2 gap-4 p-3 bg-gray-50 rounded-lg">
            {/* Type Filter */}
            <div>
              <h4 className="text-xs font-medium text-gray-700 mb-2">Type</h4>
              <div className="space-y-1">
                {Object.values(ArticleType).map((type) => (
                  <label key={type} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={filter.type?.includes(type) || false}
                      onChange={(e) => handleTypeFilterChange(type, e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    {getArticleTypeLabel(type)}
                  </label>
                ))}
              </div>
            </div>

            {/* Status Filter */}
            <div>
              <h4 className="text-xs font-medium text-gray-700 mb-2">Status</h4>
              <div className="space-y-1">
                {Object.values(ArticleStatus).map((status) => (
                  <label key={status} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={filter.status?.includes(status) || false}
                      onChange={(e) => handleStatusFilterChange(status, e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    {getArticleStatusLabel(status)}
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sort Controls */}
      <div className="flex items-center gap-2 px-4 py-2 text-xs text-gray-500 border-b border-gray-100">
        <span>Sort by:</span>
        {(['number', 'title', 'type', 'updated_at'] as SortField[]).map((field) => (
          <button
            key={field}
            onClick={() => handleSort(field)}
            className={`px-2 py-1 rounded ${
              sortField === field ? 'bg-gray-200 text-gray-800' : 'hover:bg-gray-100'
            }`}
          >
            {field === 'updated_at' ? 'Updated' : field.charAt(0).toUpperCase() + field.slice(1)}
            {sortField === field && <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>}
          </button>
        ))}
      </div>

      {/* Article List */}
      <div className="flex-1 overflow-y-auto">
        {sortedArticles.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <svg
              className="mx-auto w-12 h-12 text-gray-400 mb-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
              />
            </svg>
            <p className="font-medium">No articles found</p>
            <p className="text-sm mt-1">
              {hasActiveFilters
                ? 'Try adjusting your filters'
                : 'Create your first article to get started'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {sortedArticles.map((article) => {
              const isCrossDomain = !article.domain_id;
              return (
                <div
                  key={article.id}
                  onClick={() => handleArticleClick(article)}
                  className={`p-4 cursor-pointer transition-colors ${
                    selectedArticle?.id === article.id
                      ? 'bg-blue-50 border-l-4 border-l-blue-500'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-gray-500">
                          KB-{formatArticleNumber(article.number)}
                        </span>
                        <ArticleTypeBadge type={article.type} size="sm" />
                        <ArticleStatusBadge status={article.status} size="sm" />
                        {isCrossDomain && (
                          <span className="text-xs font-medium text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">
                            CROSS-DOMAIN
                          </span>
                        )}
                      </div>
                      <h3 className="font-medium text-gray-900 truncate">{article.title}</h3>
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">{article.summary}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                    <span>Updated {new Date(article.updated_at).toLocaleDateString()}</span>
                    {article.published_at && (
                      <span>Published {new Date(article.published_at).toLocaleDateString()}</span>
                    )}
                    {article.authors.length > 0 && (
                      <span>
                        By {article.authors[0]}
                        {article.authors.length > 1 ? ` +${article.authors.length - 1}` : ''}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer Stats */}
      <div className="px-4 py-2 border-t border-gray-200 text-xs text-gray-500">
        {sortedArticles.length} of {filteredArticles.length} articles
        {hasActiveFilters && ' (filtered)'}
      </div>
    </div>
  );
};
