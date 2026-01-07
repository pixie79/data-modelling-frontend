/**
 * Git Hooks Settings Component
 * Manages git hooks for automatic database sync
 */

import React, { useState, useEffect, useCallback } from 'react';
import { gitHooksService, type GitHooksStatus, type HookStatus } from '@/services/storage/gitHooks';
import { useUIStore } from '@/stores/uiStore';

interface GitHooksSettingsProps {
  workspacePath: string;
}

export const GitHooksSettings: React.FC<GitHooksSettingsProps> = ({ workspacePath }) => {
  const [status, setStatus] = useState<GitHooksStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState<string | null>(null);
  const { addToast } = useUIStore();

  const loadStatus = useCallback(async () => {
    if (!workspacePath) return;

    try {
      setLoading(true);
      const hookStatus = await gitHooksService.getStatus(workspacePath);
      setStatus(hookStatus);
    } catch (error) {
      console.error('[GitHooksSettings] Failed to load status:', error);
      addToast({
        type: 'error',
        message: 'Failed to load git hooks status',
      });
    } finally {
      setLoading(false);
    }
  }, [workspacePath, addToast]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleInstallHook = async (hookName: 'pre-commit' | 'post-checkout' | 'post-merge') => {
    setInstalling(hookName);
    try {
      const result = await gitHooksService.installHook(workspacePath, hookName);
      if (result.success) {
        addToast({
          type: 'success',
          message: `Installed ${hookName} hook`,
        });
        await loadStatus();
      } else {
        addToast({
          type: 'error',
          message: result.error || `Failed to install ${hookName} hook`,
        });
      }
    } catch {
      addToast({
        type: 'error',
        message: `Failed to install ${hookName} hook`,
      });
    } finally {
      setInstalling(null);
    }
  };

  const handleUninstallHook = async (hookName: 'pre-commit' | 'post-checkout' | 'post-merge') => {
    setInstalling(hookName);
    try {
      const result = await gitHooksService.uninstallHook(workspacePath, hookName);
      if (result.success) {
        addToast({
          type: 'success',
          message: `Uninstalled ${hookName} hook`,
        });
        await loadStatus();
      } else {
        addToast({
          type: 'error',
          message: result.error || `Failed to uninstall ${hookName} hook`,
        });
      }
    } catch {
      addToast({
        type: 'error',
        message: `Failed to uninstall ${hookName} hook`,
      });
    } finally {
      setInstalling(null);
    }
  };

  const handleInstallAll = async () => {
    setInstalling('all');
    try {
      const result = await gitHooksService.installAllHooks(workspacePath);
      if (result.success) {
        addToast({
          type: 'success',
          message: 'Installed all enabled hooks',
        });
      } else {
        addToast({
          type: 'warning',
          message: `Some hooks failed: ${result.errors.join(', ')}`,
        });
      }
      await loadStatus();
    } catch {
      addToast({
        type: 'error',
        message: 'Failed to install hooks',
      });
    } finally {
      setInstalling(null);
    }
  };

  const handleUninstallAll = async () => {
    setInstalling('all');
    try {
      const result = await gitHooksService.uninstallAllHooks(workspacePath);
      if (result.success) {
        addToast({
          type: 'success',
          message: 'Uninstalled all hooks',
        });
      } else {
        addToast({
          type: 'warning',
          message: `Some hooks failed: ${result.errors.join(', ')}`,
        });
      }
      await loadStatus();
    } catch {
      addToast({
        type: 'error',
        message: 'Failed to uninstall hooks',
      });
    } finally {
      setInstalling(null);
    }
  };

  const getHookDescription = (name: string): string => {
    switch (name) {
      case 'pre-commit':
        return 'Exports database changes to YAML files before committing';
      case 'post-checkout':
        return 'Syncs YAML changes to database after branch checkout';
      case 'post-merge':
        return 'Syncs YAML changes to database after merging';
      default:
        return '';
    }
  };

  const renderHookRow = (hook: HookStatus) => {
    const isInstalling = installing === hook.name;
    const typedHookName = hook.name as 'pre-commit' | 'post-checkout' | 'post-merge';

    return (
      <div key={hook.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900">{hook.name}</span>
            {hook.installed && (
              <span className="px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded">
                Installed
              </span>
            )}
            {hook.hasConflict && (
              <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 rounded">
                Existing hook
              </span>
            )}
            {!hook.enabled && (
              <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                Disabled in config
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-1">{getHookDescription(hook.name)}</p>
        </div>
        <div className="flex gap-2">
          {hook.installed ? (
            <button
              onClick={() => handleUninstallHook(typedHookName)}
              disabled={isInstalling}
              className="px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50"
            >
              {isInstalling ? 'Removing...' : 'Uninstall'}
            </button>
          ) : (
            <button
              onClick={() => handleInstallHook(typedHookName)}
              disabled={isInstalling || !hook.enabled}
              className="px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50"
            >
              {isInstalling ? 'Installing...' : 'Install'}
            </button>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="p-4 bg-white rounded-lg border border-gray-200">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-16 bg-gray-100 rounded"></div>
            <div className="h-16 bg-gray-100 rounded"></div>
            <div className="h-16 bg-gray-100 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!status?.gitAvailable) {
    return (
      <div className="p-4 bg-white rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Git Hooks</h3>
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center gap-2">
            <svg
              className="w-5 h-5 text-yellow-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div>
              <h4 className="font-medium text-yellow-800">Git repository not found</h4>
              <p className="text-sm text-yellow-700">
                This workspace is not inside a git repository. Initialize a git repository to use
                git hooks.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const installedCount = status.hooks.filter((h) => h.installed).length;
  const enabledCount = status.hooks.filter((h) => h.enabled).length;

  return (
    <div className="p-4 bg-white rounded-lg border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Git Hooks</h3>
          <p className="text-sm text-gray-500">
            Automatically sync database with YAML files during git operations
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleInstallAll}
            disabled={installing !== null || installedCount === enabledCount}
            className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            {installing === 'all' ? 'Installing...' : 'Install All'}
          </button>
          <button
            onClick={handleUninstallAll}
            disabled={installing !== null || installedCount === 0}
            className="px-3 py-1.5 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50"
          >
            {installing === 'all' ? 'Removing...' : 'Uninstall All'}
          </button>
        </div>
      </div>

      <div className="space-y-3">{status.hooks.map(renderHookRow)}</div>

      <div className="mt-4 p-3 bg-blue-50 rounded-lg">
        <h4 className="font-medium text-blue-800 mb-1">How Git Hooks Work</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>
            <strong>pre-commit:</strong> Before you commit, exports database to YAML so your changes
            are versioned
          </li>
          <li>
            <strong>post-checkout:</strong> After switching branches, syncs YAML to database so you
            see the correct data
          </li>
          <li>
            <strong>post-merge:</strong> After merging, syncs YAML to database to incorporate merged
            changes
          </li>
        </ul>
      </div>

      {status.hooksPath && (
        <div className="mt-3 text-xs text-gray-500">
          Hooks directory: <code className="bg-gray-100 px-1 rounded">{status.hooksPath}</code>
        </div>
      )}
    </div>
  );
};
