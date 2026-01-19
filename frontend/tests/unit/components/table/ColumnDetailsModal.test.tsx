/**
 * Component tests for Column Details Modal
 * Tests comma-separated input functionality and quality rules
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ColumnDetailsModal } from '@/components/table/ColumnDetailsModal';
import type { Column } from '@/types/table';

// Mock the UI store
vi.mock('@/stores/uiStore', () => ({
  useUIStore: () => ({
    addToast: vi.fn(),
  }),
}));

describe('ColumnDetailsModal', () => {
  const mockColumn: Column = {
    id: 'col-1',
    table_id: 'table-1',
    name: 'status',
    data_type: 'VARCHAR',
    nullable: true,
    is_primary_key: false,
    is_foreign_key: false,
    order: 0,
    created_at: '2025-01-01T00:00:00Z',
  };

  const defaultProps = {
    column: mockColumn,
    tableId: 'table-1',
    workspaceId: 'workspace-1',
    isOpen: true,
    onClose: vi.fn(),
    onSave: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ValidValuesInput - List-based UI', () => {
    it('should add value when pressing Enter', async () => {
      const user = userEvent.setup();
      render(<ColumnDetailsModal {...defaultProps} />);

      // Navigate to Quality tab
      const qualityTab = screen.getByRole('button', { name: /quality/i });
      await user.click(qualityTab);

      // Add a valid_values quality rule
      const ruleSelect = screen.getByRole('combobox');
      await user.selectOptions(ruleSelect, 'valid_values');

      // Find the valid values input
      const validValuesInput = screen.getByPlaceholderText('Type a value and press Enter');
      expect(validValuesInput).toBeInTheDocument();

      // Type a value and press Enter
      await user.type(validValuesInput, 'active{Enter}');

      // The value should appear as a tag
      expect(screen.getByText('active')).toBeInTheDocument();
      // Input should be cleared
      expect(validValuesInput).toHaveValue('');
    });

    it('should add value when pressing comma', async () => {
      const user = userEvent.setup();
      render(<ColumnDetailsModal {...defaultProps} />);

      // Navigate to Quality tab
      const qualityTab = screen.getByRole('button', { name: /quality/i });
      await user.click(qualityTab);

      // Add a valid_values quality rule
      const ruleSelect = screen.getByRole('combobox');
      await user.selectOptions(ruleSelect, 'valid_values');

      // Find the valid values input
      const validValuesInput = screen.getByPlaceholderText('Type a value and press Enter');

      // Type a value and press comma
      fireEvent.change(validValuesInput, { target: { value: 'inactive' } });
      fireEvent.keyDown(validValuesInput, { key: ',' });

      // The value should appear as a tag
      await waitFor(() => {
        expect(screen.getByText('inactive')).toBeInTheDocument();
      });
    });

    it('should add value when clicking Add button', async () => {
      const user = userEvent.setup();
      render(<ColumnDetailsModal {...defaultProps} />);

      // Navigate to Quality tab
      const qualityTab = screen.getByRole('button', { name: /quality/i });
      await user.click(qualityTab);

      // Add a valid_values quality rule
      const ruleSelect = screen.getByRole('combobox');
      await user.selectOptions(ruleSelect, 'valid_values');

      // Find the valid values input
      const validValuesInput = screen.getByPlaceholderText('Type a value and press Enter');

      // Type a value
      await user.type(validValuesInput, 'pending');

      // Click Add button
      const addButton = screen.getByRole('button', { name: 'Add' });
      await user.click(addButton);

      // The value should appear as a tag
      expect(screen.getByText('pending')).toBeInTheDocument();
      // Input should be cleared
      expect(validValuesInput).toHaveValue('');
    });

    it('should remove value when clicking remove button', async () => {
      const user = userEvent.setup();
      render(<ColumnDetailsModal {...defaultProps} />);

      // Navigate to Quality tab
      const qualityTab = screen.getByRole('button', { name: /quality/i });
      await user.click(qualityTab);

      // Add a valid_values quality rule
      const ruleSelect = screen.getByRole('combobox');
      await user.selectOptions(ruleSelect, 'valid_values');

      // Find the valid values input and add a value
      const validValuesInput = screen.getByPlaceholderText('Type a value and press Enter');
      await user.type(validValuesInput, 'active{Enter}');

      // Verify value is displayed
      expect(screen.getByText('active')).toBeInTheDocument();

      // Click remove button
      const removeButton = screen.getByTitle('Remove value');
      await user.click(removeButton);

      // Value should be removed
      expect(screen.queryByText('active')).not.toBeInTheDocument();
    });
  });

  describe('CommaSeparatedInput - Examples', () => {
    it('should allow typing commas in examples input', async () => {
      const user = userEvent.setup();
      render(<ColumnDetailsModal {...defaultProps} />);

      // Should be on Basic tab by default
      // Find the examples input
      const examplesInput = screen.getByPlaceholderText('e.g., John Doe, Jane Smith, Bob Wilson');
      expect(examplesInput).toBeInTheDocument();

      // Type a value with comma - use fireEvent for more reliable test
      fireEvent.change(examplesInput, { target: { value: 'value1,' } });

      // The comma should remain visible while typing
      await waitFor(() => {
        expect(examplesInput).toHaveValue('value1,');
      });
    });
  });

  describe('CommaSeparatedInput - Source Objects', () => {
    it('should allow typing commas in source objects input', async () => {
      const user = userEvent.setup();
      render(<ColumnDetailsModal {...defaultProps} />);

      // Navigate to Transform tab
      const transformTab = screen.getByRole('button', { name: /transform/i });
      await user.click(transformTab);

      // Find the source objects input
      const sourceObjectsInput = screen.getByPlaceholderText(
        'e.g., orders.total_amount, customers.discount_rate'
      );
      expect(sourceObjectsInput).toBeInTheDocument();

      // Type a value with comma
      await user.clear(sourceObjectsInput);
      await user.type(sourceObjectsInput, 'table1.col1,');

      // The comma should remain visible while typing
      expect(sourceObjectsInput).toHaveValue('table1.col1,');
    });
  });

  describe('Modal rendering', () => {
    it('should render when isOpen is true', () => {
      render(<ColumnDetailsModal {...defaultProps} />);
      expect(screen.getByText(`Column Details: ${mockColumn.name}`)).toBeInTheDocument();
    });

    it('should not render when isOpen is false', () => {
      render(<ColumnDetailsModal {...defaultProps} isOpen={false} />);
      expect(screen.queryByText(`Column Details: ${mockColumn.name}`)).not.toBeInTheDocument();
    });

    it('should render all tabs', () => {
      render(<ColumnDetailsModal {...defaultProps} />);
      expect(screen.getByRole('button', { name: /basic/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /governance/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /engineering/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /transform/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /quality/i })).toBeInTheDocument();
    });
  });
});
