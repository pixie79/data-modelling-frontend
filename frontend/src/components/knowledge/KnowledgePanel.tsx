/**
 * Knowledge Panel Component
 * Main panel for viewing and managing knowledge articles within a domain
 */

import React, { useState } from 'react';
import { KnowledgeList } from './KnowledgeList';
import { ArticleEditor } from './ArticleEditor';
import { ArticleViewer } from './ArticleViewer';
import { KnowledgeSearch } from './KnowledgeSearch';
import { useKnowledgeStore } from '@/stores/knowledgeStore';
import type { KnowledgeArticle } from '@/types/knowledge';

export interface KnowledgePanelProps {
  workspacePath: string;
  domainId: string;
  className?: string;
}

type PanelMode = 'list' | 'search' | 'view' | 'edit' | 'create';

export const KnowledgePanel: React.FC<KnowledgePanelProps> = ({
  workspacePath,
  domainId,
  className = '',
}) => {
  const { selectedArticle, setSelectedArticle } = useKnowledgeStore();
  const [mode, setMode] = useState<PanelMode>('list');

  const handleSelectArticle = (article: KnowledgeArticle) => {
    setSelectedArticle(article);
    setMode('view');
  };

  const handleCreateArticle = () => {
    setSelectedArticle(null);
    setMode('create');
  };

  const handleEditArticle = () => {
    setMode('edit');
  };

  const handleCloseViewer = () => {
    setSelectedArticle(null);
    setMode('list');
  };

  const handleSaveComplete = () => {
    setMode('view');
  };

  const handleCancelEdit = () => {
    if (selectedArticle) {
      setMode('view');
    } else {
      setMode('list');
    }
  };

  const handleDeleteComplete = () => {
    setSelectedArticle(null);
    setMode('list');
  };

  return (
    <div className={`flex h-full bg-white ${className}`}>
      {/* Left Panel - List or Search */}
      <div className="w-80 border-r border-gray-200 flex-shrink-0 flex flex-col">
        {/* Toggle between List and Search */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setMode('list')}
            className={`flex-1 px-4 py-2 text-sm font-medium ${
              mode !== 'search'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Browse
          </button>
          <button
            onClick={() => setMode('search')}
            className={`flex-1 px-4 py-2 text-sm font-medium ${
              mode === 'search'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Search
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {mode === 'search' ? (
            <div className="p-4 h-full overflow-y-auto">
              <KnowledgeSearch onSelectArticle={handleSelectArticle} />
            </div>
          ) : (
            <KnowledgeList
              workspacePath={workspacePath}
              domainId={domainId}
              onSelectArticle={handleSelectArticle}
              onCreateArticle={handleCreateArticle}
            />
          )}
        </div>
      </div>

      {/* Right Panel - Viewer/Editor */}
      <div className="flex-1 overflow-hidden">
        {(mode === 'list' || mode === 'search') && !selectedArticle && (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <svg
              className="w-16 h-16 text-gray-300 mb-4"
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
            <p className="text-lg font-medium">No article selected</p>
            <p className="text-sm mt-1">Select an article from the list or create a new one</p>
            <button
              onClick={handleCreateArticle}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Create Article
            </button>
          </div>
        )}

        {mode === 'view' && selectedArticle && (
          <ArticleViewer
            workspacePath={workspacePath}
            article={selectedArticle}
            onEdit={handleEditArticle}
            onClose={handleCloseViewer}
          />
        )}

        {mode === 'edit' && selectedArticle && (
          <ArticleEditor
            workspacePath={workspacePath}
            article={selectedArticle}
            domainId={domainId}
            onSave={handleSaveComplete}
            onCancel={handleCancelEdit}
            onDelete={handleDeleteComplete}
          />
        )}

        {mode === 'create' && (
          <ArticleEditor
            workspacePath={workspacePath}
            article={null}
            domainId={domainId}
            onSave={handleSaveComplete}
            onCancel={handleCancelEdit}
          />
        )}
      </div>
    </div>
  );
};
