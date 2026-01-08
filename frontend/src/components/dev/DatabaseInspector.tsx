/**
 * Database Inspector Component (Dev Only)
 * View database structure, tables, and data for debugging
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useDuckDBContext } from '@/contexts/DuckDBContext';
import type { DuckDBStats } from '@/types/duckdb';

export interface DatabaseInspectorProps {
  /** Additional CSS classes */
  className?: string;
  /** Auto-refresh interval in ms (0 to disable) */
  refreshInterval?: number;
}

interface TableData {
  columns: string[];
  rows: Record<string, unknown>[];
  totalRows: number;
}

/**
 * Database structure inspector for development
 */
export const DatabaseInspector: React.FC<DatabaseInspectorProps> = ({
  className = '',
  refreshInterval = 0,
}) => {
  const { duckdb, isReady, storageMode, error: contextError } = useDuckDBContext();

  const [stats, setStats] = useState<DuckDBStats | null>(null);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableData, setTableData] = useState<TableData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [tableSchemas, setTableSchemas] = useState<
    Record<string, { name: string; type: string }[]>
  >({});

  // Load database stats
  const loadStats = useCallback(async () => {
    if (!duckdb || !isReady) return;

    setIsLoading(true);
    setError(null);

    try {
      const dbStats = await duckdb.getStats();
      setStats(dbStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stats');
    } finally {
      setIsLoading(false);
    }
  }, [duckdb, isReady]);

  // Load table schema
  const loadTableSchema = useCallback(
    async (tableName: string) => {
      if (!duckdb || !isReady) return;

      try {
        const result = await duckdb.query<{ column_name: string; data_type: string }>(
          `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = ? ORDER BY ordinal_position`,
          [tableName]
        );

        if (result.success) {
          setTableSchemas((prev) => ({
            ...prev,
            [tableName]: result.rows.map((r) => ({ name: r.column_name, type: r.data_type })),
          }));
        }
      } catch (err) {
        console.error('Failed to load schema:', err);
      }
    },
    [duckdb, isReady]
  );

  // Load table data
  const loadTableData = useCallback(
    async (tableName: string, limit = 50) => {
      if (!duckdb || !isReady) return;

      setIsLoadingData(true);
      setError(null);

      try {
        // Get columns
        const schemaResult = await duckdb.query<{ column_name: string }>(
          `SELECT column_name FROM information_schema.columns WHERE table_name = ? ORDER BY ordinal_position`,
          [tableName]
        );

        // Get data
        const dataResult = await duckdb.query<Record<string, unknown>>(
          `SELECT * FROM "${tableName}" LIMIT ${limit}`
        );

        // Get total count
        const countResult = await duckdb.query<{ count: number }>(
          `SELECT COUNT(*) as count FROM "${tableName}"`
        );

        if (schemaResult.success && dataResult.success && countResult.success) {
          setTableData({
            columns: schemaResult.rows.map((r) => r.column_name),
            rows: dataResult.rows,
            totalRows: countResult.rows[0]?.count ?? 0,
          });
          setSelectedTable(tableName);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load table data');
      } finally {
        setIsLoadingData(false);
      }
    },
    [duckdb, isReady]
  );

  // Toggle table expansion
  const toggleTableExpanded = async (tableName: string) => {
    const newExpanded = new Set(expandedTables);
    if (newExpanded.has(tableName)) {
      newExpanded.delete(tableName);
    } else {
      newExpanded.add(tableName);
      // Load schema if not already loaded
      if (!tableSchemas[tableName]) {
        await loadTableSchema(tableName);
      }
    }
    setExpandedTables(newExpanded);
  };

  // Initial load
  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // Auto-refresh
  useEffect(() => {
    if (refreshInterval > 0) {
      const interval = setInterval(loadStats, refreshInterval);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [refreshInterval, loadStats]);

  const formatValue = (value: unknown): string => {
    if (value === null) return 'NULL';
    if (value === undefined) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    if (typeof value === 'string' && value.length > 50) {
      return value.slice(0, 50) + '...';
    }
    return String(value);
  };

  if (!isReady) {
    return (
      <div className={`p-4 bg-gray-100 rounded-lg ${className}`}>
        <p className="text-gray-600">
          {contextError ? `Error: ${contextError.message}` : 'DuckDB is not ready...'}
        </p>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col bg-white rounded-lg border border-gray-200 overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <svg
            className="w-5 h-5 text-blue-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"
            />
          </svg>
          <span className="font-medium text-gray-900">Database Inspector</span>
          <span className="text-xs px-1.5 py-0.5 bg-yellow-100 text-yellow-800 rounded">DEV</span>
        </div>
        <button
          onClick={loadStats}
          disabled={isLoading}
          className="text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50"
        >
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-4 gap-4 p-4 bg-gray-50 border-b border-gray-200">
          <div>
            <div className="text-xs text-gray-500 uppercase">Tables</div>
            <div className="text-xl font-semibold text-gray-900">{stats.tableCount}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 uppercase">Storage</div>
            <div className="text-xl font-semibold text-gray-900 capitalize">{storageMode}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 uppercase">Status</div>
            <div className="text-xl font-semibold text-green-600">
              {stats.isInitialized ? 'Ready' : 'Not Ready'}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 uppercase">Version</div>
            <div className="text-xl font-semibold text-gray-900">{stats.version || 'Unknown'}</div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="p-3 bg-red-50 border-b border-red-200 text-sm text-red-700">{error}</div>
      )}

      {/* Content */}
      <div className="flex flex-1 min-h-0">
        {/* Table List */}
        <div className="w-64 border-r border-gray-200 overflow-y-auto">
          <div className="p-2">
            <h3 className="px-2 py-1 text-xs font-medium text-gray-500 uppercase">Tables</h3>
            {stats?.tables.length === 0 ? (
              <p className="px-2 py-4 text-sm text-gray-500">No tables found</p>
            ) : (
              <div className="space-y-1">
                {stats?.tables.map((table) => (
                  <div key={table.tableName}>
                    <div
                      className={`flex items-center justify-between px-2 py-1.5 rounded cursor-pointer hover:bg-gray-100 ${
                        selectedTable === table.tableName ? 'bg-blue-50 text-blue-700' : ''
                      }`}
                    >
                      <button
                        onClick={() => toggleTableExpanded(table.tableName)}
                        className="flex items-center gap-1 flex-1 text-left"
                      >
                        <svg
                          className={`w-3 h-3 transition-transform ${expandedTables.has(table.tableName) ? 'rotate-90' : ''}`}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <span className="text-sm font-mono truncate">{table.tableName}</span>
                      </button>
                      <button
                        onClick={() => loadTableData(table.tableName)}
                        className="text-xs text-gray-400 hover:text-blue-600 px-1"
                        title="View data"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                          />
                        </svg>
                      </button>
                    </div>

                    {/* Schema */}
                    {expandedTables.has(table.tableName) && tableSchemas[table.tableName] && (
                      <div className="ml-5 pl-2 border-l border-gray-200">
                        {(tableSchemas[table.tableName] ?? []).map((col, i) => (
                          <div key={i} className="flex items-center gap-2 py-0.5 text-xs">
                            <span className="text-gray-700 font-mono">{col.name}</span>
                            <span className="text-gray-400">{col.type}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Row count */}
                    <div className="ml-5 text-xs text-gray-400 px-2">{table.rowCount} rows</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Data View */}
        <div className="flex-1 overflow-auto p-4">
          {isLoadingData ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-gray-500">Loading data...</div>
            </div>
          ) : tableData && selectedTable ? (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-gray-900">
                  <span className="font-mono">{selectedTable}</span>
                  <span className="text-gray-500 font-normal ml-2">
                    ({tableData.totalRows} total rows)
                  </span>
                </h3>
                <span className="text-xs text-gray-500">
                  Showing {tableData.rows.length} of {tableData.totalRows}
                </span>
              </div>

              {tableData.rows.length > 0 ? (
                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50">
                        {tableData.columns.map((col, i) => (
                          <th
                            key={i}
                            className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200"
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {tableData.rows.map((row, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          {tableData.columns.map((col, j) => (
                            <td
                              key={j}
                              className="px-3 py-2 text-gray-700 font-mono text-xs whitespace-nowrap"
                            >
                              <span className={row[col] === null ? 'text-gray-400 italic' : ''}>
                                {formatValue(row[col])}
                              </span>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-500 text-sm">Table is empty</p>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <svg
                className="w-12 h-12 mb-3 text-gray-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              <p className="text-sm">Select a table to view its data</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DatabaseInspector;
