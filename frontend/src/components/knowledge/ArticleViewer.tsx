/**
 * Article Viewer Component
 * Read-only display of a knowledge article with markdown rendering
 */

import React, { useState, useMemo } from 'react';
import { useKnowledgeStore } from '@/stores/knowledgeStore';
import { useDecisionStore } from '@/stores/decisionStore';
import { ArticleTypeBadge } from './ArticleTypeBadge';
import { ArticleStatusBadge } from './ArticleStatusBadge';
import { MarkdownRenderer } from '@/components/common/MarkdownRenderer';
import { ExportDropdown, MarkdownIcon, PDFIcon } from '@/components/common/ExportDropdown';
import type { KnowledgeArticle } from '@/types/knowledge';
import {
  ArticleStatus,
  formatArticleNumber,
  getArticleStatusLabel,
  VALID_ARTICLE_STATUS_TRANSITIONS,
} from '@/types/knowledge';
import { formatDecisionNumber } from '@/types/decision';

export interface ArticleViewerProps {
  workspacePath: string;
  article: KnowledgeArticle;
  onEdit?: () => void;
  onClose?: () => void;
  className?: string;
}

export const ArticleViewer: React.FC<ArticleViewerProps> = ({
  workspacePath: _workspacePath,
  article,
  onEdit,
  onClose,
  className = '',
}) => {
  const {
    isSaving,
    changeArticleStatus,
    exportKnowledgeToMarkdown,
    exportKnowledgeToPDF,
    hasPDFExport,
    getArticleById,
  } = useKnowledgeStore();
  const { getDecisionById } = useDecisionStore();

  const [showStatusChange, setShowStatusChange] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleStatusChange = (newStatus: ArticleStatus) => {
    const updated = changeArticleStatus(article.id, newStatus);
    if (updated) {
      setShowStatusChange(false);
    }
  };

  const handleExportMarkdown = async () => {
    setIsExporting(true);
    try {
      const markdown = await exportKnowledgeToMarkdown(article);

      // Create a blob and download
      const blob = new Blob([markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kb-${formatArticleNumber(article.number)}-${article.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Error handled by store
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      await exportKnowledgeToPDF(article);
    } catch {
      // Error handled by store
    } finally {
      setIsExporting(false);
    }
  };

  const pdfExportAvailable = hasPDFExport();

  const exportOptions = useMemo(
    () => [
      {
        id: 'markdown',
        label: 'Markdown (.md)',
        description: 'Export as formatted markdown document',
        icon: <MarkdownIcon />,
        onClick: handleExportMarkdown,
      },
      {
        id: 'pdf',
        label: 'PDF Document',
        description: 'Branded PDF with OpenDataModelling logo',
        icon: <PDFIcon />,
        onClick: handleExportPDF,
        disabled: !pdfExportAvailable,
        comingSoon: !pdfExportAvailable,
      },
    ],
    [pdfExportAvailable]
  );

  const availableTransitions = VALID_ARTICLE_STATUS_TRANSITIONS[article.status];

  return (
    <div className={`flex flex-col h-full bg-white ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <span className="text-sm font-mono text-gray-500 bg-gray-100 px-2 py-1 rounded">
            KB-{formatArticleNumber(article.number)}
          </span>
          <ArticleTypeBadge type={article.type} showIcon />
          <ArticleStatusBadge status={article.status} showIcon />
        </div>
        <div className="flex items-center gap-2">
          {availableTransitions.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowStatusChange(!showStatusChange)}
                disabled={isSaving}
                className="px-3 py-1.5 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
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
          <ExportDropdown options={exportOptions} isExporting={isExporting} />
          {onEdit && (
            <button
              onClick={onEdit}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
              Edit
            </button>
          )}
          {onClose && (
            <button onClick={onClose} className="p-1.5 text-gray-500 hover:text-gray-700">
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
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Title */}
        <h1 className="text-2xl font-bold text-gray-900 mb-4">{article.title}</h1>

        {/* Deprecated/Archived Warning */}
        {article.status === ArticleStatus.Deprecated && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-red-800">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <span className="font-medium">
                This article has been deprecated and may contain outdated information.
              </span>
            </div>
          </div>
        )}

        {article.status === ArticleStatus.Archived && (
          <div className="mb-6 p-4 bg-gray-100 border border-gray-300 rounded-lg">
            <div className="flex items-center gap-2 text-gray-700">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
                />
              </svg>
              <span className="font-medium">This article has been archived.</span>
            </div>
          </div>
        )}

        {/* Metadata */}
        <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Created</span>
            <p className="font-medium">{new Date(article.created_at).toLocaleDateString()}</p>
          </div>
          <div>
            <span className="text-gray-500">Updated</span>
            <p className="font-medium">{new Date(article.updated_at).toLocaleDateString()}</p>
          </div>
          {article.published_at && (
            <div>
              <span className="text-gray-500">Published</span>
              <p className="font-medium">{new Date(article.published_at).toLocaleDateString()}</p>
            </div>
          )}
          {article.reviewed_at && (
            <div>
              <span className="text-gray-500">Last Reviewed</span>
              <p className="font-medium">{new Date(article.reviewed_at).toLocaleDateString()}</p>
            </div>
          )}
        </div>

        {/* Authors & Reviewers */}
        <div className="mb-6 flex flex-wrap gap-4">
          {article.authors.length > 0 && (
            <div>
              <span className="text-sm text-gray-500">Authors: </span>
              <span className="text-sm font-medium">{article.authors.join(', ')}</span>
            </div>
          )}
          {article.reviewers.length > 0 && (
            <div>
              <span className="text-sm text-gray-500">Reviewers: </span>
              <span className="text-sm font-medium">{article.reviewers.join(', ')}</span>
            </div>
          )}
        </div>

        {/* Summary */}
        {article.summary && (
          <section className="mb-6">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h2 className="text-sm font-semibold text-blue-800 mb-1">Summary</h2>
              <p className="text-blue-900">{article.summary}</p>
            </div>
          </section>
        )}

        {/* Content */}
        <section className="mb-6">
          <MarkdownRenderer content={article.content || ''} />
        </section>

        {/* Related Articles */}
        {article.related_articles && article.related_articles.length > 0 && (
          <section className="mb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Related Articles</h2>
            <div className="flex flex-wrap gap-2">
              {article.related_articles.map((relatedId) => {
                const related = getArticleById(relatedId);
                return related ? (
                  <span
                    key={relatedId}
                    className="inline-flex items-center gap-1 px-2 py-1 text-sm bg-gray-100 rounded-md"
                  >
                    <span className="font-mono text-xs">
                      KB-{formatArticleNumber(related.number)}
                    </span>
                    {related.title}
                  </span>
                ) : null;
              })}
            </div>
          </section>
        )}

        {/* Related Decisions */}
        {article.related_decisions && article.related_decisions.length > 0 && (
          <section className="mb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Related Decisions</h2>
            <div className="flex flex-wrap gap-2">
              {article.related_decisions.map((decisionId) => {
                const decision = getDecisionById(decisionId);
                return decision ? (
                  <span
                    key={decisionId}
                    className="inline-flex items-center gap-1 px-2 py-1 text-sm bg-indigo-50 text-indigo-700 rounded-md"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span className="font-mono text-xs">
                      ADR-{formatDecisionNumber(decision.number)}
                    </span>
                    {decision.title}
                  </span>
                ) : (
                  <span
                    key={decisionId}
                    className="inline-flex items-center gap-1 px-2 py-1 text-sm bg-gray-100 text-gray-500 rounded-md"
                  >
                    <span className="font-mono text-xs">{decisionId.slice(0, 8)}...</span>
                  </span>
                );
              })}
            </div>
          </section>
        )}

        {/* Tags */}
        {article.tags && article.tags.length > 0 && (
          <section className="mb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Tags</h2>
            <div className="flex flex-wrap gap-2">
              {article.tags.map((tag, index) => {
                const tagDisplay =
                  typeof tag === 'string'
                    ? tag
                    : 'values' in tag
                      ? `${tag.key}: ${tag.values.join(', ')}`
                      : `${tag.key}: ${tag.value}`;
                return (
                  <span
                    key={index}
                    className="px-2 py-1 text-sm bg-blue-50 text-blue-700 rounded-md"
                  >
                    {tagDisplay}
                  </span>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};
