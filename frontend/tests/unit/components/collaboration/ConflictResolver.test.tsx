/**
 * Component tests for Conflict Resolver
 * Tests conflict warning display and resolution
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConflictResolver } from '@/components/collaboration/ConflictResolver';
import * as collaborationStore from '@/stores/collaborationStore';

vi.mock('@/stores/collaborationStore', () => ({
  useCollaborationStore: vi.fn(),
}));

describe('ConflictResolver', () => {
  const mockConflicts = [
    {
      id: 'conflict-1',
      elementType: 'table' as const,
      elementId: 'table-1',
      message: 'Table has already been deleted',
      timestamp: '2025-01-01T00:00:00Z',
    },
    {
      id: 'conflict-2',
      elementType: 'relationship' as const,
      elementId: 'rel-1',
      message: 'Relationship was modified by another user',
      timestamp: '2025-01-01T00:01:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(collaborationStore.useCollaborationStore).mockReturnValue({
      conflicts: mockConflicts,
      removeConflict: vi.fn(),
      clearConflicts: vi.fn(),
    } as any);
  });

  it('should render nothing when no conflicts', () => {
    vi.mocked(collaborationStore.useCollaborationStore).mockReturnValue({
      conflicts: [],
      removeConflict: vi.fn(),
      clearConflicts: vi.fn(),
    } as any);

    const { container } = render(<ConflictResolver isOpen={true} onClose={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('should display conflicts when open', () => {
    render(<ConflictResolver isOpen={true} onClose={vi.fn()} />);
    
    expect(screen.getByText('Table has already been deleted')).toBeInTheDocument();
    expect(screen.getByText('Relationship was modified by another user')).toBeInTheDocument();
  });

  it('should dismiss individual conflict', () => {
    const removeConflict = vi.fn();
    vi.mocked(collaborationStore.useCollaborationStore).mockReturnValue({
      conflicts: mockConflicts,
      removeConflict,
      clearConflicts: vi.fn(),
    } as any);

    render(<ConflictResolver isOpen={true} onClose={vi.fn()} />);
    
    const dismissButtons = screen.getAllByTitle('Dismiss');
    fireEvent.click(dismissButtons[0]);

    expect(removeConflict).toHaveBeenCalledWith('conflict-1');
  });

  it('should dismiss all conflicts', () => {
    const clearConflicts = vi.fn();
    const onClose = vi.fn();
    vi.mocked(collaborationStore.useCollaborationStore).mockReturnValue({
      conflicts: mockConflicts,
      removeConflict: vi.fn(),
      clearConflicts,
    } as any);

    render(<ConflictResolver isOpen={true} onClose={onClose} />);
    
    fireEvent.click(screen.getByText('Dismiss All'));

    expect(clearConflicts).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('should close dialog when last conflict is dismissed', () => {
    const removeConflict = vi.fn();
    const onClose = vi.fn();
    vi.mocked(collaborationStore.useCollaborationStore).mockReturnValue({
      conflicts: [mockConflicts[0]],
      removeConflict,
      clearConflicts: vi.fn(),
    } as any);

    render(<ConflictResolver isOpen={true} onClose={onClose} />);
    
    const dismissButton = screen.getByTitle('Dismiss');
    fireEvent.click(dismissButton);

    expect(removeConflict).toHaveBeenCalledWith('conflict-1');
    expect(onClose).toHaveBeenCalled();
  });
});

