/**
 * Component tests for Column Editor
 * Tests column editing functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ColumnEditor } from '@/components/table/ColumnEditor';
import type { Column } from '@/types/table';

describe('ColumnEditor', () => {
  const mockColumn: Column = {
    id: 'col-1',
    table_id: 'table-1',
    name: 'id',
    data_type: 'UUID',
    nullable: false,
    is_primary_key: true,
    is_foreign_key: false,
    order: 0,
    created_at: '2025-01-01T00:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render column name input', () => {
    const onChange = vi.fn();
    render(<ColumnEditor column={mockColumn} onChange={onChange} />);
    expect(screen.getByDisplayValue('id')).toBeInTheDocument();
  });

  it('should display physical type as read-only', () => {
    const onChange = vi.fn();
    const columnWithType = {
      ...mockColumn,
      physicalType: 'VARCHAR(255)',
    };
    render(<ColumnEditor column={columnWithType} onChange={onChange} />);
    // Type is displayed as read-only text, not an editable select
    expect(screen.getByText('VARCHAR(255)')).toBeInTheDocument();
  });

  it('should display data_type when physicalType is not set', () => {
    const onChange = vi.fn();
    render(<ColumnEditor column={mockColumn} onChange={onChange} />);
    // Falls back to data_type when physicalType is not set
    expect(screen.getByText('UUID')).toBeInTheDocument();
  });

  it('should render nullable checkbox', () => {
    const onChange = vi.fn();
    render(<ColumnEditor column={mockColumn} onChange={onChange} />);
    const nullableCheckbox = screen.getByLabelText('Nullable');
    expect(nullableCheckbox).toBeInTheDocument();
    expect(nullableCheckbox).not.toBeChecked();
  });

  it('should render primary key checkbox', () => {
    const onChange = vi.fn();
    render(<ColumnEditor column={mockColumn} onChange={onChange} />);
    const pkCheckbox = screen.getByLabelText('Primary key');
    expect(pkCheckbox).toBeInTheDocument();
    expect(pkCheckbox).toBeChecked();
  });

  it('should render foreign key checkbox', () => {
    const onChange = vi.fn();
    render(<ColumnEditor column={mockColumn} onChange={onChange} />);
    const fkCheckbox = screen.getByLabelText('Foreign key');
    expect(fkCheckbox).toBeInTheDocument();
    expect(fkCheckbox).not.toBeChecked();
  });

  it('should call onChange when column properties change', () => {
    const onChange = vi.fn();
    render(<ColumnEditor column={mockColumn} onChange={onChange} />);
    const nameInput = screen.getByDisplayValue('id');
    fireEvent.change(nameInput, { target: { value: 'user_id' } });
    expect(onChange).toHaveBeenCalled();
  });
});
