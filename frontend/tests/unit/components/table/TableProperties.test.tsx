/**
 * Component tests for Table Properties
 * Tests table metadata and properties editing
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TableProperties } from '@/components/table/TableProperties';
import * as modelStore from '@/stores/modelStore';
import type { Table } from '@/types/table';

vi.mock('@/stores/modelStore', () => ({
  useModelStore: vi.fn(),
}));

describe('TableProperties', () => {
  const mockTable: Table = {
    id: 'table-1',
    workspace_id: 'workspace-1',
    primary_domain_id: 'domain-1',
    name: 'Users',
    model_type: 'conceptual',
    columns: [],
    position_x: 100,
    position_y: 100,
    width: 200,
    height: 150,
    visible_domains: ['domain-1'],
    created_at: '2025-01-01T00:00:00Z',
    last_modified_at: '2025-01-01T00:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(modelStore.useModelStore).mockReturnValue({
      tables: [mockTable],
      updateTable: vi.fn(),
      updateTableRemote: vi.fn().mockResolvedValue(mockTable),
    } as any);
  });

  it('should render table properties', () => {
    render(<TableProperties tableId="table-1" workspaceId="workspace-1" />);
    expect(screen.getByText('Table Properties')).toBeInTheDocument();
  });

  it('should display table metadata', () => {
    render(<TableProperties tableId="table-1" workspaceId="workspace-1" />);
    expect(screen.getByText('Users')).toBeInTheDocument();
    expect(screen.getByText(/conceptual/i)).toBeInTheDocument();
  });

  it('should display table description if available', () => {
    const tableWithDescription: Table = {
      ...mockTable,
      description: 'User accounts table',
    };
    vi.mocked(modelStore.useModelStore).mockReturnValue({
      tables: [tableWithDescription],
      updateTable: vi.fn(),
      updateTableRemote: vi.fn().mockResolvedValue(tableWithDescription),
    } as any);

    render(<TableProperties tableId="table-1" workspaceId="workspace-1" />);
    expect(screen.getByText('User accounts table')).toBeInTheDocument();
  });

  it('should display table statistics', () => {
    const tableWithColumns: Table = {
      ...mockTable,
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
    };

    vi.mocked(modelStore.useModelStore).mockReturnValue({
      tables: [tableWithColumns],
      updateTable: vi.fn(),
      updateTableRemote: vi.fn().mockResolvedValue(tableWithColumns),
    } as any);

    render(<TableProperties tableId="table-1" workspaceId="workspace-1" />);
    expect(screen.getByText(/Columns: 1/i)).toBeInTheDocument();
  });
});

