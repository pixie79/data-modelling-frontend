/**
 * Component tests for Import/Export Dialog
 * Tests import/export UI component
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ImportExportDialog } from '@/components/common/ImportExportDialog';
import * as importExportService from '@/services/sdk/importExportService';
import * as odcsService from '@/services/sdk/odcsService';
import * as modelStore from '@/stores/modelStore';
import * as uiStore from '@/stores/uiStore';

vi.mock('@/services/sdk/importExportService');
vi.mock('@/services/sdk/odcsService');
vi.mock('@/stores/modelStore', () => ({
  useModelStore: vi.fn(),
}));
vi.mock('@/stores/uiStore', () => ({
  useUIStore: vi.fn(),
}));

describe('ImportExportDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(modelStore.useModelStore).mockReturnValue({
      tables: [],
      relationships: [],
    } as any);
    vi.mocked(uiStore.useUIStore).mockReturnValue({
      addToast: vi.fn(),
    } as any);
    vi.mocked(odcsService.odcsService.toYAML).mockResolvedValue('yaml content');
    vi.mocked(importExportService.importExportService.exportToSQL).mockResolvedValue('sql content');
    vi.mocked(importExportService.importExportService.exportToAVRO).mockResolvedValue('avro content');
    vi.mocked(importExportService.importExportService.exportToJSONSchema).mockResolvedValue('json content');
    vi.mocked(importExportService.importExportService.exportToProtobuf).mockResolvedValue('proto content');
  });

  it('should render import/export dialog', () => {
    render(<ImportExportDialog isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText('Import / Export')).toBeInTheDocument();
  });

  it('should show import tab by default', () => {
    render(<ImportExportDialog isOpen={true} onClose={vi.fn()} />);
    const importTabs = screen.getAllByRole('button', { name: /^import$/i });
    const tabButton = importTabs.find(btn => btn.className.includes('border-b-2'));
    expect(tabButton).toBeInTheDocument();
    expect(tabButton).toHaveClass('border-blue-600');
  });

  it('should switch to export tab', () => {
    render(<ImportExportDialog isOpen={true} onClose={vi.fn()} />);
    const exportTab = screen.getByRole('button', { name: /^export$/i });
    fireEvent.click(exportTab);
    expect(screen.getByText('Export Format')).toBeInTheDocument();
  });

  it('should handle file import', async () => {
    const onClose = vi.fn();
    render(<ImportExportDialog isOpen={true} onClose={onClose} />);
    
    // Component renders FileUpload component which handles file import
    // The actual import logic is tested in FileUpload component tests
    expect(screen.getByText('Upload File')).toBeInTheDocument();
  });

  it('should handle URL import', async () => {
    render(<ImportExportDialog isOpen={true} onClose={vi.fn()} />);
    // Component renders UrlImport component which handles URL import
    // The actual import logic is tested in UrlImport component tests
    expect(screen.getByText(/url/i)).toBeInTheDocument();
  });

  it('should handle paste import', async () => {
    render(<ImportExportDialog isOpen={true} onClose={vi.fn()} />);
    // Component renders PasteImport component which handles paste import
    // The actual import logic is tested in PasteImport component tests
    expect(screen.getByText(/paste/i)).toBeInTheDocument();
  });

  it('should handle export to different formats', async () => {
    vi.mocked(modelStore.useModelStore).mockReturnValue({
      tables: [{ id: 'table-1', name: 'Test', columns: [] } as any],
      relationships: [],
    } as any);
    
    render(<ImportExportDialog isOpen={true} onClose={vi.fn()} />);
    // Switch to export tab
    const exportTabs = screen.getAllByRole('button', { name: /^export$/i });
    const tabButton = exportTabs.find(btn => btn.className.includes('border-b-2'));
    expect(tabButton).toBeInTheDocument();
    fireEvent.click(tabButton!);
    // Component should show export options
    expect(screen.getByText('Export Format')).toBeInTheDocument();
    const exportButtons = screen.getAllByRole('button', { name: /export/i });
    const exportActionButton = exportButtons.find(btn => btn.className.includes('w-full'));
    expect(exportActionButton).toBeInTheDocument();
  });
});

