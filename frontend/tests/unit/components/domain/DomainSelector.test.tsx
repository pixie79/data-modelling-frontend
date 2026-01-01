/**
 * Component tests for Domain Selector
 * Tests model type switching (Conceptual, Logical, Physical)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DomainSelector } from '@/components/domain/DomainSelector';
import * as modelStore from '@/stores/modelStore';

vi.mock('@/stores/modelStore', () => ({
  useModelStore: vi.fn(),
}));

describe('DomainSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render model type selector', () => {
    vi.mocked(modelStore.useModelStore).mockReturnValue({
      selectedDomainId: 'domain-1',
      domains: [
        {
          id: 'domain-1',
          workspace_id: 'workspace-1',
          name: 'Conceptual',
          model_type: 'conceptual',
          is_primary: true,
          created_at: '2025-01-01T00:00:00Z',
          last_modified_at: '2025-01-01T00:00:00Z',
        },
      ],
      setSelectedDomain: vi.fn(),
    } as any);

    render(<DomainSelector workspaceId="workspace-1" />);
    expect(screen.getByText('Conceptual')).toBeInTheDocument();
    expect(screen.getByText('Logical')).toBeInTheDocument();
    expect(screen.getByText('Physical')).toBeInTheDocument();
  });

  it('should switch model type when selected', () => {
    const setSelectedDomain = vi.fn();
    vi.mocked(modelStore.useModelStore).mockReturnValue({
      selectedDomainId: 'domain-1',
      domains: [
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
      ],
      setSelectedDomain,
    } as any);

    render(<DomainSelector workspaceId="workspace-1" />);
    const select = screen.getByLabelText('Select model type');
    fireEvent.change(select, { target: { value: 'logical' } });
    expect(setSelectedDomain).toHaveBeenCalled();
  });
});

