/**
 * Unit tests for DecisionList Component
 * Tests the decision list UI with filtering and sorting
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DecisionList } from '@/components/decision/DecisionList';
import { useDecisionStore } from '@/stores/decisionStore';
import { DecisionStatus, DecisionCategory } from '@/types/decision';
import type { Decision } from '@/types/decision';

// Mock the decision store
vi.mock('@/stores/decisionStore', () => ({
  useDecisionStore: vi.fn(),
}));

// Mock child components
vi.mock('@/components/decision/DecisionStatusBadge', () => ({
  DecisionStatusBadge: ({ status }: { status: string }) => (
    <span data-testid="status-badge">{status}</span>
  ),
}));

vi.mock('@/components/decision/DecisionCategoryBadge', () => ({
  DecisionCategoryBadge: ({ category }: { category: string }) => (
    <span data-testid="category-badge">{category}</span>
  ),
}));

describe('DecisionList', () => {
  const mockWorkspacePath = '/test/workspace';

  const mockDecisions: Decision[] = [
    {
      id: 'decision-1',
      number: 1,
      title: 'Use React for Frontend',
      status: DecisionStatus.Accepted,
      category: DecisionCategory.Technology,
      context: 'We need to choose a frontend framework',
      decision: 'We will use React',
      consequences: 'Need to train team',
      options: [],
      domain_id: 'domain-1',
      authors: ['John Doe'],
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-15T00:00:00Z',
    },
    {
      id: 'decision-2',
      number: 2,
      title: 'Database Selection',
      status: DecisionStatus.Draft,
      category: DecisionCategory.Data,
      context: 'We need to choose a database',
      decision: 'Pending',
      consequences: '',
      options: [],
      domain_id: 'domain-1',
      authors: ['Jane Smith'],
      created_at: '2024-01-10T00:00:00Z',
      updated_at: '2024-01-20T00:00:00Z',
    },
    {
      id: 'decision-3',
      number: 3,
      title: 'Security Framework',
      status: DecisionStatus.Proposed,
      category: DecisionCategory.Security,
      context: 'Security implementation needed',
      decision: 'Under review',
      consequences: '',
      options: [],
      domain_id: 'domain-2',
      authors: ['Bob Wilson'],
      created_at: '2024-01-05T00:00:00Z',
      updated_at: '2024-01-25T00:00:00Z',
      decided_at: '2024-01-25T00:00:00Z',
    },
  ];

  const mockStoreState = {
    filteredDecisions: mockDecisions,
    decisions: mockDecisions,
    selectedDecision: null,
    filter: {},
    isLoading: false,
    error: null,
    setFilter: vi.fn(),
    setSelectedDecision: vi.fn(),
    clearError: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useDecisionStore).mockReturnValue(mockStoreState);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('rendering', () => {
    it('should render the decision list header', () => {
      render(<DecisionList workspacePath={mockWorkspacePath} />);

      expect(screen.getByText('Decisions')).toBeInTheDocument();
    });

    it('should render all decisions', () => {
      render(<DecisionList workspacePath={mockWorkspacePath} />);

      expect(screen.getByText('Use React for Frontend')).toBeInTheDocument();
      expect(screen.getByText('Database Selection')).toBeInTheDocument();
      expect(screen.getByText('Security Framework')).toBeInTheDocument();
    });

    it('should render decision numbers', () => {
      render(<DecisionList workspacePath={mockWorkspacePath} />);

      expect(screen.getByText('ADR-0001')).toBeInTheDocument();
      expect(screen.getByText('ADR-0002')).toBeInTheDocument();
      expect(screen.getByText('ADR-0003')).toBeInTheDocument();
    });

    it('should render status and category badges', () => {
      render(<DecisionList workspacePath={mockWorkspacePath} />);

      const statusBadges = screen.getAllByTestId('status-badge');
      const categoryBadges = screen.getAllByTestId('category-badge');

      expect(statusBadges).toHaveLength(3);
      expect(categoryBadges).toHaveLength(3);
    });

    it('should show footer with decision count', () => {
      render(<DecisionList workspacePath={mockWorkspacePath} />);

      expect(screen.getByText('3 of 3 decisions')).toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('should show loading spinner when loading', () => {
      vi.mocked(useDecisionStore).mockReturnValue({
        ...mockStoreState,
        isLoading: true,
      });

      render(<DecisionList workspacePath={mockWorkspacePath} />);

      expect(screen.getByText('Loading decisions...')).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('should show error message when there is an error', () => {
      vi.mocked(useDecisionStore).mockReturnValue({
        ...mockStoreState,
        error: 'Failed to load decisions',
      });

      render(<DecisionList workspacePath={mockWorkspacePath} />);

      expect(screen.getByText('Failed to load decisions')).toBeInTheDocument();
    });

    it('should show retry button on error', () => {
      vi.mocked(useDecisionStore).mockReturnValue({
        ...mockStoreState,
        error: 'Network error',
      });

      render(<DecisionList workspacePath={mockWorkspacePath} />);

      expect(screen.getByText('Retry')).toBeInTheDocument();
    });

    it('should call setFilter on retry click', async () => {
      const mockSetFilter = vi.fn();
      vi.mocked(useDecisionStore).mockReturnValue({
        ...mockStoreState,
        error: 'Network error',
        setFilter: mockSetFilter,
      });

      render(<DecisionList workspacePath={mockWorkspacePath} />);

      const retryButton = screen.getByText('Retry');
      await userEvent.click(retryButton);

      expect(mockSetFilter).toHaveBeenCalledWith({ domain_id: undefined });
    });
  });

  describe('empty state', () => {
    it('should show empty state when no decisions', () => {
      vi.mocked(useDecisionStore).mockReturnValue({
        ...mockStoreState,
        filteredDecisions: [],
      });

      render(<DecisionList workspacePath={mockWorkspacePath} />);

      expect(screen.getByText('No decisions found')).toBeInTheDocument();
      expect(screen.getByText('Create your first decision to get started')).toBeInTheDocument();
    });

    it('should show filter hint when no decisions match filter', () => {
      vi.mocked(useDecisionStore).mockReturnValue({
        ...mockStoreState,
        filteredDecisions: [],
        filter: { status: [DecisionStatus.Rejected] },
      });

      render(<DecisionList workspacePath={mockWorkspacePath} />);

      expect(screen.getByText('Try adjusting your filters')).toBeInTheDocument();
    });
  });

  describe('create button', () => {
    it('should render create button when onCreateDecision is provided', () => {
      const mockOnCreate = vi.fn();

      render(<DecisionList workspacePath={mockWorkspacePath} onCreateDecision={mockOnCreate} />);

      expect(screen.getByText('New Decision')).toBeInTheDocument();
    });

    it('should not render create button when onCreateDecision is not provided', () => {
      render(<DecisionList workspacePath={mockWorkspacePath} />);

      expect(screen.queryByText('New Decision')).not.toBeInTheDocument();
    });

    it('should call onCreateDecision when create button is clicked', async () => {
      const mockOnCreate = vi.fn();

      render(<DecisionList workspacePath={mockWorkspacePath} onCreateDecision={mockOnCreate} />);

      // Click dropdown button to open menu
      await userEvent.click(screen.getByText('New Decision'));

      // Click the "New Decision" option in dropdown
      const dropdownOptions = screen.getAllByText('New Decision');
      await userEvent.click(dropdownOptions[dropdownOptions.length - 1]);

      expect(mockOnCreate).toHaveBeenCalled();
    });
  });

  describe('selection', () => {
    it('should call setSelectedDecision and onSelectDecision when decision is clicked', async () => {
      const mockOnSelect = vi.fn();
      const mockSetSelected = vi.fn();

      vi.mocked(useDecisionStore).mockReturnValue({
        ...mockStoreState,
        setSelectedDecision: mockSetSelected,
      });

      render(<DecisionList workspacePath={mockWorkspacePath} onSelectDecision={mockOnSelect} />);

      await userEvent.click(screen.getByText('Use React for Frontend'));

      expect(mockSetSelected).toHaveBeenCalledWith(mockDecisions[0]);
      expect(mockOnSelect).toHaveBeenCalledWith(mockDecisions[0]);
    });

    it('should highlight selected decision', () => {
      vi.mocked(useDecisionStore).mockReturnValue({
        ...mockStoreState,
        selectedDecision: mockDecisions[0],
      });

      render(<DecisionList workspacePath={mockWorkspacePath} />);

      // The selected decision should have the blue highlight class
      const selectedItem = screen
        .getByText('Use React for Frontend')
        .closest('div[class*="cursor-pointer"]');
      expect(selectedItem).toHaveClass('bg-blue-50');
    });
  });

  describe('search', () => {
    it('should render search input', () => {
      render(<DecisionList workspacePath={mockWorkspacePath} />);

      expect(screen.getByPlaceholderText('Search decisions...')).toBeInTheDocument();
    });

    it('should update search input value', async () => {
      render(<DecisionList workspacePath={mockWorkspacePath} />);

      const searchInput = screen.getByPlaceholderText('Search decisions...');
      await userEvent.type(searchInput, 'React');

      expect(searchInput).toHaveValue('React');
    });

    it('should call setFilter with debounced search', async () => {
      vi.useFakeTimers();
      const mockSetFilter = vi.fn();

      vi.mocked(useDecisionStore).mockReturnValue({
        ...mockStoreState,
        setFilter: mockSetFilter,
      });

      render(<DecisionList workspacePath={mockWorkspacePath} />);

      const searchInput = screen.getByPlaceholderText('Search decisions...');
      fireEvent.change(searchInput, { target: { value: 'React' } });

      // Fast-forward the debounce timer
      vi.advanceTimersByTime(300);

      // setFilter is now called with a functional updater
      expect(mockSetFilter).toHaveBeenCalled();
      const lastCall = mockSetFilter.mock.calls[mockSetFilter.mock.calls.length - 1][0];
      // If it's a function, call it with empty filter to get the result
      const result = typeof lastCall === 'function' ? lastCall({}) : lastCall;
      expect(result).toEqual(expect.objectContaining({ search: 'React' }));

      vi.useRealTimers();
    });
  });

  describe('filters', () => {
    it('should toggle filter panel visibility', async () => {
      render(<DecisionList workspacePath={mockWorkspacePath} />);

      // Filters panel should be hidden initially (look for filter section headings)
      expect(screen.queryByText('Draft')).not.toBeInTheDocument();

      // Click to show filters
      await userEvent.click(screen.getByText('Filters'));

      // Filters panel should now be visible with status options
      expect(screen.getByText('Draft')).toBeInTheDocument();
      expect(screen.getByText('Proposed')).toBeInTheDocument();
    });

    it('should show active filters indicator', () => {
      vi.mocked(useDecisionStore).mockReturnValue({
        ...mockStoreState,
        filter: { status: [DecisionStatus.Draft] },
      });

      render(<DecisionList workspacePath={mockWorkspacePath} />);

      expect(screen.getByText('Active')).toBeInTheDocument();
    });

    it('should show clear filters button when filters are active', () => {
      vi.mocked(useDecisionStore).mockReturnValue({
        ...mockStoreState,
        filter: { status: [DecisionStatus.Draft] },
      });

      render(<DecisionList workspacePath={mockWorkspacePath} />);

      expect(screen.getByText('Clear filters')).toBeInTheDocument();
    });

    it('should clear filters when clear button is clicked', async () => {
      const mockSetFilter = vi.fn();

      vi.mocked(useDecisionStore).mockReturnValue({
        ...mockStoreState,
        filter: { status: [DecisionStatus.Draft] },
        setFilter: mockSetFilter,
      });

      render(<DecisionList workspacePath={mockWorkspacePath} />);

      await userEvent.click(screen.getByText('Clear filters'));

      expect(mockSetFilter).toHaveBeenCalledWith({ domain_id: undefined });
    });
  });

  describe('sorting', () => {
    it('should render sort controls', () => {
      render(<DecisionList workspacePath={mockWorkspacePath} />);

      expect(screen.getByText('Sort by:')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Number/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Title/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Status/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Updated/ })).toBeInTheDocument();
    });

    it('should highlight active sort field', () => {
      render(<DecisionList workspacePath={mockWorkspacePath} />);

      // Number is the default sort field
      const numberButton = screen.getByRole('button', { name: /Number/ });
      expect(numberButton).toHaveClass('bg-gray-200');
    });

    it('should show sort direction indicator', () => {
      render(<DecisionList workspacePath={mockWorkspacePath} />);

      // Default is descending
      expect(screen.getByText('↓')).toBeInTheDocument();
    });

    it('should toggle sort order when clicking active sort field', async () => {
      render(<DecisionList workspacePath={mockWorkspacePath} />);

      const numberButton = screen.getByRole('button', { name: /Number/ });
      await userEvent.click(numberButton);

      // Should toggle to ascending
      expect(screen.getByText('↑')).toBeInTheDocument();
    });
  });

  describe('domain filtering', () => {
    it('should set domain filter when domainId is provided', () => {
      const mockSetFilter = vi.fn();

      vi.mocked(useDecisionStore).mockReturnValue({
        ...mockStoreState,
        setFilter: mockSetFilter,
      });

      render(<DecisionList workspacePath={mockWorkspacePath} domainId="domain-1" />);

      expect(mockSetFilter).toHaveBeenCalledWith(
        expect.objectContaining({ domain_id: 'domain-1' })
      );
    });

    it('should not set domain filter when no domainId', () => {
      const mockSetFilter = vi.fn();

      vi.mocked(useDecisionStore).mockReturnValue({
        ...mockStoreState,
        setFilter: mockSetFilter,
      });

      render(<DecisionList workspacePath={mockWorkspacePath} />);

      // setFilter should not be called with domain_id (or not called at all for domain filtering)
      const domainCalls = mockSetFilter.mock.calls.filter(
        (call) => call[0]?.domain_id !== undefined
      );
      expect(domainCalls.length).toBe(0);
    });
  });

  describe('decision details', () => {
    it('should show decision context', () => {
      render(<DecisionList workspacePath={mockWorkspacePath} />);

      expect(screen.getByText('We need to choose a frontend framework')).toBeInTheDocument();
    });

    it('should show updated date', () => {
      render(<DecisionList workspacePath={mockWorkspacePath} />);

      // Check that update dates are shown (format may vary by locale)
      const updateTexts = screen.getAllByText(/Updated/);
      expect(updateTexts.length).toBeGreaterThan(0);
    });

    it('should show decided date when available', () => {
      render(<DecisionList workspacePath={mockWorkspacePath} />);

      // The third decision has a decided_at date
      expect(screen.getByText(/Decided/)).toBeInTheDocument();
    });
  });
});
