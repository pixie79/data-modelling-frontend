/**
 * Database Settings Component
 * Allows users to configure DuckDB/PostgreSQL database backend
 * SDK 1.13.1+
 */

import React, { useState, useEffect, useCallback } from 'react';
import type { DatabaseConfig } from '@/types/database';
import { DatabaseBackend, getDatabaseBackendLabel, validateDatabaseConfig } from '@/types/database';
import { databaseConfigService } from '@/services/storage/databaseConfigService';
import { sdkLoader } from '@/services/sdk/sdkLoader';

export interface DatabaseSettingsProps {
  workspacePath: string;
  className?: string;
  onConfigChange?: (config: DatabaseConfig) => void;
}

export const DatabaseSettings: React.FC<DatabaseSettingsProps> = ({
  workspacePath,
  className = '',
  onConfigChange,
}) => {
  const [config, setConfig] = useState<DatabaseConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [sdkSupported, setSdkSupported] = useState(false);

  // Load configuration on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        setLoading(true);
        setError(null);
        const loadedConfig = await databaseConfigService.loadConfig(workspacePath);
        setConfig(loadedConfig);
        setSdkSupported(sdkLoader.hasDatabaseSupport());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load configuration');
      } finally {
        setLoading(false);
      }
    };

    if (workspacePath) {
      loadConfig();
    }
  }, [workspacePath]);

  // Save configuration
  const handleSave = useCallback(async () => {
    if (!config || !workspacePath) return;

    try {
      setSaving(true);
      setError(null);
      await databaseConfigService.saveConfig(workspacePath, config);
      setHasChanges(false);
      onConfigChange?.(config);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  }, [config, workspacePath, onConfigChange]);

  // Update config helper
  const updateConfig = useCallback(
    (updates: Partial<DatabaseConfig>) => {
      if (!config) return;

      const newConfig: DatabaseConfig = {
        database: { ...config.database, ...updates.database },
        postgres: updates.postgres !== undefined ? updates.postgres : config.postgres,
        sync: { ...config.sync, ...updates.sync },
        git: { ...config.git, ...updates.git },
      };

      setConfig(newConfig);
      setHasChanges(true);
    },
    [config]
  );

  // Validate current config
  const validation = config ? validateDatabaseConfig(config) : { valid: true, errors: [] };

  if (loading) {
    return (
      <div className={`p-4 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className={`p-4 ${className}`}>
        <div className="text-red-600">Failed to load database configuration</div>
      </div>
    );
  }

  return (
    <div className={`p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Database Settings</h3>
        {!sdkSupported && (
          <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded">
            SDK 1.13.1+ required
          </span>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      {!validation.valid && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-yellow-700 text-sm">
          <strong>Configuration warnings:</strong>
          <ul className="list-disc list-inside mt-1">
            {validation.errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-6">
        {/* Backend Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Storage Backend</label>
          <select
            value={config.database.backend}
            onChange={(e) =>
              updateConfig({
                database: { ...config.database, backend: e.target.value as DatabaseBackend },
              })
            }
            disabled={!sdkSupported}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            {Object.values(DatabaseBackend).map((backend) => (
              <option key={backend} value={backend}>
                {getDatabaseBackendLabel(backend)}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">
            {config.database.backend === DatabaseBackend.None &&
              'YAML files only - no database caching'}
            {config.database.backend === DatabaseBackend.DuckDB &&
              'Embedded analytical database for fast queries (10-100x faster)'}
            {config.database.backend === DatabaseBackend.PostgreSQL &&
              'Server-based database for distributed access'}
          </p>
        </div>

        {/* DuckDB Path */}
        {config.database.backend === DatabaseBackend.DuckDB && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">DuckDB File Path</label>
            <input
              type="text"
              value={config.database.path || ''}
              onChange={(e) =>
                updateConfig({
                  database: { ...config.database, path: e.target.value },
                })
              }
              placeholder=".data-model.duckdb"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500">Relative to workspace directory</p>
          </div>
        )}

        {/* PostgreSQL Settings */}
        {config.database.backend === DatabaseBackend.PostgreSQL && (
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-gray-900">PostgreSQL Connection</h4>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Connection String
              </label>
              <input
                type="text"
                value={config.postgres?.connection_string || ''}
                onChange={(e) =>
                  updateConfig({
                    postgres: {
                      ...config.postgres,
                      connection_string: e.target.value,
                    },
                  })
                }
                placeholder="postgresql://user:password@localhost:5432/database"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Pool Size</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={config.postgres?.pool_size || 5}
                  onChange={(e) =>
                    updateConfig({
                      postgres: {
                        ...config.postgres,
                        connection_string: config.postgres?.connection_string || '',
                        pool_size: parseInt(e.target.value, 10),
                      },
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">SSL Mode</label>
                <select
                  value={config.postgres?.ssl_mode || 'prefer'}
                  onChange={(e) =>
                    updateConfig({
                      postgres: {
                        ...config.postgres,
                        connection_string: config.postgres?.connection_string || '',
                        ssl_mode: e.target.value as any,
                      },
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="disable">Disable</option>
                  <option value="prefer">Prefer</option>
                  <option value="require">Require</option>
                  <option value="verify-ca">Verify CA</option>
                  <option value="verify-full">Verify Full</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Sync Settings */}
        {config.database.backend !== DatabaseBackend.None && (
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900">Synchronization</h4>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">Auto-sync on load</label>
                <p className="text-xs text-gray-500">
                  Automatically sync YAML files to database when opening workspace
                </p>
              </div>
              <input
                type="checkbox"
                checked={config.sync.auto_sync}
                onChange={(e) =>
                  updateConfig({
                    sync: { ...config.sync, auto_sync: e.target.checked },
                  })
                }
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">Sync on save</label>
                <p className="text-xs text-gray-500">Sync changes to database when saving</p>
              </div>
              <input
                type="checkbox"
                checked={config.sync.sync_on_save}
                onChange={(e) =>
                  updateConfig({
                    sync: { ...config.sync, sync_on_save: e.target.checked },
                  })
                }
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">Watch for changes</label>
                <p className="text-xs text-gray-500">
                  Automatically sync when files change on disk
                </p>
              </div>
              <input
                type="checkbox"
                checked={config.sync.watch}
                onChange={(e) =>
                  updateConfig({
                    sync: { ...config.sync, watch: e.target.checked },
                  })
                }
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Conflict Strategy
              </label>
              <select
                value={config.sync.conflict_strategy}
                onChange={(e) =>
                  updateConfig({
                    sync: { ...config.sync, conflict_strategy: e.target.value as any },
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="prompt">Prompt for resolution</option>
                <option value="yaml-wins">YAML files take precedence</option>
                <option value="database-wins">Database takes precedence</option>
              </select>
            </div>
          </div>
        )}

        {/* Git Hooks Settings */}
        {config.database.backend !== DatabaseBackend.None && (
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900">Git Integration</h4>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">Enable Git hooks</label>
                <p className="text-xs text-gray-500">Automatically sync on Git operations</p>
              </div>
              <input
                type="checkbox"
                checked={config.git.hooks_enabled}
                onChange={(e) =>
                  updateConfig({
                    git: { ...config.git, hooks_enabled: e.target.checked },
                  })
                }
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
            </div>

            {config.git.hooks_enabled && (
              <div className="ml-4 space-y-3 border-l-2 border-gray-200 pl-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm text-gray-600">Pre-commit (export to YAML)</label>
                  <input
                    type="checkbox"
                    checked={config.git.pre_commit}
                    onChange={(e) =>
                      updateConfig({
                        git: { ...config.git, pre_commit: e.target.checked },
                      })
                    }
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-sm text-gray-600">Post-checkout (sync to DB)</label>
                  <input
                    type="checkbox"
                    checked={config.git.post_checkout}
                    onChange={(e) =>
                      updateConfig({
                        git: { ...config.git, post_checkout: e.target.checked },
                      })
                    }
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-sm text-gray-600">Post-merge (sync to DB)</label>
                  <input
                    type="checkbox"
                    checked={config.git.post_merge}
                    onChange={(e) =>
                      updateConfig({
                        git: { ...config.git, post_merge: e.target.checked },
                      })
                    }
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Save Button */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-sm text-gray-500">
            {hasChanges ? 'You have unsaved changes' : 'Configuration saved'}
          </div>
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving || !validation.valid}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </div>
    </div>
  );
};
