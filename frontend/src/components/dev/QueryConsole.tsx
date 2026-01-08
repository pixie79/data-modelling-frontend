/**
 * DuckDB Query Console Component (Dev Only)
 * Interactive SQL console for debugging and development
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useDuckDBContext } from '@/contexts/DuckDBContext';

export interface QueryConsoleProps {
  /** Additional CSS classes */
  className?: string;
  /** Initial query to display */
  initialQuery?: string;
  /** Maximum number of rows to display */
  maxRows?: number;
}

interface QueryHistoryItem {
  id: string;
  query: string;
  timestamp: Date;
  duration: number;
  rowCount: number;
  success: boolean;
  error?: string;
}

interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  duration: number;
}

/**
 * Interactive SQL query console for DuckDB
 * Only intended for development/debugging purposes
 */
export const QueryConsole: React.FC<QueryConsoleProps> = ({
  className = '',
  initialQuery = 'SELECT * FROM tables LIMIT 10;',
  maxRows = 100,
}) => {
  const { duckdb, isReady, error: contextError } = useDuckDBContext();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [query, setQuery] = useState(initialQuery);
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<QueryHistoryItem[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [showHistory, setShowHistory] = useState(false);

  // Load history from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('duckdb-query-history');
      if (saved) {
        const parsed = JSON.parse(saved);
        setHistory(
          parsed.map((h: any) => ({
            ...h,
            timestamp: new Date(h.timestamp),
          }))
        );
      }
    } catch {
      // Ignore errors
    }
  }, []);

  // Save history to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('duckdb-query-history', JSON.stringify(history.slice(0, 50)));
    } catch {
      // Ignore errors
    }
  }, [history]);

  const executeQuery = useCallback(async () => {
    if (!duckdb || !isReady || !query.trim()) return;

    setIsExecuting(true);
    setError(null);
    setResult(null);

    const startTime = performance.now();

    try {
      const queryResult = await duckdb.query<Record<string, unknown>>(query);
      const duration = performance.now() - startTime;

      if (!queryResult.success) {
        throw new Error(queryResult.error || 'Query failed');
      }

      const limitedRows = queryResult.rows.slice(0, maxRows);

      setResult({
        columns: queryResult.columnNames,
        rows: limitedRows,
        rowCount: queryResult.rowCount,
        duration,
      });

      // Add to history
      const historyItem: QueryHistoryItem = {
        id: crypto.randomUUID(),
        query: query.trim(),
        timestamp: new Date(),
        duration,
        rowCount: queryResult.rowCount,
        success: true,
      };
      setHistory((prev) => [historyItem, ...prev.filter((h) => h.query !== query.trim())]);
      setHistoryIndex(-1);
    } catch (err) {
      const duration = performance.now() - startTime;
      const message = err instanceof Error ? err.message : 'Query execution failed';
      setError(message);

      // Add failed query to history
      const historyItem: QueryHistoryItem = {
        id: crypto.randomUUID(),
        query: query.trim(),
        timestamp: new Date(),
        duration,
        rowCount: 0,
        success: false,
        error: message,
      };
      setHistory((prev) => [historyItem, ...prev.filter((h) => h.query !== query.trim())]);
      setHistoryIndex(-1);
    } finally {
      setIsExecuting(false);
    }
  }, [duckdb, isReady, query, maxRows]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Ctrl/Cmd + Enter to execute
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      executeQuery();
    }
    // Up/Down arrow for history navigation when at start/end of text
    else if (e.key === 'ArrowUp' && history.length > 0) {
      const textarea = textareaRef.current;
      if (textarea && textarea.selectionStart === 0) {
        e.preventDefault();
        const newIndex = Math.min(historyIndex + 1, history.length - 1);
        setHistoryIndex(newIndex);
        setQuery(history[newIndex]?.query || '');
      }
    } else if (e.key === 'ArrowDown' && historyIndex >= 0) {
      const textarea = textareaRef.current;
      if (textarea && textarea.selectionEnd === textarea.value.length) {
        e.preventDefault();
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setQuery(newIndex >= 0 ? history[newIndex]?.query || '' : '');
      }
    }
  };

  const loadFromHistory = (item: QueryHistoryItem) => {
    setQuery(item.query);
    setShowHistory(false);
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('duckdb-query-history');
  };

  const formatValue = (value: unknown): string => {
    if (value === null) return 'NULL';
    if (value === undefined) return '';
    if (typeof value === 'object') return JSON.stringify(value);
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
    <div className={`flex flex-col bg-gray-900 rounded-lg overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <svg
            className="w-5 h-5 text-green-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <span className="text-sm font-medium text-white">DuckDB Query Console</span>
          <span className="text-xs px-1.5 py-0.5 bg-yellow-600 text-yellow-100 rounded">DEV</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-gray-700"
          >
            History ({history.length})
          </button>
        </div>
      </div>

      {/* History Panel */}
      {showHistory && (
        <div className="border-b border-gray-700 bg-gray-850 max-h-48 overflow-y-auto">
          <div className="flex items-center justify-between px-4 py-2 bg-gray-800">
            <span className="text-xs text-gray-400">Query History</span>
            {history.length > 0 && (
              <button onClick={clearHistory} className="text-xs text-red-400 hover:text-red-300">
                Clear
              </button>
            )}
          </div>
          {history.length === 0 ? (
            <p className="px-4 py-3 text-xs text-gray-500">No queries yet</p>
          ) : (
            <div className="divide-y divide-gray-700">
              {history.slice(0, 20).map((item) => (
                <button
                  key={item.id}
                  onClick={() => loadFromHistory(item)}
                  className="w-full px-4 py-2 text-left hover:bg-gray-800 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <code className="text-xs text-gray-300 truncate flex-1 mr-2">
                      {item.query.slice(0, 60)}
                      {item.query.length > 60 ? '...' : ''}
                    </code>
                    <span className={`text-xs ${item.success ? 'text-green-500' : 'text-red-500'}`}>
                      {item.success ? `${item.rowCount} rows` : 'Error'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {item.timestamp.toLocaleTimeString()} - {item.duration.toFixed(0)}ms
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Query Input */}
      <div className="p-4 border-b border-gray-700">
        <textarea
          ref={textareaRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter SQL query..."
          className="w-full h-24 px-3 py-2 bg-gray-800 text-gray-100 font-mono text-sm rounded border border-gray-700 focus:border-blue-500 focus:outline-none resize-y"
          spellCheck={false}
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-gray-500">
            Press Ctrl+Enter to execute. Use arrow keys for history.
          </span>
          <button
            onClick={executeQuery}
            disabled={isExecuting || !query.trim()}
            className="px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isExecuting ? (
              <>
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
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Running...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Execute
              </>
            )}
          </button>
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-auto">
        {error && (
          <div className="p-4 bg-red-900/50 text-red-200 text-sm">
            <strong>Error:</strong> {error}
          </div>
        )}

        {result && (
          <div className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">
                {result.rowCount} row{result.rowCount !== 1 ? 's' : ''}
                {result.rowCount > maxRows && ` (showing first ${maxRows})`}
              </span>
              <span className="text-xs text-gray-500">{result.duration.toFixed(2)}ms</span>
            </div>

            {result.rows.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-800">
                      {result.columns.map((col, i) => (
                        <th
                          key={i}
                          className="px-3 py-2 text-left text-gray-300 font-medium border-b border-gray-700"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-800/50">
                        {result.columns.map((col, j) => (
                          <td
                            key={j}
                            className="px-3 py-1.5 text-gray-300 border-b border-gray-800 font-mono whitespace-nowrap"
                          >
                            <span className={row[col] === null ? 'text-gray-500 italic' : ''}>
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
              <p className="text-gray-500 text-sm">No rows returned</p>
            )}
          </div>
        )}

        {!error && !result && (
          <div className="p-8 text-center text-gray-500">
            <svg
              className="mx-auto h-12 w-12 text-gray-600 mb-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"
              />
            </svg>
            <p className="text-sm">Enter a SQL query and click Execute</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default QueryConsole;
