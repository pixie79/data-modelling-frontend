/**
 * Component tests for Paste Import
 * Tests paste operation for imports
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PasteImport } from '@/components/common/PasteImport';

describe('PasteImport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render paste import component', () => {
    render(<PasteImport onImport={vi.fn()} />);
    expect(screen.getByLabelText(/paste/i)).toBeInTheDocument();
  });

  it('should handle paste operation', () => {
    const onImport = vi.fn();
    render(<PasteImport onImport={onImport} />);
    
    const textarea = screen.getByLabelText(/paste/i);
    const button = screen.getByRole('button', { name: /import/i });
    
    fireEvent.change(textarea, { target: { value: 'test content' } });
    fireEvent.click(button);
    
    expect(onImport).toHaveBeenCalledWith('test content');
  });

  it('should validate content before importing', () => {
    const onImport = vi.fn();
    render(<PasteImport onImport={onImport} />);
    
    const textarea = screen.getByLabelText(/paste/i);
    const button = screen.getByRole('button', { name: /import/i });
    
    // Button should be disabled when content is empty/whitespace
    fireEvent.change(textarea, { target: { value: '   ' } }); // Whitespace only
    expect(button).toBeDisabled();
    
    // Button should be enabled when content has non-whitespace characters
    fireEvent.change(textarea, { target: { value: 'valid content' } });
    expect(button).not.toBeDisabled();
    
    expect(onImport).not.toHaveBeenCalled();
  });

  it('should clear content after import', () => {
    const onImport = vi.fn();
    render(<PasteImport onImport={onImport} />);
    
    const textarea = screen.getByLabelText(/paste/i) as HTMLTextAreaElement;
    const button = screen.getByRole('button', { name: /import/i });
    
    fireEvent.change(textarea, { target: { value: 'test content' } });
    fireEvent.click(button);
    
    expect(textarea.value).toBe('');
  });
});

