/**
 * System Export Dialog Component
 * Allows exporting tables from a system to ODCS, Markdown, or PDF format
 * Excludes CADS (Compute Assets) from export
 */

import React, { useState, useEffect } from 'react';
import { DraggableModal } from '@/components/common/DraggableModal';
import { useModelStore } from '@/stores/modelStore';
import { useUIStore } from '@/stores/uiStore';
import { odcsService } from '@/services/sdk/odcsService';
import type { Table } from '@/types/table';

export interface SystemExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  systemId: string;
}

type ExportFormat = 'odcs' | 'markdown' | 'pdf';

export const SystemExportDialog: React.FC<SystemExportDialogProps> = ({
  isOpen,
  onClose,
  systemId,
}) => {
  const { systems, tables } = useModelStore();
  const { addToast } = useUIStore();

  const [selectedTableIds, setSelectedTableIds] = useState<Set<string>>(new Set());
  const [exportFormat, setExportFormat] = useState<ExportFormat>('odcs');
  const [isExporting, setIsExporting] = useState(false);
  const [selectAll, setSelectAll] = useState(true);

  // Get the system and its tables
  const system = systems.find((s) => s.id === systemId);
  const systemTables = tables.filter((t) => system?.table_ids?.includes(t.id));

  // Initialize selected tables when dialog opens
  useEffect(() => {
    if (isOpen && systemTables.length > 0) {
      setSelectedTableIds(new Set(systemTables.map((t) => t.id)));
      setSelectAll(true);
    }
  }, [isOpen, systemId]);

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedTableIds(new Set());
    } else {
      setSelectedTableIds(new Set(systemTables.map((t) => t.id)));
    }
    setSelectAll(!selectAll);
  };

  const handleToggleTable = (tableId: string) => {
    const newSelected = new Set(selectedTableIds);
    if (newSelected.has(tableId)) {
      newSelected.delete(tableId);
    } else {
      newSelected.add(tableId);
    }
    setSelectedTableIds(newSelected);
    setSelectAll(newSelected.size === systemTables.length);
  };

  const handleExport = async () => {
    if (selectedTableIds.size === 0) {
      addToast({
        type: 'warning',
        message: 'Please select at least one table to export.',
      });
      return;
    }

    setIsExporting(true);
    try {
      const selectedTables = systemTables.filter((t) => selectedTableIds.has(t.id));
      const systemName = system?.name || 'system';

      switch (exportFormat) {
        case 'odcs': {
          // Export as ODCS YAML with all selected tables
          const workspace = {
            tables: selectedTables,
            relationships: [],
          };
          const content = await odcsService.toYAML(workspace as any);
          downloadFile(content, `${systemName}.odcs.yaml`, 'application/yaml');
          break;
        }
        case 'markdown': {
          // Export as Markdown - one file with all tables
          let markdownContent = `# ${systemName}\n\n`;
          markdownContent += `System containing ${selectedTables.length} table(s).\n\n`;

          for (const table of selectedTables) {
            try {
              const tableMarkdown = await odcsService.exportTableToMarkdown(table);
              markdownContent += tableMarkdown + '\n\n---\n\n';
            } catch {
              // Fallback: generate basic markdown
              markdownContent += generateBasicMarkdown(table) + '\n\n---\n\n';
            }
          }
          downloadFile(markdownContent, `${systemName}.md`, 'text/markdown');
          break;
        }
        case 'pdf': {
          // Export as PDF - combine all tables
          // For now, we'll export each table separately since PDF generation is per-table
          if (selectedTables.length === 1) {
            const table = selectedTables[0];
            if (table) {
              await odcsService.exportTableToPDF(table);
            }
          } else {
            // For multiple tables, generate markdown and inform user
            // PDF generation for multiple tables would require combining PDFs
            let markdownContent = `# ${systemName}\n\n`;
            for (const table of selectedTables) {
              try {
                const tableMarkdown = await odcsService.exportTableToMarkdown(table);
                markdownContent += tableMarkdown + '\n\n---\n\n';
              } catch {
                markdownContent += generateBasicMarkdown(table) + '\n\n---\n\n';
              }
            }
            // Download as markdown with PDF naming
            downloadFile(markdownContent, `${systemName}_tables.md`, 'text/markdown');
            addToast({
              type: 'info',
              message:
                'Multi-table PDF export saved as Markdown. Use a Markdown-to-PDF converter for PDF output.',
            });
          }
          break;
        }
      }

      addToast({
        type: 'success',
        message: `Successfully exported ${selectedTables.length} table(s) as ${exportFormat.toUpperCase()}.`,
      });
      onClose();
    } catch (error) {
      console.error('[SystemExportDialog] Export failed:', error);
      addToast({
        type: 'error',
        message: `Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    } finally {
      setIsExporting(false);
    }
  };

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const generateBasicMarkdown = (table: Table): string => {
    let md = `## ${table.name}\n\n`;
    if (table.description) {
      md += `${table.description}\n\n`;
    }
    md += `### Columns\n\n`;
    md += `| Name | Type | Nullable | Primary Key | Description |\n`;
    md += `|------|------|----------|-------------|-------------|\n`;
    for (const col of table.columns || []) {
      md += `| ${col.name} | ${col.data_type} | ${col.nullable ? 'Yes' : 'No'} | ${col.is_primary_key ? 'Yes' : 'No'} | ${col.description || ''} |\n`;
    }
    return md;
  };

  if (!system) {
    return null;
  }

  return (
    <DraggableModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Export System: ${system.name}`}
      size="md"
      initialPosition={{ x: 150, y: 100 }}
    >
      <div className="space-y-4">
        {/* Export Format Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Export Format</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="exportFormat"
                value="odcs"
                checked={exportFormat === 'odcs'}
                onChange={() => setExportFormat('odcs')}
                className="w-4 h-4 text-blue-600"
              />
              <span className="text-sm">ODCS (YAML)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="exportFormat"
                value="markdown"
                checked={exportFormat === 'markdown'}
                onChange={() => setExportFormat('markdown')}
                className="w-4 h-4 text-blue-600"
              />
              <span className="text-sm">Markdown</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="exportFormat"
                value="pdf"
                checked={exportFormat === 'pdf'}
                onChange={() => setExportFormat('pdf')}
                className="w-4 h-4 text-blue-600"
              />
              <span className="text-sm">PDF</span>
            </label>
          </div>
        </div>

        {/* Table Selection */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Select Tables ({selectedTableIds.size} of {systemTables.length})
            </label>
            <button onClick={handleSelectAll} className="text-sm text-blue-600 hover:text-blue-800">
              {selectAll ? 'Deselect All' : 'Select All'}
            </button>
          </div>

          {systemTables.length === 0 ? (
            <div className="text-sm text-gray-500 italic py-4 text-center border border-gray-200 rounded-md">
              No tables in this system
            </div>
          ) : (
            <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-md">
              {systemTables.map((table) => (
                <label
                  key={table.id}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                >
                  <input
                    type="checkbox"
                    checked={selectedTableIds.has(table.id)}
                    onChange={() => handleToggleTable(table.id)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{table.name}</div>
                    {table.description && (
                      <div className="text-xs text-gray-500 truncate">{table.description}</div>
                    )}
                  </div>
                  <div className="text-xs text-gray-400">{table.columns?.length || 0} cols</div>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Info about CADS exclusion */}
        <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
          Note: Compute Assets (CADS) are excluded from this export. Only tables (ODCS) are
          exported.
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            disabled={isExporting}
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting || selectedTableIds.size === 0}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExporting ? 'Exporting...' : `Export ${selectedTableIds.size} Table(s)`}
          </button>
        </div>
      </div>
    </DraggableModal>
  );
};
