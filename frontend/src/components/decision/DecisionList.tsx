/**
 * Decision List Component
 * Displays a list of MADR decisions with filtering and sorting
 */

import React, { useState, useMemo } from 'react';
import { useDecisionStore } from '@/stores/decisionStore';
import { DecisionStatusBadge } from './DecisionStatusBadge';
import { DecisionCategoryBadge } from './DecisionCategoryBadge';
import type { Decision } from '@/types/decision';
import {
  DecisionStatus,
  DecisionCategory,
  formatDecisionNumber,
  getDecisionStatusLabel,
  getDecisionCategoryLabel,
} from '@/types/decision';

export interface DecisionListProps {
  workspacePath: string;
  domainId?: string;
  onSelectDecision?: (decision: Decision) => void;
  onCreateDecision?: () => void;
  className?: string;
}

type SortField = 'number' | 'title' | 'status' | 'updated_at';
type SortOrder = 'asc' | 'desc';

export const DecisionList: React.FC<DecisionListProps> = ({
  workspacePath: _workspacePath,
  domainId,
  onSelectDecision,
  onCreateDecision,
  className = '',
}) => {
  const {
    filteredDecisions,
    selectedDecision,
    filter,
    isLoading,
    error,
    setFilter,
    setSelectedDecision,
  } = useDecisionStore();

  const [searchInput, setSearchInput] = useState(filter.search || '');
  const [sortField, setSortField] = useState<SortField>('number');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [showFilters, setShowFilters] = useState(false);

  // Set domain filter on mount if provided
  React.useEffect(() => {
    if (domainId) {
      setFilter({ ...filter, domain_id: domainId });
    }
  }, [domainId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced search
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setFilter({ ...filter, search: searchInput || undefined });
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, filter, setFilter]);

  // Sort decisions
  const sortedDecisions = useMemo(() => {
    const sorted = [...filteredDecisions];
    sorted.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'number':
          comparison = a.number - b.number;
          break;
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'updated_at':
          comparison = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    return sorted;
  }, [filteredDecisions, sortField, sortOrder]);

  const handleDecisionClick = (decision: Decision) => {
    setSelectedDecision(decision);
    onSelectDecision?.(decision);
  };

  const handleStatusFilterChange = (status: DecisionStatus, checked: boolean) => {
    const currentStatuses = filter.status || [];
    const newStatuses = checked
      ? [...currentStatuses, status]
      : currentStatuses.filter((s) => s !== status);
    setFilter({ ...filter, status: newStatuses.length > 0 ? newStatuses : undefined });
  };

  const handleCategoryFilterChange = (category: DecisionCategory, checked: boolean) => {
    const currentCategories = filter.category || [];
    const newCategories = checked
      ? [...currentCategories, category]
      : currentCategories.filter((c) => c !== category);
    setFilter({ ...filter, category: newCategories.length > 0 ? newCategories : undefined });
  };

  const clearFilters = () => {
    setSearchInput('');
    setFilter({ domain_id: domainId });
  };

  const hasActiveFilters = !!(filter.status?.length || filter.category?.length || filter.search);

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
          <span className="ml-2 text-gray-600">Loading decisions...</span>
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
        <h2 className="text-lg font-semibold text-gray-900">Decisions</h2>
        {onCreateDecision && (
          <button
            onClick={onCreateDecision}
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
            New Decision
          </button>
        )}
      </div>

      {/* Search and Filters */}
      <div className="p-4 border-b border-gray-200 space-y-3">
        {/* Search */}
        <div className="relative">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search decisions..."
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
            {/* Status Filter */}
            <div>
              <h4 className="text-xs font-medium text-gray-700 mb-2">Status</h4>
              <div className="space-y-1">
                {Object.values(DecisionStatus).map((status) => (
                  <label key={status} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={filter.status?.includes(status) || false}
                      onChange={(e) => handleStatusFilterChange(status, e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    {getDecisionStatusLabel(status)}
                  </label>
                ))}
              </div>
            </div>

            {/* Category Filter */}
            <div>
              <h4 className="text-xs font-medium text-gray-700 mb-2">Category</h4>
              <div className="space-y-1">
                {Object.values(DecisionCategory).map((category) => (
                  <label key={category} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={filter.category?.includes(category) || false}
                      onChange={(e) => handleCategoryFilterChange(category, e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    {getDecisionCategoryLabel(category)}
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
        {(['number', 'title', 'status', 'updated_at'] as SortField[]).map((field) => (
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

      {/* Decision List */}
      <div className="flex-1 overflow-y-auto">
        {sortedDecisions.length === 0 ? (
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
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="font-medium">No decisions found</p>
            <p className="text-sm mt-1">
              {hasActiveFilters
                ? 'Try adjusting your filters'
                : 'Create your first decision to get started'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {sortedDecisions.map((decision) => (
              <div
                key={decision.id}
                onClick={() => handleDecisionClick(decision)}
                className={`p-4 cursor-pointer transition-colors ${
                  selectedDecision?.id === decision.id
                    ? 'bg-blue-50 border-l-4 border-l-blue-500'
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-gray-500">
                        ADR-{formatDecisionNumber(decision.number)}
                      </span>
                      <DecisionStatusBadge status={decision.status} size="sm" />
                      <DecisionCategoryBadge category={decision.category} size="sm" />
                    </div>
                    <h3 className="font-medium text-gray-900 truncate">{decision.title}</h3>
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">{decision.context}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                  <span>Updated {new Date(decision.updated_at).toLocaleDateString()}</span>
                  {decision.decided_at && (
                    <span>Decided {new Date(decision.decided_at).toLocaleDateString()}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Stats */}
      <div className="px-4 py-2 border-t border-gray-200 text-xs text-gray-500">
        {sortedDecisions.length} of {filteredDecisions.length} decisions
        {hasActiveFilters && ' (filtered)'}
      </div>
    </div>
  );
};
