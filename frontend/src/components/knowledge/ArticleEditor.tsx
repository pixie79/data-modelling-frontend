/**
 * Article Editor Component
 * Full editor for creating and editing knowledge articles
 */

import React, { useState, useEffect } from 'react';
import { useKnowledgeStore } from '@/stores/knowledgeStore';
import { ArticleStatusBadge } from './ArticleStatusBadge';
import type { KnowledgeArticle } from '@/types/knowledge';
import {
  ArticleType,
  ArticleStatus,
  formatArticleNumber,
  getArticleTypeLabel,
  getArticleStatusLabel,
  VALID_ARTICLE_STATUS_TRANSITIONS,
} from '@/types/knowledge';

export interface ArticleEditorProps {
  workspacePath: string;
  article?: KnowledgeArticle | null;
  domainId?: string;
  onSave?: (article: KnowledgeArticle) => void;
  onCancel?: () => void;
  onDelete?: (articleId: string) => void;
  className?: string;
}

interface FormData {
  title: string;
  type: ArticleType;
  summary: string;
  content: string;
  authors: string[];
  reviewers: string[];
}

const emptyFormData: FormData = {
  title: '',
  type: ArticleType.Guide,
  summary: '',
  content: '',
  authors: [],
  reviewers: [],
};

export const ArticleEditor: React.FC<ArticleEditorProps> = ({
  workspacePath: _workspacePath,
  article,
  domainId,
  onSave,
  onCancel,
  onDelete,
  className = '',
}) => {
  const {
    isSaving,
    error,
    createArticle,
    updateArticle,
    changeArticleStatus,
    removeArticle,
    clearError,
  } = useKnowledgeStore();

  const [formData, setFormData] = useState<FormData>(emptyFormData);
  const [isDirty, setIsDirty] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showStatusChange, setShowStatusChange] = useState(false);
  const [newAuthor, setNewAuthor] = useState('');
  const [newReviewer, setNewReviewer] = useState('');

  const isNew = !article;

  // Initialize form data when article changes
  useEffect(() => {
    if (article) {
      setFormData({
        title: article.title,
        type: article.type,
        summary: article.summary,
        content: article.content,
        authors: article.authors || [],
        reviewers: article.reviewers || [],
      });
    } else {
      setFormData(emptyFormData);
    }
    setIsDirty(false);
    clearError();
  }, [article, clearError]);

  const handleInputChange = (field: keyof FormData, value: string | ArticleType | string[]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setIsDirty(true);
  };

  const handleAddAuthor = () => {
    if (newAuthor.trim() && !formData.authors.includes(newAuthor.trim())) {
      handleInputChange('authors', [...formData.authors, newAuthor.trim()]);
      setNewAuthor('');
    }
  };

  const handleRemoveAuthor = (index: number) => {
    const newAuthors = [...formData.authors];
    newAuthors.splice(index, 1);
    handleInputChange('authors', newAuthors);
  };

  const handleAddReviewer = () => {
    if (newReviewer.trim() && !formData.reviewers.includes(newReviewer.trim())) {
      handleInputChange('reviewers', [...formData.reviewers, newReviewer.trim()]);
      setNewReviewer('');
    }
  };

  const handleRemoveReviewer = (index: number) => {
    const newReviewers = [...formData.reviewers];
    newReviewers.splice(index, 1);
    handleInputChange('reviewers', newReviewers);
  };

  const handleSave = () => {
    if (!formData.title.trim()) {
      return;
    }

    try {
      if (isNew) {
        const newArticle = createArticle({
          title: formData.title,
          type: formData.type,
          summary: formData.summary,
          content: formData.content,
          domain_id: domainId,
          authors: formData.authors,
        });
        onSave?.(newArticle);
      } else {
        const updatedArticle = updateArticle(article.id, {
          title: formData.title,
          type: formData.type,
          summary: formData.summary,
          content: formData.content,
          authors: formData.authors,
          reviewers: formData.reviewers,
        });
        if (updatedArticle) {
          onSave?.(updatedArticle);
        }
      }
      setIsDirty(false);
    } catch {
      // Error is handled by store
    }
  };

  const handleStatusChange = (newStatus: ArticleStatus) => {
    if (!article) return;

    const updated = changeArticleStatus(article.id, newStatus);
    if (updated) {
      setShowStatusChange(false);
    }
  };

  const handleDelete = () => {
    if (!article) return;

    removeArticle(article.id);
    onDelete?.(article.id);
  };

  const availableTransitions = article ? VALID_ARTICLE_STATUS_TRANSITIONS[article.status] : [];

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-900">
            {isNew ? 'New Article' : `Edit Article`}
          </h2>
          {!isNew && (
            <>
              <span className="text-sm font-mono text-gray-500">
                KB-{formatArticleNumber(article.number)}
              </span>
              <ArticleStatusBadge status={article.status} />
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
                        {getArticleStatusLabel(status)}
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
        {/* Title & Type */}
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <label htmlFor="article-title" className="block text-sm font-medium text-gray-700 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              id="article-title"
              type="text"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              placeholder="Article title"
              maxLength={255}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label htmlFor="article-type" className="block text-sm font-medium text-gray-700 mb-1">
              Type
            </label>
            <select
              id="article-type"
              value={formData.type}
              onChange={(e) => handleInputChange('type', e.target.value as ArticleType)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {Object.values(ArticleType).map((type) => (
                <option key={type} value={type}>
                  {getArticleTypeLabel(type)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Summary */}
        <div>
          <label htmlFor="article-summary" className="block text-sm font-medium text-gray-700 mb-1">
            Summary
          </label>
          <p className="text-xs text-gray-500 mb-2">
            A brief description of what this article covers.
          </p>
          <textarea
            id="article-summary"
            value={formData.summary}
            onChange={(e) => handleInputChange('summary', e.target.value)}
            placeholder="Brief summary of the article content..."
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Content */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="article-content" className="block text-sm font-medium text-gray-700">
              Content
            </label>
            <a
              href="https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Markdown guide
            </a>
          </div>
          <p className="text-xs text-gray-500 mb-2">
            Supports GitHub Flavored Markdown including tables, task lists, and code blocks.
          </p>
          <textarea
            id="article-content"
            value={formData.content}
            onChange={(e) => handleInputChange('content', e.target.value)}
            placeholder="Write your article content here (Markdown supported)..."
            rows={12}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
          />
        </div>

        {/* Authors & Reviewers */}
        <div className="grid grid-cols-2 gap-6">
          {/* Authors */}
          <div>
            <label
              htmlFor="article-authors"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Authors
            </label>
            <div className="flex items-center gap-2 mb-2">
              <input
                id="article-authors"
                type="text"
                value={newAuthor}
                onChange={(e) => setNewAuthor(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddAuthor())}
                placeholder="Add author"
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
              {formData.authors.length === 0 && (
                <span className="text-xs text-gray-400 italic">No authors</span>
              )}
            </div>
          </div>

          {/* Reviewers */}
          <div>
            <label
              htmlFor="article-reviewers"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Reviewers
            </label>
            <div className="flex items-center gap-2 mb-2">
              <input
                id="article-reviewers"
                type="text"
                value={newReviewer}
                onChange={(e) => setNewReviewer(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddReviewer())}
                placeholder="Add reviewer"
                className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleAddReviewer}
                className="px-3 py-1.5 text-sm text-blue-600 hover:text-blue-800"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.reviewers.map((reviewer, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-1 px-2 py-1 text-sm bg-yellow-50 rounded-md"
                >
                  {reviewer}
                  <button
                    type="button"
                    onClick={() => handleRemoveReviewer(index)}
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
              {formData.reviewers.length === 0 && (
                <span className="text-xs text-gray-400 italic">No reviewers</span>
              )}
            </div>
          </div>
        </div>

        {/* Delete Section */}
        {!isNew && onDelete && (
          <div className="border-t border-gray-200 pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-red-700">Delete Article</h3>
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
