/**
 * Component tests for Domain Selector Model Type Switching
 * Tests model type switching (Conceptual, Logical, Physical)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DomainSelector } from '@/components/domain/DomainSelector';
import * as workspaceStore from '@/stores/workspaceStore';
import * as modelStore from '@/stores/modelStore';

vi.mock('@/stores/workspaceStore');
vi.mock('@/stores/modelStore');

describe('DomainSelector Model Type Switching', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(workspaceStore.useWorkspaceStore).mockReturnValue({
      currentWorkspace: {
        id: 'workspace-1',
        name: 'Test Workspace',
        type: 'personal',
        owner_id: 'user-1',
        created_at: '2025-01-01T00:00:00Z',
        last_modified_at: '2025-01-01T00:00:00Z',
      },
    } as any);
    vi.mocked(modelStore.useModelStore).mockReturnValue({
      selectedDomainId: 'domain-1',
      domains: [
        { id: 'domain-1', name: 'Default', model_type: 'conceptual' },
      ],
      setSelectedDomain: vi.fn(),
      setModelType: vi.fn(),
    } as any);
  });

  it('should display current model type', () => {
    render(<DomainSelector workspaceId="workspace-1" />);
    expect(screen.getByText(/conceptual/i)).toBeInTheDocument();
  });

  it('should allow switching to logical model type', () => {
    const setSelectedDomain = vi.fn();
    vi.mocked(modelStore.useModelStore).mockReturnValue({
      selectedDomainId: 'domain-1',
      domains: [
        { id: 'domain-1', name: 'Conceptual', model_type: 'conceptual', workspace_id: 'workspace-1', is_primary: true, created_at: '2025-01-01T00:00:00Z', last_modified_at: '2025-01-01T00:00:00Z' },
        { id: 'domain-2', name: 'Logical', model_type: 'logical', workspace_id: 'workspace-1', is_primary: false, created_at: '2025-01-01T00:00:00Z', last_modified_at: '2025-01-01T00:00:00Z' },
      ],
      setSelectedDomain,
    } as any);

    render(<DomainSelector workspaceId="workspace-1" />);
    const select = screen.getByLabelText('Select model type');
    fireEvent.change(select, { target: { value: 'logical' } });
    
    expect(setSelectedDomain).toHaveBeenCalledWith('domain-2');
  });

  it('should allow switching to physical model type', () => {
    const setSelectedDomain = vi.fn();
    vi.mocked(modelStore.useModelStore).mockReturnValue({
      selectedDomainId: 'domain-1',
      domains: [
        { id: 'domain-1', name: 'Conceptual', model_type: 'conceptual', workspace_id: 'workspace-1', is_primary: true, created_at: '2025-01-01T00:00:00Z', last_modified_at: '2025-01-01T00:00:00Z' },
        { id: 'domain-3', name: 'Physical', model_type: 'physical', workspace_id: 'workspace-1', is_primary: false, created_at: '2025-01-01T00:00:00Z', last_modified_at: '2025-01-01T00:00:00Z' },
      ],
      setSelectedDomain,
    } as any);

    render(<DomainSelector workspaceId="workspace-1" />);
    const select = screen.getByLabelText('Select model type');
    fireEvent.change(select, { target: { value: 'physical' } });
    
    expect(setSelectedDomain).toHaveBeenCalledWith('domain-3');
  });
});

