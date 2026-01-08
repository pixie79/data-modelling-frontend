/**
 * Component tests for Table Editor
 * Tests table editing functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TableEditor } from '@/components/table/TableEditor';
import * as modelStore from '@/stores/modelStore';
import type { Table } from '@/types/table';

vi.mock('@/stores/modelStore', () => ({
  useModelStore: vi.fn(),
}));

describe('TableEditor', () => {
  const DOMAIN_ID = '550e8400-e29b-41d4-a716-446655440000';
  const mockTable: Table = {
    id: 'table-1',
    workspace_id: 'workspace-1',
    primary_domain_id: DOMAIN_ID,
    name: 'Users',
    model_type: 'conceptual',
    columns: [
      {
        id: 'col-1',
        table_id: 'table-1',
        name: 'id',
        data_type: 'UUID',
        nullable: false,
        is_primary_key: true,
        is_foreign_key: false,
        order: 0,
        created_at: '2025-01-01T00:00:00Z',
      },
    ],
    position_x: 100,
    position_y: 100,
    width: 200,
    height: 150,
    visible_domains: [DOMAIN_ID],
    created_at: '2025-01-01T00:00:00Z',
    last_modified_at: '2025-01-01T00:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(modelStore.useModelStore).mockReturnValue({
      tables: [mockTable],
      selectedDomainId: DOMAIN_ID,
      updateTable: vi.fn(),
      updateTableRemote: vi.fn().mockResolvedValue(mockTable),
    } as any);
  });

  it('should render table name editor', () => {
    render(<TableEditor tableId="table-1" workspaceId="workspace-1" />);
    expect(screen.getByDisplayValue('Users')).toBeInTheDocument();
  });

  it('should allow editing table name', async () => {
    render(<TableEditor tableId="table-1" workspaceId="workspace-1" />);
    const nameInput = screen.getByDisplayValue('Users');
    fireEvent.change(nameInput, { target: { value: 'Updated Users' } });
    expect(nameInput).toHaveValue('Updated Users');
  });

  it('should show column list', () => {
    render(<TableEditor tableId="table-1" workspaceId="workspace-1" />);
    expect(screen.getByText('Columns')).toBeInTheDocument();
    expect(screen.getByDisplayValue('id')).toBeInTheDocument();
  });

  it('should allow adding new column', () => {
    render(<TableEditor tableId="table-1" workspaceId="workspace-1" />);
    const addButton = screen.getByText('Add Column');
    fireEvent.click(addButton);
    // New column editor should appear
    expect(screen.getAllByPlaceholderText('Column name').length).toBeGreaterThanOrEqual(1);
  });
});
