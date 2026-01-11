/**
 * Import Database Dialog Component
 * Allows users to import data into DuckDB from various formats
 */

import React, { useState, useCallback, useRef } from 'react';
import { Dialog } from '@/components/common/Dialog';
import { useDuckDBContext } from '@/contexts/DuckDBContext';

export interface ImportDatabaseDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: (filename: string, tablesImported: number) => void;
}

type MergeStrategy = 'replace' | 'merge' | 'skip-existing';

/**
 * Get merge strategy description
 */
function getMergeStrategyDescription(strategy: MergeStrategy): string {
  switch (strategy) {
    case 'replace':
      return 'Replace existing records with imported data';
    case 'merge':
      return 'Merge imported data with existing records';
    case 'skip-existing':
      return 'Skip records that already exist';
    default:
      return '';
  }
}

export const ImportDatabaseDialog: React.FC<ImportDatabaseDialogProps> = ({
  isOpen,
  onClose,
  onImportComplete,
}) => {
  const { duckdb, isReady } = useDuckDBContext();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [mergeStrategy, setMergeStrategy] = useState<MergeStrategy>('replace');
  const [validateSchema, setValidateSchema] = useState(true);
  const [dryRun, setDryRun] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError(null);
      setImportResult(null);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      // Check file type
      const validTypes = ['.json', '.csv', '.duckdb', '.parquet'];
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      if (validTypes.includes(ext)) {
        setSelectedFile(file);
        setError(null);
        setImportResult(null);
      } else {
        setError(`Invalid file type. Supported formats: ${validTypes.join(', ')}`);
      }
    }
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleImport = useCallback(async () => {
    if (!duckdb || !isReady || !selectedFile) {
      setError('Database is not ready or no file selected');
      return;
    }

    setIsImporting(true);
    setError(null);
    setImportResult(null);

    try {
      const blob = new Blob([await selectedFile.arrayBuffer()], { type: selectedFile.type });

      const result = await duckdb.import(blob, {
        mergeStrategy,
        validateSchema,
        dryRun,
      });

      if (result.success) {
        if (dryRun) {
          setImportResult({
            success: true,
            message: 'Dry run completed successfully. No data was modified.',
          });
        } else {
          setImportResult({
            success: true,
            message: 'Import completed successfully!',
          });
          onImportComplete?.(selectedFile.name, 0); // TODO: Get actual count
        }
      } else {
        setError(result.error || 'Import failed');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Import failed';
      setError(message);
    } finally {
      setIsImporting(false);
    }
  }, [duckdb, isReady, selectedFile, mergeStrategy, validateSchema, dryRun, onImportComplete]);

  const handleClose = () => {
    setSelectedFile(null);
    setError(null);
    setImportResult(null);
    setDryRun(false);
    onClose();
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Dialog isOpen={isOpen} onClose={handleClose} title="Import Database" size="md">
      <div className="space-y-6">
        {/* File Upload Area */}
        <div>
          <span className="block text-sm font-medium text-gray-700 mb-2">Select File</span>
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              selectedFile
                ? 'border-green-300 bg-green-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            {selectedFile ? (
              <div className="space-y-2">
                <svg
                  className="mx-auto h-10 w-10 text-green-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div>
                  <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
                  <p className="text-xs text-gray-500">{formatFileSize(selectedFile.size)}</p>
                </div>
                <button
                  onClick={() => setSelectedFile(null)}
                  className="text-xs text-red-600 hover:text-red-700"
                >
                  Remove file
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <svg
                  className="mx-auto h-10 w-10 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                <div>
                  <p className="text-sm text-gray-600">
                    Drag and drop a file here, or{' '}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="text-blue-600 hover:text-blue-700 font-medium"
                    >
                      browse
                    </button>
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Supported formats: JSON, CSV</p>
                </div>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.csv"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        </div>

        {/* Merge Strategy */}
        <div>
          <span className="block text-sm font-medium text-gray-700 mb-2">Merge Strategy</span>
          <div className="space-y-2">
            {(['replace', 'merge', 'skip-existing'] as MergeStrategy[]).map((strategy) => (
              <label
                key={strategy}
                className={`flex items-start p-3 border rounded-lg cursor-pointer transition-colors ${
                  mergeStrategy === strategy
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="mergeStrategy"
                  value={strategy}
                  checked={mergeStrategy === strategy}
                  onChange={() => setMergeStrategy(strategy)}
                  className="mt-0.5 h-4 w-4 text-blue-600 focus:ring-blue-500"
                />
                <div className="ml-3">
                  <span className="text-sm font-medium text-gray-900 capitalize">
                    {strategy.replace('-', ' ')}
                  </span>
                  <p className="text-xs text-gray-500">{getMergeStrategyDescription(strategy)}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Options */}
        <div className="space-y-3">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={validateSchema}
              onChange={(e) => setValidateSchema(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 rounded"
            />
            <span className="ml-2 text-sm text-gray-700">Validate schema before import</span>
          </label>

          <label className="flex items-center">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 rounded"
            />
            <span className="ml-2 text-sm text-gray-700">Dry run (validate without importing)</span>
          </label>
        </div>

        {/* Result Display */}
        {importResult && (
          <div
            className={`p-3 rounded-lg text-sm ${
              importResult.success
                ? 'bg-green-50 border border-green-200 text-green-700'
                : 'bg-red-50 border border-red-200 text-red-700'
            }`}
          >
            {importResult.message}
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Warning for replace strategy */}
        {mergeStrategy === 'replace' && !dryRun && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
            <strong>Warning:</strong> This will replace existing data. Consider doing a dry run
            first.
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <button
            onClick={handleClose}
            disabled={isImporting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={isImporting || !isReady || !selectedFile}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isImporting ? (
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
                {dryRun ? 'Validating...' : 'Importing...'}
              </span>
            ) : dryRun ? (
              'Validate'
            ) : (
              'Import'
            )}
          </button>
        </div>
      </div>
    </Dialog>
  );
};

export default ImportDatabaseDialog;
