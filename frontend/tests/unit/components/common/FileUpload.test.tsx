/**
 * Component tests for File Upload
 * Tests file upload functionality for imports
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FileUpload } from '@/components/common/FileUpload';

describe('FileUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render file upload component', () => {
    render(<FileUpload onFileSelect={vi.fn()} accept=".yaml,.yml" />);
    expect(screen.getByLabelText(/upload/i)).toBeInTheDocument();
  });

  it('should handle file selection', async () => {
    const onFileSelect = vi.fn();
    render(<FileUpload onFileSelect={onFileSelect} accept=".yaml,.yml" />);
    
    const file = new File(['test content'], 'test.yaml', { type: 'application/yaml' });
    const input = screen.getByLabelText(/upload/i) as HTMLInputElement;
    
    fireEvent.change(input, { target: { files: [file] } });
    
    await waitFor(() => {
      expect(onFileSelect).toHaveBeenCalledWith(file);
    });
  });

  it('should validate file type', async () => {
    const onFileSelect = vi.fn();
    render(<FileUpload onFileSelect={onFileSelect} accept=".yaml,.yml" />);
    
    const file = new File(['test'], 'test.txt', { type: 'text/plain' });
    const input = screen.getByLabelText(/upload/i) as HTMLInputElement;
    
    fireEvent.change(input, { target: { files: [file] } });
    
    // Should not call onFileSelect for invalid file type
    await waitFor(() => {
      // File type validation should prevent selection
      expect(onFileSelect).not.toHaveBeenCalled();
    });
  });

  it('should display file name after selection', async () => {
    const onFileSelect = vi.fn();
    render(<FileUpload onFileSelect={onFileSelect} accept=".yaml,.yml" />);
    
    const file = new File(['test'], 'test.yaml', { type: 'application/yaml' });
    const input = screen.getByLabelText(/upload/i) as HTMLInputElement;
    
    fireEvent.change(input, { target: { files: [file] } });
    
    await waitFor(() => {
      expect(screen.getByText('test.yaml')).toBeInTheDocument();
    });
  });
});

