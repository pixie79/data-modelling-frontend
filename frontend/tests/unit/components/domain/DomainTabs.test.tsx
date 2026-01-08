/**
 * Component tests for Domain Tabs
 * Tests domain-based canvas tab organization
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DomainTabs } from '@/components/domain/DomainTabs';
import * as modelStore from '@/stores/modelStore';
import type { Domain } from '@/types/workspace';

vi.mock('@/stores/modelStore', () => ({
  useModelStore: vi.fn(),
}));

describe('DomainTabs', () => {
  const mockDomains: Domain[] = [
    {
      id: 'domain-1',
      workspace_id: 'workspace-1',
      name: 'Conceptual',
      model_type: 'conceptual',
      is_primary: true,
      created_at: '2025-01-01T00:00:00Z',
      last_modified_at: '2025-01-01T00:00:00Z',
    },
    {
      id: 'domain-2',
      workspace_id: 'workspace-1',
      name: 'Logical',
      model_type: 'logical',
      is_primary: false,
      created_at: '2025-01-01T00:00:00Z',
      last_modified_at: '2025-01-01T00:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(modelStore.useModelStore).mockReturnValue({
      domains: mockDomains,
      selectedDomainId: 'domain-1',
      setSelectedDomain: vi.fn(),
    } as any);
  });

  it('should render domain tabs', () => {
    render(<DomainTabs workspaceId="workspace-1" />);
    expect(screen.getByText('Conceptual')).toBeInTheDocument();
    expect(screen.getByText('Logical')).toBeInTheDocument();
  });

  it('should highlight selected domain tab', () => {
    render(<DomainTabs workspaceId="workspace-1" />);
    const conceptualTab = screen.getByText('Conceptual').closest('button');
    expect(conceptualTab).toHaveClass('border-blue-600', 'text-blue-600');
  });

  it('should switch domains when tab is clicked', () => {
    const setSelectedDomain = vi.fn();
    vi.mocked(modelStore.useModelStore).mockReturnValue({
      domains: mockDomains,
      selectedDomainId: 'domain-1',
      setSelectedDomain,
    } as any);

    render(<DomainTabs workspaceId="workspace-1" />);
    fireEvent.click(screen.getByText('Logical'));
    expect(setSelectedDomain).toHaveBeenCalledWith('domain-2');
  });

  it('should show message when no domains exist', () => {
    vi.mocked(modelStore.useModelStore).mockReturnValue({
      domains: [],
      selectedDomainId: null,
      setSelectedDomain: vi.fn(),
    } as any);

    render(<DomainTabs workspaceId="workspace-1" />);
    expect(screen.getByText(/No domains available/)).toBeInTheDocument();
  });
});
