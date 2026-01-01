/**
 * Component tests for URL Import
 * Tests importing from web links
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UrlImport } from '@/components/common/UrlImport';

describe('UrlImport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('should render URL import component', () => {
    render(<UrlImport onImport={vi.fn()} />);
    expect(screen.getByLabelText(/url/i)).toBeInTheDocument();
  });

  it('should fetch content from URL', async () => {
    const onImport = vi.fn();
    const mockContent = 'test content';
    
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(mockContent),
    } as any);

    render(<UrlImport onImport={onImport} />);
    
    const input = screen.getByLabelText(/url/i);
    const button = screen.getByRole('button', { name: /import/i });
    
    fireEvent.change(input, { target: { value: 'https://example.com/schema.yaml' } });
    fireEvent.click(button);
    
    await waitFor(() => {
      expect(onImport).toHaveBeenCalledWith(mockContent);
    });
  });

  it('should validate URL format', async () => {
    const onImport = vi.fn();
    render(<UrlImport onImport={onImport} />);
    
    const input = screen.getByLabelText(/url/i);
    const button = screen.getByRole('button', { name: /import/i });
    
    fireEvent.change(input, { target: { value: 'not-a-url' } });
    fireEvent.click(button);
    
    await waitFor(() => {
      expect(screen.getByText(/invalid url/i)).toBeInTheDocument();
    });
    
    expect(onImport).not.toHaveBeenCalled();
  });

  it('should handle fetch errors', async () => {
    const onImport = vi.fn();
    vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'));

    render(<UrlImport onImport={onImport} />);
    
    const input = screen.getByLabelText(/url/i);
    const button = screen.getByRole('button', { name: /import/i });
    
    fireEvent.change(input, { target: { value: 'https://example.com/schema.yaml' } });
    fireEvent.click(button);
    
    // Mock fetch to throw an error
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
    
    await waitFor(() => {
      expect(screen.getByText(/Failed to fetch content from URL|Network error/i)).toBeInTheDocument();
    }, { timeout: 3000 });
  });
});

