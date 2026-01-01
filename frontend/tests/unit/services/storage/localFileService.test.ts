/**
 * Unit tests for Local File Service (Browser)
 * Tests ODCS file I/O operations using browser File API
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { localFileService } from '@/services/storage/localFileService';
import { browserFileService } from '@/services/platform/browser';
import { odcsService } from '@/services/sdk/odcsService';

vi.mock('@/services/platform/browser');
vi.mock('@/services/sdk/odcsService');

// Mock FileReader
global.FileReader = vi.fn().mockImplementation(() => ({
  readAsText: vi.fn(),
  result: null,
  onload: null,
  onerror: null,
})) as any;

describe('LocalFileService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('readFile', () => {
    it('should read file content using FileReader', async () => {
      const fileContent = 'workspace:\n  name: Test Workspace\n  tables: []';
      const file = new File([fileContent], 'workspace.yaml', { type: 'text/yaml' });

      // Mock FileReader
      const mockFileReader = {
        readAsText: vi.fn(function (this: FileReader) {
          setTimeout(() => {
            (this as any).result = fileContent;
            if ((this as any).onload) {
              (this as any).onload({ target: { result: fileContent } });
            }
          }, 0);
        }),
        result: null,
        onload: null,
        onerror: null,
      };

      vi.mocked(FileReader).mockImplementation(() => mockFileReader as any);

      vi.mocked(browserFileService.readFile).mockResolvedValue(fileContent);
      vi.mocked(odcsService.parseYAML).mockResolvedValue({ name: 'Test Workspace' } as any);

      const result = await localFileService.readFile(file);
      expect(browserFileService.readFile).toHaveBeenCalledWith(file);
      expect(odcsService.parseYAML).toHaveBeenCalledWith(fileContent);
      expect(result).toEqual({ name: 'Test Workspace' });
    });

    it('should handle file read errors', async () => {
      const file = new File([''], 'workspace.yaml', { type: 'text/yaml' });

      const mockFileReader = {
        readAsText: vi.fn(function (this: FileReader) {
          setTimeout(() => {
            if ((this as any).onerror) {
              (this as any).onerror(new Error('File read error'));
            }
          }, 0);
        }),
        result: null,
        onload: null,
        onerror: null,
      };

      vi.mocked(FileReader).mockImplementation(() => mockFileReader as any);

      vi.mocked(browserFileService.readFile).mockRejectedValue(new Error('File read error'));

      await expect(localFileService.readFile(file)).rejects.toThrow('File read error');
    });
  });

  describe('saveFile', () => {
    it('should create download link for file', async () => {
      const content = 'workspace:\n  name: Test Workspace';
      const filename = 'workspace.yaml';

      // Mock DOM methods
      const mockLink = {
        href: '',
        download: '',
        click: vi.fn(),
      };
      const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockLink as any);
      const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink as any);
      const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockLink as any);
      const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:url');
      const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

      vi.mocked(odcsService.toYAML).mockResolvedValue(content);

      await localFileService.saveFile({ name: 'Test Workspace' } as any, filename);
      expect(odcsService.toYAML).toHaveBeenCalled();
      expect(browserFileService.downloadFile).toHaveBeenCalledWith(content, filename, 'text/yaml');
    });
  });

  describe('pickFile', () => {
    it('should trigger file picker dialog', async () => {
      const file = new File(['content'], 'workspace.yaml', { type: 'text/yaml' });

      // Mock file input
      const mockInput = {
        type: '',
        accept: '',
        files: null,
        click: vi.fn(),
        onchange: null as ((e: Event) => void) | null,
      };

      const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockInput as any);

      // Simulate file selection
      setTimeout(() => {
        if (mockInput.onchange) {
          const event = new Event('change');
          Object.defineProperty(event, 'target', {
            value: { files: [file] },
            enumerable: true,
          });
          mockInput.onchange(event);
        }
      }, 0);

      vi.mocked(browserFileService.pickFile).mockResolvedValue(file);

      const result = await localFileService.pickFile();
      expect(browserFileService.pickFile).toHaveBeenCalled();
      expect(result).toEqual(file);
    });
  });
});

