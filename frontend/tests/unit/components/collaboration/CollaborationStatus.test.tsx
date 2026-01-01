/**
 * Component tests for Collaboration Status
 * Tests collaboration status display
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CollaborationStatus } from '@/components/collaboration/CollaborationStatus';
import * as collaborationStore from '@/stores/collaborationStore';
import * as sdkModeStore from '@/services/sdk/sdkMode';

vi.mock('@/stores/collaborationStore', () => ({
  useCollaborationStore: vi.fn(),
}));

vi.mock('@/services/sdk/sdkMode', () => ({
  useSDKModeStore: vi.fn(),
}));

describe('CollaborationStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show offline message when in offline mode', () => {
    vi.mocked(sdkModeStore.useSDKModeStore).mockReturnValue({
      mode: 'offline',
    } as any);

    render(<CollaborationStatus workspaceId="workspace-1" />);
    expect(screen.getByText(/Collaboration disabled.*offline mode/)).toBeInTheDocument();
  });

  it('should show connected status', () => {
    vi.mocked(sdkModeStore.useSDKModeStore).mockReturnValue({
      mode: 'online',
    } as any);

    vi.mocked(collaborationStore.useCollaborationStore).mockReturnValue({
      session: {
        workspaceId: 'workspace-1',
        primaryOwnerId: 'user-1',
        participants: [],
        isConnected: true,
        connectionStatus: 'connected',
      },
    } as any);

    render(<CollaborationStatus workspaceId="workspace-1" />);
    expect(screen.getByText('Connected')).toBeInTheDocument();
  });

  it('should show reconnecting status', () => {
    vi.mocked(sdkModeStore.useSDKModeStore).mockReturnValue({
      mode: 'online',
    } as any);

    vi.mocked(collaborationStore.useCollaborationStore).mockReturnValue({
      session: {
        workspaceId: 'workspace-1',
        primaryOwnerId: 'user-1',
        participants: [],
        isConnected: false,
        connectionStatus: 'reconnecting',
      },
    } as any);

    render(<CollaborationStatus workspaceId="workspace-1" />);
    expect(screen.getByText('Reconnecting...')).toBeInTheDocument();
  });

  it('should show disconnected status with warning', () => {
    vi.mocked(sdkModeStore.useSDKModeStore).mockReturnValue({
      mode: 'online',
    } as any);

    vi.mocked(collaborationStore.useCollaborationStore).mockReturnValue({
      session: {
        workspaceId: 'workspace-1',
        primaryOwnerId: 'user-1',
        participants: [],
        isConnected: false,
        connectionStatus: 'disconnected',
      },
    } as any);

    render(<CollaborationStatus workspaceId="workspace-1" />);
    expect(screen.getByText('Disconnected')).toBeInTheDocument();
    expect(screen.getByText(/Changes saved locally/)).toBeInTheDocument();
  });
});

