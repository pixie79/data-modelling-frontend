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

  describe('CommaSeparatedInput - Valid Values', () => {
    it('should allow typing commas in valid values input', async () => {
      const user = userEvent.setup();
      render(<ColumnDetailsModal {...defaultProps} />);

      // Navigate to Quality tab
      const qualityTab = screen.getByRole('button', { name: /quality/i });
      await user.click(qualityTab);

      // Add a valid_values quality rule
      const ruleSelect = screen.getByRole('combobox');
      await user.selectOptions(ruleSelect, 'valid_values');

      // Find the valid values input
      const validValuesInput = screen.getByPlaceholderText('active, inactive, pending');
      expect(validValuesInput).toBeInTheDocument();

      // Type a value with comma - the comma should remain visible while typing
      await user.clear(validValuesInput);
      await user.type(validValuesInput, 'active,');

      // The comma should still be visible in the input (not stripped while typing)
      expect(validValuesInput).toHaveValue('active,');
    });

    it('should allow typing multiple comma-separated values', async () => {
      const user = userEvent.setup();
      render(<ColumnDetailsModal {...defaultProps} />);

      // Navigate to Quality tab
      const qualityTab = screen.getByRole('button', { name: /quality/i });
      await user.click(qualityTab);

      // Add a valid_values quality rule
      const ruleSelect = screen.getByRole('combobox');
      await user.selectOptions(ruleSelect, 'valid_values');

      // Find the valid values input
      const validValuesInput = screen.getByPlaceholderText('active, inactive, pending');

      // Type multiple comma-separated values
      await user.clear(validValuesInput);
      await user.type(validValuesInput, 'active, inactive, pending');

      // All values including commas should be visible
      expect(validValuesInput).toHaveValue('active, inactive, pending');
    });

    it('should parse values on blur and normalize formatting', async () => {
      const user = userEvent.setup();
      render(<ColumnDetailsModal {...defaultProps} />);

      // Navigate to Quality tab
      const qualityTab = screen.getByRole('button', { name: /quality/i });
      await user.click(qualityTab);

      // Add a valid_values quality rule
      const ruleSelect = screen.getByRole('combobox');
      await user.selectOptions(ruleSelect, 'valid_values');

      // Find the valid values input
      const validValuesInput = screen.getByPlaceholderText('active, inactive, pending');

      // Type values with inconsistent spacing
      await user.clear(validValuesInput);
      await user.type(validValuesInput, 'active,  inactive,pending');

      // Blur the input to trigger parsing
      fireEvent.blur(validValuesInput);

      // After blur, values should be normalized with consistent spacing
      await waitFor(() => {
        expect(validValuesInput).toHaveValue('active, inactive, pending');
      });
    });

    it('should filter out empty values on blur', async () => {
      const user = userEvent.setup();
      render(<ColumnDetailsModal {...defaultProps} />);

      // Navigate to Quality tab
      const qualityTab = screen.getByRole('button', { name: /quality/i });
      await user.click(qualityTab);

      // Add a valid_values quality rule
      const ruleSelect = screen.getByRole('combobox');
      await user.selectOptions(ruleSelect, 'valid_values');

      // Find the valid values input
      const validValuesInput = screen.getByPlaceholderText('active, inactive, pending');

      // Type values with extra commas that would create empty entries
      await user.clear(validValuesInput);
      await user.type(validValuesInput, 'active,,inactive,');

      // Blur the input to trigger parsing
      fireEvent.blur(validValuesInput);

      // After blur, empty values should be filtered out
      await waitFor(() => {
        expect(validValuesInput).toHaveValue('active, inactive');
      });
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

      // Type a value with comma
      await user.clear(examplesInput);
      await user.type(examplesInput, 'value1,');

      // The comma should remain visible while typing
      expect(examplesInput).toHaveValue('value1,');
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
