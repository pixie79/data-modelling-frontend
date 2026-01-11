/**
 * Export Database Dialog Component
 * Allows users to export DuckDB data to various formats
 */

import React, { useState, useCallback } from 'react';
import { Dialog } from '@/components/common/Dialog';
import { useDuckDBContext } from '@/contexts/DuckDBContext';
import { ExportFormat } from '@/types/duckdb';

export interface ExportDatabaseDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onExportComplete?: (format: ExportFormat, filename: string) => void;
}

/**
 * Get format description
 */
function getFormatDescription(format: ExportFormat): string {
  switch (format) {
    case ExportFormat.JSON:
      return 'Export all tables as a single JSON file. Best for small datasets and web compatibility.';
    case ExportFormat.CSV:
      return 'Export all tables as CSV. Each table is separated by a header comment.';
    case ExportFormat.Parquet:
      return 'Export as Apache Parquet format. Best for large datasets and analytics tools.';
    case ExportFormat.DuckDB:
      return 'Export as native DuckDB database file. Can be imported directly into DuckDB.';
    default:
      return '';
  }
}

export const ExportDatabaseDialog: React.FC<ExportDatabaseDialogProps> = ({
  isOpen,
  onClose,
  onExportComplete,
}) => {
  const { duckdb, isReady } = useDuckDBContext();

  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>(ExportFormat.JSON);
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [allTables, setAllTables] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableTables, setAvailableTables] = useState<string[]>([]);

  // Load available tables when dialog opens
  React.useEffect(() => {
    const loadTables = async () => {
      if (!isOpen || !duckdb || !isReady) return;

      try {
        const stats = await duckdb.getStats();
        setAvailableTables(stats.tables.map((t) => t.tableName));
      } catch (err) {
        console.error('Failed to load tables:', err);
      }
    };

    loadTables();
  }, [isOpen, duckdb, isReady]);

  const handleExport = useCallback(async () => {
    if (!duckdb || !isReady) {
      setError('Database is not ready');
      return;
    }

    setIsExporting(true);
    setError(null);

    try {
      const tablesToExport = allTables ? undefined : selectedTables;

      const blob = await duckdb.export({
        format: selectedFormat,
        tables: tablesToExport,
      });

      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const extension =
        selectedFormat === ExportFormat.JSON
          ? 'json'
          : selectedFormat === ExportFormat.CSV
            ? 'csv'
            : selectedFormat === ExportFormat.Parquet
              ? 'parquet'
              : 'duckdb';
      const filename = `data-model-export-${timestamp}.${extension}`;

      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      onExportComplete?.(selectedFormat, filename);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Export failed';
      setError(message);
    } finally {
      setIsExporting(false);
    }
  }, [duckdb, isReady, selectedFormat, allTables, selectedTables, onExportComplete, onClose]);

  const handleTableToggle = (tableName: string) => {
    setSelectedTables((prev) =>
      prev.includes(tableName) ? prev.filter((t) => t !== tableName) : [...prev, tableName]
    );
  };

  const supportedFormats = [ExportFormat.JSON, ExportFormat.CSV];
  // Parquet and DuckDB native formats require more complex handling
  // They're listed but disabled for now

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Export Database" size="md">
      <div className="space-y-6">
        {/* Format Selection */}
        <div>
          <span className="block text-sm font-medium text-gray-700 mb-2">Export Format</span>
          <div className="space-y-2">
            {Object.values(ExportFormat).map((format) => {
              const isSupported = supportedFormats.includes(format);
              return (
                <label
                  key={format}
                  className={`flex items-start p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedFormat === format
                      ? 'border-blue-500 bg-blue-50'
                      : isSupported
                        ? 'border-gray-200 hover:border-gray-300'
                        : 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
                  }`}
                >
                  <input
                    type="radio"
                    name="format"
                    value={format}
                    checked={selectedFormat === format}
                    onChange={() => setSelectedFormat(format)}
                    disabled={!isSupported}
                    className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="ml-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 uppercase">{format}</span>
                      {!isSupported && (
                        <span className="text-xs px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded">
                          Coming soon
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{getFormatDescription(format)}</p>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        {/* Table Selection */}
        <div>
          <span className="block text-sm font-medium text-gray-700 mb-2">Tables to Export</span>

          <div className="mb-3">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={allTables}
                onChange={(e) => setAllTables(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 rounded"
              />
              <span className="ml-2 text-sm text-gray-700">Export all tables</span>
            </label>
          </div>

          {!allTables && (
            <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1">
              {availableTables.length === 0 ? (
                <p className="text-sm text-gray-500 p-2">No tables found</p>
              ) : (
                availableTables.map((table) => (
                  <label key={table} className="flex items-center p-1 hover:bg-gray-50 rounded">
                    <input
                      type="checkbox"
                      checked={selectedTables.includes(table)}
                      onChange={() => handleTableToggle(table)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700 font-mono">{table}</span>
                  </label>
                ))
              )}
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <button
            onClick={onClose}
            disabled={isExporting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting || !isReady || (!allTables && selectedTables.length === 0)}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExporting ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Exporting...
              </span>
            ) : (
              'Export'
            )}
          </button>
        </div>
      </div>
    </Dialog>
  );
};

export default ExportDatabaseDialog;
