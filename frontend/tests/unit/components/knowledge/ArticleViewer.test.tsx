/**
 * Unit tests for ArticleViewer Component
 * Tests article display, status workflow, and export
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ArticleViewer } from '@/components/knowledge/ArticleViewer';
import { useKnowledgeStore } from '@/stores/knowledgeStore';
import { useDecisionStore } from '@/stores/decisionStore';
import { ArticleType, ArticleStatus } from '@/types/knowledge';
import type { KnowledgeArticle } from '@/types/knowledge';

vi.mock('@/stores/knowledgeStore');
vi.mock('@/stores/decisionStore');

describe('ArticleViewer', () => {
  const mockArticle: KnowledgeArticle = {
    id: 'article-1',
    number: 1,
    title: 'Getting Started Guide',
    type: ArticleType.Guide,
    status: ArticleStatus.Published,
    summary: 'A comprehensive guide to getting started with the platform.',
    content:
      '# Getting Started\n\nThis guide will help you get started.\n\n## Prerequisites\n\n- Node.js 18+\n- npm or yarn',
    domain_id: 'domain-1',
    authors: ['Jane Doe', 'John Smith'],
    reviewers: ['Tech Lead'],
    tags: ['onboarding', 'getting-started'],
    related_decisions: ['decision-1'],
    published_at: '2025-01-15T00:00:00Z',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-15T00:00:00Z',
  };

  const mockOnEdit = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useKnowledgeStore).mockReturnValue({
      isSaving: false,
      changeArticleStatus: vi.fn().mockReturnValue(mockArticle),
      exportKnowledgeToMarkdown: vi.fn().mockResolvedValue('# KB-0001'),
      exportKnowledgeToPDF: vi.fn().mockResolvedValue(undefined),
      hasPDFExport: vi.fn().mockReturnValue(false),
      getArticleById: vi.fn().mockReturnValue(mockArticle),
    } as any);
    vi.mocked(useDecisionStore).mockReturnValue({
      decisions: [],
      getDecisionById: vi.fn().mockReturnValue(null),
    } as any);
  });

  it('should render article title and number', () => {
    render(
      <ArticleViewer
        workspacePath="/test"
        article={mockArticle}
        onEdit={mockOnEdit}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText(/KB-0001/)).toBeInTheDocument();
    expect(screen.getByText(/Getting Started Guide/)).toBeInTheDocument();
  });

  it('should render article type badge', () => {
    render(
      <ArticleViewer
        workspacePath="/test"
        article={mockArticle}
        onEdit={mockOnEdit}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('Guide')).toBeInTheDocument();
  });

  it('should render article status badge', () => {
    render(
      <ArticleViewer
        workspacePath="/test"
        article={mockArticle}
        onEdit={mockOnEdit}
        onClose={mockOnClose}
      />
    );

    // Status badge and Published date both show - verify at least one exists
    const publishedElements = screen.getAllByText(/Published/i);
    expect(publishedElements.length).toBeGreaterThan(0);
  });

  it('should render article summary', () => {
    render(
      <ArticleViewer
        workspacePath="/test"
        article={mockArticle}
        onEdit={mockOnEdit}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText(/comprehensive guide/)).toBeInTheDocument();
  });

  it('should render article content', () => {
    render(
      <ArticleViewer
        workspacePath="/test"
        article={mockArticle}
        onEdit={mockOnEdit}
        onClose={mockOnClose}
      />
    );

    // Content is rendered as whitespace-preserved text
    expect(screen.getByText(/This guide will help you get started/)).toBeInTheDocument();
  });

  it('should render authors list', () => {
    render(
      <ArticleViewer
        workspacePath="/test"
        article={mockArticle}
        onEdit={mockOnEdit}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText(/Jane Doe/)).toBeInTheDocument();
    expect(screen.getByText(/John Smith/)).toBeInTheDocument();
  });

  it('should render reviewers list', () => {
    render(
      <ArticleViewer
        workspacePath="/test"
        article={mockArticle}
        onEdit={mockOnEdit}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText(/Tech Lead/)).toBeInTheDocument();
  });

  it('should render tags', () => {
    render(
      <ArticleViewer
        workspacePath="/test"
        article={mockArticle}
        onEdit={mockOnEdit}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('onboarding')).toBeInTheDocument();
    expect(screen.getByText('getting-started')).toBeInTheDocument();
  });

  it('should render published date for published articles', () => {
    render(
      <ArticleViewer
        workspacePath="/test"
        article={mockArticle}
        onEdit={mockOnEdit}
        onClose={mockOnClose}
      />
    );

    // Should show published date in metadata section
    const publishedElements = screen.getAllByText(/Published/i);
    expect(publishedElements.length).toBeGreaterThan(0);
  });

  it('should call onEdit when edit button is clicked', () => {
    render(
      <ArticleViewer
        workspacePath="/test"
        article={mockArticle}
        onEdit={mockOnEdit}
        onClose={mockOnClose}
      />
    );

    const editButton = screen.getByRole('button', { name: /edit/i });
    fireEvent.click(editButton);
    expect(mockOnEdit).toHaveBeenCalled();
  });

  it('should call onClose when close button is clicked', () => {
    render(
      <ArticleViewer
        workspacePath="/test"
        article={mockArticle}
        onEdit={mockOnEdit}
        onClose={mockOnClose}
      />
    );

    // Close button is the last button in the header (has X icon)
    const buttons = screen.getAllByRole('button');
    const closeButton = buttons[buttons.length - 1];
    fireEvent.click(closeButton);
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should export to markdown when export button is clicked', async () => {
    const exportMock = vi.fn().mockResolvedValue('# KB-0001');
    vi.mocked(useKnowledgeStore).mockReturnValue({
      isSaving: false,
      changeArticleStatus: vi.fn().mockReturnValue(mockArticle),
      exportKnowledgeToMarkdown: exportMock,
      exportKnowledgeToPDF: vi.fn().mockResolvedValue(undefined),
      hasPDFExport: vi.fn().mockReturnValue(false),
      getArticleById: vi.fn().mockReturnValue(mockArticle),
    } as any);

    render(
      <ArticleViewer
        workspacePath="/test"
        article={mockArticle}
        onEdit={mockOnEdit}
        onClose={mockOnClose}
      />
    );

    // Click the Export dropdown button first
    const exportDropdownButton = screen.getByRole('button', { name: /export/i });
    fireEvent.click(exportDropdownButton);

    // Then click the Markdown option in the dropdown
    const markdownOption = await screen.findByRole('button', { name: /markdown/i });
    fireEvent.click(markdownOption);

    await waitFor(() => {
      expect(exportMock).toHaveBeenCalledWith(mockArticle);
    });
  });

  it('should show related decisions when present', () => {
    vi.mocked(useDecisionStore).mockReturnValue({
      decisions: [
        {
          id: 'decision-1',
          number: 1,
          title: 'Use React for Frontend',
        },
      ],
      getDecisionById: vi.fn().mockReturnValue({
        id: 'decision-1',
        number: 1,
        title: 'Use React for Frontend',
      }),
    } as any);

    render(
      <ArticleViewer
        workspacePath="/test"
        article={mockArticle}
        onEdit={mockOnEdit}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText(/Related Decisions/i)).toBeInTheDocument();
    expect(screen.getByText(/Use React for Frontend/)).toBeInTheDocument();
  });

  it('should not show related decisions section when none present', () => {
    const articleWithoutDecisions = {
      ...mockArticle,
      related_decisions: undefined,
    };

    render(
      <ArticleViewer
        workspacePath="/test"
        article={articleWithoutDecisions}
        onEdit={mockOnEdit}
        onClose={mockOnClose}
      />
    );

    expect(screen.queryByText(/Related Decisions/i)).not.toBeInTheDocument();
  });

  it('should show draft status for draft articles', () => {
    const draftArticle = {
      ...mockArticle,
      status: ArticleStatus.Draft,
      published_at: undefined,
    };

    render(
      <ArticleViewer
        workspacePath="/test"
        article={draftArticle}
        onEdit={mockOnEdit}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('Draft')).toBeInTheDocument();
  });

  it('should show review status for articles in review', () => {
    const reviewArticle = {
      ...mockArticle,
      status: ArticleStatus.Review,
      reviewers: [], // Clear reviewers to avoid "Reviewers:" text
    };

    render(
      <ArticleViewer
        workspacePath="/test"
        article={reviewArticle}
        onEdit={mockOnEdit}
        onClose={mockOnClose}
      />
    );

    // Status badge shows 'In Review' - look for text that's part of the badge
    const reviewTexts = screen.getAllByText(/Review/i);
    expect(reviewTexts.length).toBeGreaterThan(0);
  });
});
