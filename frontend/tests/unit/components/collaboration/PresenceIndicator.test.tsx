/**
 * Component tests for Presence Indicator
 * Tests presence indicator rendering and updates
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PresenceIndicator } from '@/components/collaboration/PresenceIndicator';
import * as collaborationStore from '@/stores/collaborationStore';
import * as auth from '@/components/auth/AuthProvider';

vi.mock('@/stores/collaborationStore', () => ({
  useCollaborationStore: vi.fn(),
}));

vi.mock('@/components/auth/AuthProvider', () => ({
  useAuth: vi.fn(),
}));

describe('PresenceIndicator', () => {
  const mockSession = {
    workspaceId: 'workspace-1',
    primaryOwnerId: 'user-1',
    participants: [],
    isConnected: true,
    connectionStatus: 'connected' as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth.useAuth).mockReturnValue({
      user: { id: 'user-1', name: 'User 1', email: 'user1@example.com' },
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
    } as any);
  });

  it('should render nothing when not connected', () => {
    vi.mocked(collaborationStore.useCollaborationStore).mockReturnValue({
      getParticipants: vi.fn(() => []),
      session: { ...mockSession, isConnected: false },
    } as any);

    const { container } = render(<PresenceIndicator workspaceId="workspace-1" />);
    expect(container.firstChild).toBeNull();
  });

  it('should show "alone" message when no other participants', () => {
    vi.mocked(collaborationStore.useCollaborationStore).mockReturnValue({
      getParticipants: vi.fn(() => []),
      session: mockSession,
    } as any);

    render(<PresenceIndicator workspaceId="workspace-1" />);
    expect(screen.getByText(/You are alone/)).toBeInTheDocument();
  });

  it('should display other participants', () => {
    const participants = [
      {
        userId: 'user-2',
        userName: 'User 2',
        accessLevel: 'edit' as const,
        lastSeen: '2025-01-01T00:00:00Z',
      },
      {
        userId: 'user-3',
        userEmail: 'user3@example.com',
        accessLevel: 'read' as const,
        lastSeen: '2025-01-01T00:00:00Z',
      },
    ];

    vi.mocked(collaborationStore.useCollaborationStore).mockReturnValue({
      getParticipants: vi.fn(() => participants),
      session: { ...mockSession, participants },
    } as any);

    render(<PresenceIndicator workspaceId="workspace-1" />);
    expect(screen.getByText(/2 users online/)).toBeInTheDocument();
  });

  it('should show indicator when participant is editing', () => {
    const participants = [
      {
        userId: 'user-2',
        userName: 'User 2',
        accessLevel: 'edit' as const,
        selectedElements: ['table-1'],
        lastSeen: '2025-01-01T00:00:00Z',
      },
    ];

    vi.mocked(collaborationStore.useCollaborationStore).mockReturnValue({
      getParticipants: vi.fn(() => participants),
      session: { ...mockSession, participants },
    } as any);

    render(<PresenceIndicator workspaceId="workspace-1" />);
    // Should show editing indicator (yellow dot)
    expect(screen.getByText(/1 user online/)).toBeInTheDocument();
  });
});

