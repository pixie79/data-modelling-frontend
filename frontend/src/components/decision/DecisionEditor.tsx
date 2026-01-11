/**
 * Decision Editor Component
 * Full editor for creating and editing MADR decisions
 */

import React, { useState, useEffect } from 'react';
import { useDecisionStore } from '@/stores/decisionStore';
import { DecisionStatusBadge } from './DecisionStatusBadge';
import { DecisionOptionEditor } from './DecisionOptionEditor';
import type { Decision, DecisionOption } from '@/types/decision';
import {
  DecisionStatus,
  DecisionCategory,
  formatDecisionNumber,
  getDecisionStatusLabel,
  getDecisionCategoryLabel,
  VALID_STATUS_TRANSITIONS,
} from '@/types/decision';

export interface DecisionEditorProps {
  workspacePath: string;
  decision?: Decision | null;
  domainId?: string;
  onSave?: (decision: Decision) => void;
  onCancel?: () => void;
  onDelete?: (decisionId: string) => void;
  className?: string;
}

interface FormData {
  title: string;
  category: DecisionCategory;
  context: string;
  decision: string;
  consequences: string;
  options: DecisionOption[];
  authors: string[];
  deciders: string[];
  consulted: string[];
  informed: string[];
}

const emptyFormData: FormData = {
  title: '',
  category: DecisionCategory.Architecture,
  context: '',
  decision: '',
  consequences: '',
  options: [],
  authors: [],
  deciders: [],
  consulted: [],
  informed: [],
};

