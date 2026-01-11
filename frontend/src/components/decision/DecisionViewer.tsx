/**
 * Decision Viewer Component
 * Read-only display of a MADR decision with markdown rendering
 */

import React, { useState, useMemo } from 'react';
import { useDecisionStore } from '@/stores/decisionStore';
import { useKnowledgeStore } from '@/stores/knowledgeStore';
import { DecisionStatusBadge } from './DecisionStatusBadge';
import { DecisionCategoryBadge } from './DecisionCategoryBadge';
import { MarkdownRenderer } from '@/components/common/MarkdownRenderer';
import { ExportDropdown, MarkdownIcon, PDFIcon } from '@/components/common/ExportDropdown';
import type { Decision } from '@/types/decision';
import {
  DecisionStatus,
  formatDecisionNumber,
  getDecisionStatusLabel,
  VALID_STATUS_TRANSITIONS,
} from '@/types/decision';
import { formatArticleNumber } from '@/types/knowledge';

export interface DecisionViewerProps {
  workspacePath: string;
  decision: Decision;
  onEdit?: () => void;
  onClose?: () => void;
  className?: string;
}

export const DecisionViewer: React.FC<DecisionViewerProps> = ({
  workspacePath: _workspacePath,
  decision,
  onEdit,
  onClose,
  className = '',
}) => {
  const {
    isSaving,
    changeDecisionStatus,
    exportDecisionToMarkdown,
    exportDecisionToPDF,
    hasPDFExport,
    getDecisionById,
  } = useDecisionStore();
  const { articles } = useKnowledgeStore();

  const [showStatusChange, setShowStatusChange] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Find knowledge articles that reference this decision
  const relatedArticles = articles.filter(
    (article) =>
      article.domain_id === decision.domain_id && article.related_decisions?.includes(decision.id)
  );

  const handleStatusChange = (newStatus: DecisionStatus) => {
    const updated = changeDecisionStatus(decision.id, newStatus);
    if (updated) {
      setShowStatusChange(false);
    }
  };

  const handleExportMarkdown = async () => {
    setIsExporting(true);
    try {
      const markdown = await exportDecisionToMarkdown(decision);

      // Create a blob and download
      const blob = new Blob([markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `adr-${formatDecisionNumber(decision.number)}-${decision.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`;
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
      await exportDecisionToPDF(decision);
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
        description: 'Export as MADR format document',
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

  const availableTransitions = VALID_STATUS_TRANSITIONS[decision.status];

  // Get superseded/supersedes decision info
  const supersededByDecision = decision.superseded_by
    ? getDecisionById(decision.superseded_by)
    : null;
  const supersedesDecision = decision.supersedes ? getDecisionById(decision.supersedes) : null;

  return (
    <div className={`flex flex-col h-full bg-white ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <span className="text-sm font-mono text-gray-500 bg-gray-100 px-2 py-1 rounded">
            ADR-{formatDecisionNumber(decision.number)}
          </span>
          <DecisionStatusBadge status={decision.status} showIcon />
          <DecisionCategoryBadge category={decision.category} showIcon />
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
                        {getDecisionStatusLabel(status)}
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
        <h1 className="text-2xl font-bold text-gray-900 mb-4">{decision.title}</h1>

        {/* Superseded Warning */}
        {decision.status === DecisionStatus.Superseded && supersededByDecision && (
          <div className="mb-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
            <div className="flex items-center gap-2 text-purple-800">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="font-medium">
                This decision has been superseded by{' '}
                <span className="font-mono">
                  ADR-{formatDecisionNumber(supersededByDecision.number)}
                </span>
                : {supersededByDecision.title}
              </span>
            </div>
          </div>
        )}

        {/* Supersedes Info */}
        {supersedesDecision && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2 text-blue-800">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              <span className="font-medium">
                This decision supersedes{' '}
                <span className="font-mono">
                  ADR-{formatDecisionNumber(supersedesDecision.number)}
                </span>
                : {supersedesDecision.title}
              </span>
            </div>
          </div>
        )}

        {/* Metadata */}
        <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Created</span>
            <p className="font-medium">{new Date(decision.created_at).toLocaleDateString()}</p>
          </div>
          <div>
            <span className="text-gray-500">Updated</span>
            <p className="font-medium">{new Date(decision.updated_at).toLocaleDateString()}</p>
          </div>
          {decision.decided_at && (
            <div>
              <span className="text-gray-500">Decided</span>
              <p className="font-medium">{new Date(decision.decided_at).toLocaleDateString()}</p>
            </div>
          )}
          {decision.authors && decision.authors.length > 0 && (
            <div>
              <span className="text-gray-500">Authors</span>
              <p className="font-medium">{decision.authors.join(', ')}</p>
            </div>
          )}
        </div>

        {/* Context */}
        <section className="mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Context</h2>
          {decision.context ? (
            <MarkdownRenderer content={decision.context} />
          ) : (
            <span className="text-gray-400 italic">No context provided</span>
          )}
        </section>

        {/* Considered Options */}
        {decision.options && decision.options.length > 0 && (
          <section className="mb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-3">Considered Options</h2>
            <div className="space-y-4">
              {decision.options.map((option, index) => (
                <div key={index} className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                  <h3 className="font-medium text-gray-900 mb-2">
                    {index + 1}. {option.title}
                  </h3>
                  {option.description && (
                    <p className="text-sm text-gray-600 mb-3">{option.description}</p>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    {option.pros.length > 0 && (
                      <div>
                        <h4 className="text-xs font-medium text-green-700 mb-1">Pros</h4>
                        <ul className="text-sm text-gray-600 space-y-1">
                          {option.pros.map((pro, i) => (
                            <li key={i} className="flex items-start gap-1">
                              <span className="text-green-500">+</span>
                              {pro}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {option.cons.length > 0 && (
                      <div>
                        <h4 className="text-xs font-medium text-red-700 mb-1">Cons</h4>
                        <ul className="text-sm text-gray-600 space-y-1">
                          {option.cons.map((con, i) => (
                            <li key={i} className="flex items-start gap-1">
                              <span className="text-red-500">-</span>
                              {con}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Decision */}
        <section className="mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Decision</h2>
          {decision.decision ? (
            <MarkdownRenderer content={decision.decision} />
          ) : (
            <span className="text-gray-400 italic">No decision documented</span>
          )}
        </section>

        {/* Consequences */}
        {decision.consequences && (
          <section className="mb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Consequences</h2>
            <MarkdownRenderer content={decision.consequences} />
          </section>
        )}

        {/* Related Decisions */}
        {decision.related_decisions && decision.related_decisions.length > 0 && (
          <section className="mb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Related Decisions</h2>
            <div className="flex flex-wrap gap-2">
              {decision.related_decisions.map((relatedId) => {
                const related = getDecisionById(relatedId);
                return related ? (
                  <span
                    key={relatedId}
                    className="inline-flex items-center gap-1 px-2 py-1 text-sm bg-gray-100 rounded-md"
                  >
                    <span className="font-mono text-xs">
                      ADR-{formatDecisionNumber(related.number)}
                    </span>
                    {related.title}
                  </span>
                ) : null;
              })}
            </div>
          </section>
        )}

        {/* Related Knowledge Articles */}
        {relatedArticles.length > 0 && (
          <section className="mb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Related Knowledge Articles</h2>
            <div className="flex flex-wrap gap-2">
              {relatedArticles.map((article) => (
                <span
                  key={article.id}
                  className="inline-flex items-center gap-1 px-2 py-1 text-sm bg-emerald-50 text-emerald-700 rounded-md"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                    />
                  </svg>
                  <span className="font-mono text-xs">
                    KB-{formatArticleNumber(article.number)}
                  </span>
                  {article.title}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Tags */}
        {decision.tags && decision.tags.length > 0 && (
          <section className="mb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Tags</h2>
            <div className="flex flex-wrap gap-2">
              {decision.tags.map((tag, index) => {
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
