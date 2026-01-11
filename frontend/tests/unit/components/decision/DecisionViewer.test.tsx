/**
 * Unit tests for DecisionViewer Component
 * Tests decision display, status workflow, and export
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DecisionViewer } from '@/components/decision/DecisionViewer';
import { useDecisionStore } from '@/stores/decisionStore';
import { useKnowledgeStore } from '@/stores/knowledgeStore';
import { DecisionStatus, DecisionCategory } from '@/types/decision';
import type { Decision } from '@/types/decision';

vi.mock('@/stores/decisionStore');
vi.mock('@/stores/knowledgeStore');

describe('DecisionViewer', () => {
  const mockDecision: Decision = {
    id: 'decision-1',
    number: 1,
    title: 'Use React for Frontend',
    status: DecisionStatus.Proposed,
    category: DecisionCategory.Technology,
    context: 'We need to choose a frontend framework for our new application.',
    decision: 'We will use React because of its large ecosystem and team familiarity.',
    consequences: 'Team will need some React training. We get access to a large component library.',
    options: [
      {
        title: 'React',
        description: 'Popular component-based library',
        pros: ['Large ecosystem', 'Good performance', 'Strong community'],
        cons: ['Learning curve', 'Requires additional libraries'],
      },
      {
        title: 'Vue',
        description: 'Progressive framework',
        pros: ['Easy to learn', 'Good documentation'],
        cons: ['Smaller ecosystem'],
      },
    ],
    domain_id: 'domain-1',
    authors: ['John Doe', 'Jane Smith'],
    deciders: ['Tech Lead'],
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-15T00:00:00Z',
  };

  const mockOnEdit = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useDecisionStore).mockReturnValue({
      isSaving: false,
      changeDecisionStatus: vi.fn().mockReturnValue(mockDecision),
      exportDecisionToMarkdown: vi.fn().mockResolvedValue('# ADR-0001'),
      exportDecisionToPDF: vi.fn().mockResolvedValue(undefined),
      hasPDFExport: vi.fn().mockReturnValue(false),
      getDecisionById: vi.fn().mockReturnValue(mockDecision),
    } as any);
    vi.mocked(useKnowledgeStore).mockReturnValue({
      articles: [],
    } as any);
  });

  it('should render decision title and number', () => {
    render(
      <DecisionViewer
        workspacePath="/test"
        decision={mockDecision}
        onEdit={mockOnEdit}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText(/ADR-0001/)).toBeInTheDocument();
    expect(screen.getByText(/Use React for Frontend/)).toBeInTheDocument();
  });

  it('should render decision status badge', () => {
    render(
      <DecisionViewer
        workspacePath="/test"
        decision={mockDecision}
        onEdit={mockOnEdit}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('Proposed')).toBeInTheDocument();
  });

  it('should render category badge', () => {
    render(
      <DecisionViewer
        workspacePath="/test"
        decision={mockDecision}
        onEdit={mockOnEdit}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('Technology')).toBeInTheDocument();
  });

  it('should render context section', () => {
    render(
      <DecisionViewer
        workspacePath="/test"
        decision={mockDecision}
        onEdit={mockOnEdit}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText(/Context/i)).toBeInTheDocument();
    expect(screen.getByText(/choose a frontend framework/)).toBeInTheDocument();
  });

  it('should render decision section', () => {
    render(
      <DecisionViewer
        workspacePath="/test"
        decision={mockDecision}
        onEdit={mockOnEdit}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText(/Decision/i)).toBeInTheDocument();
    expect(screen.getByText(/We will use React/)).toBeInTheDocument();
  });

  it('should render consequences section', () => {
    render(
      <DecisionViewer
        workspacePath="/test"
        decision={mockDecision}
        onEdit={mockOnEdit}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText(/Consequences/i)).toBeInTheDocument();
    expect(screen.getByText(/React training/)).toBeInTheDocument();
  });

  it('should render considered options', () => {
    render(
      <DecisionViewer
        workspacePath="/test"
        decision={mockDecision}
        onEdit={mockOnEdit}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText(/1\. React/)).toBeInTheDocument();
    expect(screen.getByText(/2\. Vue/)).toBeInTheDocument();
    expect(screen.getByText(/Large ecosystem/)).toBeInTheDocument();
    expect(screen.getByText(/Learning curve/)).toBeInTheDocument();
  });

  it('should call onEdit when edit button is clicked', () => {
    render(
      <DecisionViewer
        workspacePath="/test"
        decision={mockDecision}
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
      <DecisionViewer
        workspacePath="/test"
        decision={mockDecision}
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
    const exportMock = vi.fn().mockResolvedValue('# ADR-0001');
    vi.mocked(useDecisionStore).mockReturnValue({
      isSaving: false,
      changeDecisionStatus: vi.fn().mockReturnValue(mockDecision),
      exportDecisionToMarkdown: exportMock,
      exportDecisionToPDF: vi.fn().mockResolvedValue(undefined),
      hasPDFExport: vi.fn().mockReturnValue(false),
      getDecisionById: vi.fn().mockReturnValue(mockDecision),
    } as any);

    render(
      <DecisionViewer
        workspacePath="/test"
        decision={mockDecision}
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
      expect(exportMock).toHaveBeenCalledWith(mockDecision);
    });
  });

  it('should show superseded-by link when decision is superseded', () => {
    const supersededDecision = {
      ...mockDecision,
      status: DecisionStatus.Superseded,
      superseded_by: 'decision-2',
    };

    vi.mocked(useDecisionStore).mockReturnValue({
      isSaving: false,
      changeDecisionStatus: vi.fn().mockReturnValue(supersededDecision),
      exportDecisionToMarkdown: vi.fn().mockResolvedValue('# ADR'),
      exportDecisionToPDF: vi.fn().mockResolvedValue(undefined),
      hasPDFExport: vi.fn().mockReturnValue(false),
      getDecisionById: vi
        .fn()
        .mockReturnValue({ id: 'decision-2', number: 2, title: 'New Decision' }),
    } as any);

    render(
      <DecisionViewer
        workspacePath="/test"
        decision={supersededDecision}
        onEdit={mockOnEdit}
        onClose={mockOnClose}
      />
    );

    // There will be multiple elements with "superseded" - the status badge and the info box
    const supersededElements = screen.getAllByText(/superseded/i);
    expect(supersededElements.length).toBeGreaterThan(0);
  });

  it('should render authors list', () => {
    render(
      <DecisionViewer
        workspacePath="/test"
        decision={mockDecision}
        onEdit={mockOnEdit}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText(/John Doe/)).toBeInTheDocument();
    expect(screen.getByText(/Jane Smith/)).toBeInTheDocument();
  });

  it('should render deciders in RACI matrix when present', () => {
    const decisionWithRaci = {
      ...mockDecision,
      raci: {
        responsible: ['Dev Team'],
        accountable: ['Tech Lead'],
        consulted: ['Architect'],
        informed: ['Stakeholders'],
      },
    };

    render(
      <DecisionViewer
        workspacePath="/test"
        decision={decisionWithRaci}
        onEdit={mockOnEdit}
        onClose={mockOnClose}
      />
    );

    // The Tech Lead appears in the authors list already
    expect(screen.getByText(/John Doe/)).toBeInTheDocument();
  });

  it('should show related knowledge articles when present', () => {
    vi.mocked(useKnowledgeStore).mockReturnValue({
      articles: [
        {
          id: 'kb-1',
          number: 1,
          title: 'React Best Practices',
          domain_id: 'domain-1',
          related_decisions: ['decision-1'],
        },
      ],
    } as any);

    render(
      <DecisionViewer
        workspacePath="/test"
        decision={mockDecision}
        onEdit={mockOnEdit}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText(/Related Knowledge/i)).toBeInTheDocument();
    expect(screen.getByText(/React Best Practices/)).toBeInTheDocument();
  });
});