export const DecisionEditor: React.FC<DecisionEditorProps> = ({
  workspacePath: _workspacePath,
  decision,
  domainId,
  onSave,
  onCancel,
  onDelete,
  className = '',
}) => {
  // Note: _workspacePath is kept in the interface for API compatibility but not used
  // since the store now works with in-memory data
  const {
    isSaving,
    error,
    createDecision,
    updateDecision,
    changeDecisionStatus,
    removeDecision,
    clearError,
  } = useDecisionStore();

  const [formData, setFormData] = useState<FormData>(emptyFormData);
  const [isDirty, setIsDirty] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showStatusChange, setShowStatusChange] = useState(false);
  const [newAuthors, setNewAuthors] = useState('');

  const isNew = !decision;

  // Initialize form data when decision changes
  useEffect(() => {
    if (decision) {
      setFormData({
        title: decision.title,
        category: decision.category,
        context: decision.context,
        decision: decision.decision,
        consequences: decision.consequences || '',
        options: decision.options || [],
        authors: decision.authors || [],
        deciders: decision.deciders || [],
        consulted: decision.consulted || [],
        informed: decision.informed || [],
      });
    } else {
      setFormData(emptyFormData);
    }
    setIsDirty(false);
    clearError();
  }, [decision, clearError]);

  const handleInputChange = (
    field: keyof FormData,
    value: string | DecisionCategory | DecisionOption[] | string[]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setIsDirty(true);
  };

  const handleAddAuthor = () => {
    if (newAuthors.trim()) {
      const authors = newAuthors
        .split(',')
        .map((a) => a.trim())
        .filter(Boolean);
      handleInputChange('authors', [...formData.authors, ...authors]);
      setNewAuthors('');
    }
  };

  const handleRemoveAuthor = (index: number) => {
    const newAuthors = [...formData.authors];
    newAuthors.splice(index, 1);
    handleInputChange('authors', newAuthors);
  };

  const handleSave = () => {
    if (!formData.title.trim()) {
      return;
    }

    try {
      if (isNew) {
        const newDecision = createDecision({
          title: formData.title,
          category: formData.category,
          context: formData.context,
          decision: formData.decision,
          consequences: formData.consequences,
          options: formData.options,
          domain_id: domainId,
          authors: formData.authors,
        });
        onSave?.(newDecision);
      } else {
        const updatedDecision = updateDecision(decision.id, {
          title: formData.title,
          category: formData.category,
          context: formData.context,
          decision: formData.decision,
          consequences: formData.consequences,
          options: formData.options,
          authors: formData.authors,
          deciders: formData.deciders,
          consulted: formData.consulted,
          informed: formData.informed,
        });
        if (updatedDecision) {
          onSave?.(updatedDecision);
        }
      }
      setIsDirty(false);
    } catch {
      // Error is handled by store
    }
  };

  const handleStatusChange = (newStatus: DecisionStatus) => {
    if (!decision) return;

    const updated = changeDecisionStatus(decision.id, newStatus);
    if (updated) {
      setShowStatusChange(false);
    }
  };

  const handleDelete = () => {
    if (!decision) return;

    removeDecision(decision.id);
    onDelete?.(decision.id);
  };

  const availableTransitions = decision ? VALID_STATUS_TRANSITIONS[decision.status] : [];

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-900">
            {isNew ? 'New Decision' : `Edit Decision`}
          </h2>
          {!isNew && (
            <>
              <span className="text-sm font-mono text-gray-500">
                ADR-{formatDecisionNumber(decision.number)}
              </span>
              <DecisionStatusBadge status={decision.status} />
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isNew && availableTransitions.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowStatusChange(!showStatusChange)}
                className="px-3 py-1.5 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Change Status
              </button>
              {showStatusChange && (
                <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                  <div className="py-1">
                    {availableTransitions.map((status) => (
                      <button
                        key={status}
                        onClick={() => handleStatusChange(status)}
                        disabled={isSaving}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 disabled:opacity-50"
                      >
                        {getDecisionStatusLabel(status)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={isSaving || !formData.title.trim()}
            className="inline-flex items-center gap-1 px-4 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Saving...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                Save
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{error}</p>
          <button
            onClick={clearError}
            className="mt-1 text-xs text-red-600 hover:text-red-800 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Form Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Title & Category */}
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <label
              htmlFor="decision-title"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Title <span className="text-red-500">*</span>
            </label>
            <input
              id="decision-title"
              type="text"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              placeholder="Short decision title"
              maxLength={255}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label
              htmlFor="decision-category"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Category
            </label>
            <select
              id="decision-category"
              value={formData.category}
              onChange={(e) => handleInputChange('category', e.target.value as DecisionCategory)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {Object.values(DecisionCategory).map((cat) => (
                <option key={cat} value={cat}>
                  {getDecisionCategoryLabel(cat)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Context */}
        <div>
          <label
            htmlFor="decision-context"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Context
          </label>
          <p className="text-xs text-gray-500 mb-2">
            Describe the issue motivating this decision, including any technical, business, or
            political factors.
          </p>
          <textarea
            id="decision-context"
            value={formData.context}
            onChange={(e) => handleInputChange('context', e.target.value)}
            placeholder="What is the issue that we're seeing that is motivating this decision or change?"
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Options */}
        <DecisionOptionEditor
          options={formData.options}
          onChange={(options) => handleInputChange('options', options)}
        />

        {/* Decision */}
        <div>
          <label
            htmlFor="decision-decision"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Decision
          </label>
          <p className="text-xs text-gray-500 mb-2">
            State the decision that was made. Use imperative voice: &quot;We will...&quot;
          </p>
          <textarea
            id="decision-decision"
            value={formData.decision}
            onChange={(e) => handleInputChange('decision', e.target.value)}
            placeholder="This is the change that we're proposing or have decided to implement."
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Consequences */}
        <div>
          <label
            htmlFor="decision-consequences"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Consequences
          </label>
          <p className="text-xs text-gray-500 mb-2">
            Describe the resulting context after applying the decision. Include positive and
            negative impacts.
          </p>
          <textarea
            id="decision-consequences"
            value={formData.consequences}
            onChange={(e) => handleInputChange('consequences', e.target.value)}
            placeholder="What becomes easier or more difficult to do because of this change?"
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* RACI Section */}
        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-sm font-medium text-gray-700 mb-4">Stakeholders (RACI)</h3>

          {/* Authors */}
          <div className="mb-4">
            <label
              htmlFor="decision-authors"
              className="block text-xs font-medium text-gray-600 mb-1"
            >
              Authors
            </label>
            <div className="flex items-center gap-2 mb-2">
              <input
                id="decision-authors"
                type="text"
                value={newAuthors}
                onChange={(e) => setNewAuthors(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddAuthor())}
                placeholder="Add author (comma-separated)"
                className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleAddAuthor}
                className="px-3 py-1.5 text-sm text-blue-600 hover:text-blue-800"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.authors.map((author, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-1 px-2 py-1 text-sm bg-gray-100 rounded-md"
                >
                  {author}
                  <button
                    type="button"
                    onClick={() => handleRemoveAuthor(index)}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Delete Section */}
        {!isNew && onDelete && (
          <div className="border-t border-gray-200 pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-red-700">Delete Decision</h3>
                <p className="text-xs text-gray-500 mt-1">This action cannot be undone.</p>
              </div>
              {showDeleteConfirm ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={isSaving}
                    className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
                  >
                    Confirm Delete
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-3 py-1.5 text-sm text-red-600 border border-red-300 rounded-md hover:bg-red-50"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Dirty Indicator */}
      {isDirty && (
        <div className="px-4 py-2 bg-yellow-50 border-t border-yellow-200 text-xs text-yellow-800">
          You have unsaved changes
        </div>
      )}
    </div>
  );
};
