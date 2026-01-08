/**
 * Unit tests for WorkspaceList Component
 * Tests workspace list display and interactions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WorkspaceList } from '@/components/workspace/WorkspaceList';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import type { Workspace } from '@/types/workspace';

// Mock dependencies
vi.mock('@/stores/workspaceStore', () => ({
  useWorkspaceStore: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

describe('WorkspaceList', () => {
  const mockWorkspaces: Workspace[] = [
    {
      id: 'workspace-1',
      name: 'Personal Workspace',
      type: 'personal',
      owner_id: 'user-1',
      created_at: '2025-01-01T00:00:00Z',
      last_modified_at: '2025-01-01T00:00:00Z',
    },
    {
      id: 'workspace-2',
      name: 'Shared Workspace',
      type: 'shared',
      owner_id: 'user-1',
      created_at: '2025-01-01T00:00:00Z',
      last_modified_at: '2025-01-01T00:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useWorkspaceStore).mockReturnValue({
      workspaces: mockWorkspaces,
      currentWorkspaceId: 'workspace-1',
      isLoading: false,
      setCurrentWorkspace: vi.fn(),
      deleteWorkspaceRemote: vi.fn(),
    } as any);
  });

  it('should render list of workspaces', () => {
    render(<WorkspaceList />);

    expect(screen.getByText('Personal Workspace')).toBeInTheDocument();
    expect(screen.getByText('Shared Workspace')).toBeInTheDocument();
  });

  it('should highlight current workspace', () => {
    const { container } = render(<WorkspaceList />);

    // Find the workspace item that contains "Personal Workspace"
    const workspaceItem = screen.getByText('Personal Workspace').closest('.bg-blue-50');
    expect(workspaceItem).toBeInTheDocument();
  });

  it('should call setCurrentWorkspace when workspace is clicked', async () => {
    const mockSetCurrentWorkspace = vi.fn();
    vi.mocked(useWorkspaceStore).mockReturnValue({
      workspaces: mockWorkspaces,
      currentWorkspaceId: 'workspace-1',
      setCurrentWorkspace: mockSetCurrentWorkspace,
    } as any);

    render(<WorkspaceList />);

    const workspaceItem = screen.getByText('Shared Workspace');
    fireEvent.click(workspaceItem);

    await waitFor(() => {
      expect(mockSetCurrentWorkspace).toHaveBeenCalledWith('workspace-2');
    });
  });

  it('should show delete button for owned workspaces', () => {
    render(<WorkspaceList />);

    const deleteButtons = screen.getAllByLabelText(/delete|remove/i);
    expect(deleteButtons.length).toBeGreaterThan(0);
  });

  it('should call deleteWorkspaceRemote when delete is clicked', async () => {
    // Mock window.confirm to return true
    const originalConfirm = window.confirm;
    window.confirm = vi.fn(() => true);

    const mockDeleteWorkspace = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useWorkspaceStore).mockReturnValue({
      workspaces: mockWorkspaces,
      currentWorkspaceId: 'workspace-1',
      deleteWorkspaceRemote: mockDeleteWorkspace,
    } as any);

    render(<WorkspaceList />);

    const deleteButton = screen.getByLabelText(/Delete Personal Workspace/i);
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(mockDeleteWorkspace).toHaveBeenCalledWith('workspace-1');
    });

    // Restore original confirm
    window.confirm = originalConfirm;
  });

  it('should show loading state when workspaces are loading', () => {
    vi.mocked(useWorkspaceStore).mockReturnValue({
      workspaces: [],
      currentWorkspaceId: null,
      isLoading: true,
    } as any);

    render(<WorkspaceList />);

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('should show empty state when no workspaces exist', () => {
    vi.mocked(useWorkspaceStore).mockReturnValue({
      workspaces: [],
      currentWorkspaceId: null,
      isLoading: false,
    } as any);

    render(<WorkspaceList />);

    expect(screen.getByText(/no workspaces|empty/i)).toBeInTheDocument();
  });
});
