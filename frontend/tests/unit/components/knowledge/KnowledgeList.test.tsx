/**
 * Unit tests for KnowledgeList Component
 * Tests the knowledge article list UI with filtering and sorting
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { KnowledgeList } from '@/components/knowledge/KnowledgeList';
import { useKnowledgeStore } from '@/stores/knowledgeStore';
import { ArticleType, ArticleStatus } from '@/types/knowledge';
import type { KnowledgeArticle } from '@/types/knowledge';

// Mock the knowledge store
vi.mock('@/stores/knowledgeStore', () => ({
  useKnowledgeStore: vi.fn(),
}));

// Mock child components
vi.mock('@/components/knowledge/ArticleTypeBadge', () => ({
  ArticleTypeBadge: ({ type }: { type: string }) => <span data-testid="type-badge">{type}</span>,
}));

vi.mock('@/components/knowledge/ArticleStatusBadge', () => ({
  ArticleStatusBadge: ({ status }: { status: string }) => (
    <span data-testid="status-badge">{status}</span>
  ),
}));

describe('KnowledgeList', () => {
  const mockWorkspacePath = '/test/workspace';

  const mockArticles: KnowledgeArticle[] = [
    {
      id: 'article-1',
      number: 1,
      title: 'Getting Started Guide',
      type: ArticleType.Guide,
      status: ArticleStatus.Published,
      summary: 'A comprehensive guide to getting started',
      content: '# Getting Started\n\nContent here.',
      domain_id: 'domain-1',
      authors: ['Jane Doe'],
      reviewers: ['John Smith'],
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-15T00:00:00Z',
      published_at: '2024-01-10T00:00:00Z',
    },
    {
      id: 'article-2',
      number: 2,
      title: 'API Reference',
      type: ArticleType.Reference,
      status: ArticleStatus.Draft,
      summary: 'Complete API documentation',
      content: '# API Reference\n\nDocumentation.',
      domain_id: 'domain-1',
      authors: ['Bob Wilson'],
      reviewers: [],
      created_at: '2024-01-05T00:00:00Z',
      updated_at: '2024-01-20T00:00:00Z',
    },
    {
      id: 'article-3',
      number: 3,
      title: 'Troubleshooting Common Issues',
      type: ArticleType.Troubleshooting,
      status: ArticleStatus.Review,
      summary: 'How to resolve common problems',
      content: '# Troubleshooting\n\nSolutions.',
      domain_id: 'domain-2',
      authors: ['Alice Brown', 'Charlie Davis'],
      reviewers: ['Jane Doe'],
      created_at: '2024-01-10T00:00:00Z',
      updated_at: '2024-01-25T00:00:00Z',
    },
  ];

  const mockStoreState = {
    filteredArticles: mockArticles,
    articles: mockArticles,
    selectedArticle: null,
    filter: {},
    isLoading: false,
    error: null,
    setFilter: vi.fn(),
    setSelectedArticle: vi.fn(),
    clearError: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useKnowledgeStore).mockReturnValue(mockStoreState);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('rendering', () => {
    it('should render the knowledge list header', () => {
      render(<KnowledgeList workspacePath={mockWorkspacePath} />);

      expect(screen.getByText('Knowledge Base')).toBeInTheDocument();
    });

    it('should render all articles', () => {
      render(<KnowledgeList workspacePath={mockWorkspacePath} />);

      expect(screen.getByText('Getting Started Guide')).toBeInTheDocument();
      expect(screen.getByText('API Reference')).toBeInTheDocument();
      expect(screen.getByText('Troubleshooting Common Issues')).toBeInTheDocument();
    });

    it('should render article numbers', () => {
      render(<KnowledgeList workspacePath={mockWorkspacePath} />);

      expect(screen.getByText('KB-0001')).toBeInTheDocument();
      expect(screen.getByText('KB-0002')).toBeInTheDocument();
      expect(screen.getByText('KB-0003')).toBeInTheDocument();
    });

    it('should render type and status badges', () => {
      render(<KnowledgeList workspacePath={mockWorkspacePath} />);

      const typeBadges = screen.getAllByTestId('type-badge');
      const statusBadges = screen.getAllByTestId('status-badge');

      expect(typeBadges).toHaveLength(3);
      expect(statusBadges).toHaveLength(3);
    });

    it('should show footer with article count', () => {
      render(<KnowledgeList workspacePath={mockWorkspacePath} />);

      expect(screen.getByText('3 of 3 articles')).toBeInTheDocument();
    });

    it('should show article summaries', () => {
      render(<KnowledgeList workspacePath={mockWorkspacePath} />);

      expect(screen.getByText('A comprehensive guide to getting started')).toBeInTheDocument();
      expect(screen.getByText('Complete API documentation')).toBeInTheDocument();
    });

    it('should show author information', () => {
      render(<KnowledgeList workspacePath={mockWorkspacePath} />);

      expect(screen.getByText('By Jane Doe')).toBeInTheDocument();
      expect(screen.getByText('By Alice Brown +1')).toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('should show loading spinner when loading', () => {
      vi.mocked(useKnowledgeStore).mockReturnValue({
        ...mockStoreState,
        isLoading: true,
      });

      render(<KnowledgeList workspacePath={mockWorkspacePath} />);

      expect(screen.getByText('Loading articles...')).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('should show error message when there is an error', () => {
      vi.mocked(useKnowledgeStore).mockReturnValue({
        ...mockStoreState,
        error: 'Failed to load articles',
      });

      render(<KnowledgeList workspacePath={mockWorkspacePath} />);

      expect(screen.getByText('Failed to load articles')).toBeInTheDocument();
    });

    it('should show retry button on error', () => {
      vi.mocked(useKnowledgeStore).mockReturnValue({
        ...mockStoreState,
        error: 'Network error',
      });

      render(<KnowledgeList workspacePath={mockWorkspacePath} />);

      expect(screen.getByText('Retry')).toBeInTheDocument();
    });

    it('should call setFilter on retry click', async () => {
      const mockSetFilter = vi.fn();
      vi.mocked(useKnowledgeStore).mockReturnValue({
        ...mockStoreState,
        error: 'Network error',
        setFilter: mockSetFilter,
      });

      render(<KnowledgeList workspacePath={mockWorkspacePath} />);

      const retryButton = screen.getByText('Retry');
      await userEvent.click(retryButton);

      expect(mockSetFilter).toHaveBeenCalledWith({ domain_id: undefined });
    });
  });

  describe('empty state', () => {
    it('should show empty state when no articles', () => {
      vi.mocked(useKnowledgeStore).mockReturnValue({
        ...mockStoreState,
        filteredArticles: [],
      });

      render(<KnowledgeList workspacePath={mockWorkspacePath} />);

      expect(screen.getByText('No articles found')).toBeInTheDocument();
      expect(screen.getByText('Create your first article to get started')).toBeInTheDocument();
    });

    it('should show filter hint when no articles match filter', () => {
      vi.mocked(useKnowledgeStore).mockReturnValue({
        ...mockStoreState,
        filteredArticles: [],
        filter: { type: [ArticleType.Runbook] },
      });

      render(<KnowledgeList workspacePath={mockWorkspacePath} />);

      expect(screen.getByText('Try adjusting your filters')).toBeInTheDocument();
    });
  });

  describe('create button', () => {
    it('should render create button when onCreateArticle is provided', () => {
      const mockOnCreate = vi.fn();

      render(<KnowledgeList workspacePath={mockWorkspacePath} onCreateArticle={mockOnCreate} />);

      expect(screen.getByText('New Article')).toBeInTheDocument();
    });

    it('should not render create button when onCreateArticle is not provided', () => {
      render(<KnowledgeList workspacePath={mockWorkspacePath} />);

      expect(screen.queryByText('New Article')).not.toBeInTheDocument();
    });

    it('should call onCreateArticle when create button is clicked', async () => {
      const mockOnCreate = vi.fn();

      render(<KnowledgeList workspacePath={mockWorkspacePath} onCreateArticle={mockOnCreate} />);

      // Click dropdown button to open menu
      await userEvent.click(screen.getByText('New Article'));

      // Click the "New Article" option in dropdown
      const dropdownOptions = screen.getAllByText('New Article');
      await userEvent.click(dropdownOptions[dropdownOptions.length - 1]);

      expect(mockOnCreate).toHaveBeenCalled();
    });
  });

  describe('selection', () => {
    it('should call setSelectedArticle and onSelectArticle when article is clicked', async () => {
      const mockOnSelect = vi.fn();
      const mockSetSelected = vi.fn();

      vi.mocked(useKnowledgeStore).mockReturnValue({
        ...mockStoreState,
        setSelectedArticle: mockSetSelected,
      });

      render(<KnowledgeList workspacePath={mockWorkspacePath} onSelectArticle={mockOnSelect} />);

      await userEvent.click(screen.getByText('Getting Started Guide'));

      expect(mockSetSelected).toHaveBeenCalledWith(mockArticles[0]);
      expect(mockOnSelect).toHaveBeenCalledWith(mockArticles[0]);
    });

    it('should highlight selected article', () => {
      vi.mocked(useKnowledgeStore).mockReturnValue({
        ...mockStoreState,
        selectedArticle: mockArticles[0],
      });

      render(<KnowledgeList workspacePath={mockWorkspacePath} />);

      const selectedItem = screen
        .getByText('Getting Started Guide')
        .closest('div[class*="cursor-pointer"]');
      expect(selectedItem).toHaveClass('bg-blue-50');
    });
  });

  describe('search', () => {
    it('should render search input', () => {
      render(<KnowledgeList workspacePath={mockWorkspacePath} />);

      expect(screen.getByPlaceholderText('Search articles...')).toBeInTheDocument();
    });

    it('should update search input value', async () => {
      render(<KnowledgeList workspacePath={mockWorkspacePath} />);

      const searchInput = screen.getByPlaceholderText('Search articles...');
      await userEvent.type(searchInput, 'Getting Started');

      expect(searchInput).toHaveValue('Getting Started');
    });

    it('should call setFilter with debounced search', async () => {
      vi.useFakeTimers();
      const mockSetFilter = vi.fn();

      vi.mocked(useKnowledgeStore).mockReturnValue({
        ...mockStoreState,
        setFilter: mockSetFilter,
      });

      render(<KnowledgeList workspacePath={mockWorkspacePath} />);

      const searchInput = screen.getByPlaceholderText('Search articles...');
      fireEvent.change(searchInput, { target: { value: 'API' } });

      vi.advanceTimersByTime(300);

      // setFilter is now called with a functional updater
      expect(mockSetFilter).toHaveBeenCalled();
      const lastCall = mockSetFilter.mock.calls[mockSetFilter.mock.calls.length - 1][0];
      // If it's a function, call it with empty filter to get the result
      const result = typeof lastCall === 'function' ? lastCall({}) : lastCall;
      expect(result).toEqual(expect.objectContaining({ search: 'API' }));

      vi.useRealTimers();
    });
  });

  describe('filters', () => {
    it('should toggle filter panel visibility', async () => {
      render(<KnowledgeList workspacePath={mockWorkspacePath} />);

      // Filters panel should be hidden initially (look for filter options)
      expect(screen.queryByText('Draft')).not.toBeInTheDocument();

      // Click to show filters
      await userEvent.click(screen.getByText('Filters'));

      // Filters panel should now be visible with status options
      expect(screen.getByText('Draft')).toBeInTheDocument();
      expect(screen.getByText('Published')).toBeInTheDocument();
    });

    it('should show active filters indicator', () => {
      vi.mocked(useKnowledgeStore).mockReturnValue({
        ...mockStoreState,
        filter: { type: [ArticleType.Guide] },
      });

      render(<KnowledgeList workspacePath={mockWorkspacePath} />);

      expect(screen.getByText('Active')).toBeInTheDocument();
    });

    it('should show clear filters button when filters are active', () => {
      vi.mocked(useKnowledgeStore).mockReturnValue({
        ...mockStoreState,
        filter: { status: [ArticleStatus.Draft] },
      });

      render(<KnowledgeList workspacePath={mockWorkspacePath} />);

      expect(screen.getByText('Clear filters')).toBeInTheDocument();
    });

    it('should clear filters when clear button is clicked', async () => {
      const mockSetFilter = vi.fn();

      vi.mocked(useKnowledgeStore).mockReturnValue({
        ...mockStoreState,
        filter: { type: [ArticleType.Guide] },
        setFilter: mockSetFilter,
      });

      render(<KnowledgeList workspacePath={mockWorkspacePath} />);

      await userEvent.click(screen.getByText('Clear filters'));

      expect(mockSetFilter).toHaveBeenCalledWith({ domain_id: undefined });
    });

    it('should show filtered indicator in footer', () => {
      vi.mocked(useKnowledgeStore).mockReturnValue({
        ...mockStoreState,
        filter: { search: 'API' },
      });

      render(<KnowledgeList workspacePath={mockWorkspacePath} />);

      expect(screen.getByText(/\(filtered\)/)).toBeInTheDocument();
    });
  });

  describe('sorting', () => {
    it('should render sort controls', () => {
      render(<KnowledgeList workspacePath={mockWorkspacePath} />);

      expect(screen.getByText('Sort by:')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Number/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Title/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Type/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Updated/ })).toBeInTheDocument();
    });

    it('should highlight active sort field', () => {
      render(<KnowledgeList workspacePath={mockWorkspacePath} />);

      const numberButton = screen.getByRole('button', { name: /Number/ });
      expect(numberButton).toHaveClass('bg-gray-200');
    });

    it('should show sort direction indicator', () => {
      render(<KnowledgeList workspacePath={mockWorkspacePath} />);

      expect(screen.getByText('↓')).toBeInTheDocument();
    });

    it('should toggle sort order when clicking active sort field', async () => {
      render(<KnowledgeList workspacePath={mockWorkspacePath} />);

      const numberButton = screen.getByRole('button', { name: /Number/ });
      await userEvent.click(numberButton);

      expect(screen.getByText('↑')).toBeInTheDocument();
    });

    it('should change sort field when clicking different field', async () => {
      render(<KnowledgeList workspacePath={mockWorkspacePath} />);

      const titleButton = screen.getByRole('button', { name: /Title/ });
      await userEvent.click(titleButton);

      expect(titleButton).toHaveClass('bg-gray-200');
    });
  });

  describe('domain filtering', () => {
    it('should set domain filter when domainId is provided', () => {
      const mockSetFilter = vi.fn();

      vi.mocked(useKnowledgeStore).mockReturnValue({
        ...mockStoreState,
        setFilter: mockSetFilter,
      });

      render(<KnowledgeList workspacePath={mockWorkspacePath} domainId="domain-1" />);

      expect(mockSetFilter).toHaveBeenCalledWith(
        expect.objectContaining({ domain_id: 'domain-1' })
      );
    });

    it('should not set domain filter when no domainId', () => {
      const mockSetFilter = vi.fn();

      vi.mocked(useKnowledgeStore).mockReturnValue({
        ...mockStoreState,
        setFilter: mockSetFilter,
      });

      render(<KnowledgeList workspacePath={mockWorkspacePath} />);

      // setFilter should not be called with domain_id
      const domainCalls = mockSetFilter.mock.calls.filter(
        (call) => call[0]?.domain_id !== undefined
      );
      expect(domainCalls.length).toBe(0);
    });
  });

  describe('article details', () => {
    it('should show updated date', () => {
      render(<KnowledgeList workspacePath={mockWorkspacePath} />);

      const updateTexts = screen.getAllByText(/Updated/);
      expect(updateTexts.length).toBeGreaterThan(0);
    });

    it('should show published date when available', () => {
      render(<KnowledgeList workspacePath={mockWorkspacePath} />);

      expect(screen.getByText(/Published/)).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have accessible search input', () => {
      render(<KnowledgeList workspacePath={mockWorkspacePath} />);

      const searchInput = screen.getByPlaceholderText('Search articles...');
      expect(searchInput).toHaveAttribute('type', 'text');
    });

    it('should use semantic heading for title', () => {
      render(<KnowledgeList workspacePath={mockWorkspacePath} />);

      const heading = screen.getByRole('heading', { name: 'Knowledge Base' });
      expect(heading).toBeInTheDocument();
    });
  });
});
