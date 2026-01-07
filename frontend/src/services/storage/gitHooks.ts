/**
 * Git Hooks Service
 * Manages git hooks for automatic database sync (SDK 1.13.1+)
 * Electron only - requires file system access
 */

import { getPlatform } from '@/services/platform/platform';
import { electronFileService as platformFileService } from '@/services/platform/electron';
import { databaseService } from '@/services/sdk/databaseService';
import { databaseConfigService } from '@/services/storage/databaseConfigService';
import { isDatabaseEnabled } from '@/types/database';

// Hook script templates
const PRE_COMMIT_HOOK = `#!/bin/sh
# Data Model pre-commit hook
# Exports database changes to YAML before commit

# Check if data-model CLI is available
if command -v data-model &> /dev/null; then
  echo "Exporting database to YAML..."
  data-model export --format yaml

  # Stage any changed YAML files
  git add -A "*.yaml" "*.yml"
fi
`;

const POST_CHECKOUT_HOOK = `#!/bin/sh
# Data Model post-checkout hook
# Syncs YAML changes to database after checkout

# $3 is 1 if this is a branch checkout, 0 if it's a file checkout
if [ "$3" = "1" ]; then
  # Check if data-model CLI is available
  if command -v data-model &> /dev/null; then
    echo "Syncing YAML to database..."
    data-model sync
  fi
fi
`;

const POST_MERGE_HOOK = `#!/bin/sh
# Data Model post-merge hook
# Syncs YAML changes to database after merge

# Check if data-model CLI is available
if command -v data-model &> /dev/null; then
  echo "Syncing YAML to database after merge..."
  data-model sync
fi
`;

export interface HookStatus {
  name: string;
  installed: boolean;
  enabled: boolean;
  path: string;
  hasConflict: boolean;
}

export interface GitHooksStatus {
  gitAvailable: boolean;
  hooksPath: string | null;
  hooks: HookStatus[];
}

/**
 * Git Hooks Service
 */
class GitHooksService {
  /**
   * Check if git hooks can be managed (Electron only)
   */
  isAvailable(): boolean {
    return getPlatform() === 'electron';
  }

  /**
   * Get the .git/hooks directory path for a workspace
   */
  private async getHooksPath(workspacePath: string): Promise<string | null> {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      // Try to find .git directory
      const gitPath = `${workspacePath}/.git`;
      const hooksPath = `${gitPath}/hooks`;

      // Check if .git directory exists by trying to read it
      try {
        await platformFileService.readDirectory(gitPath);
        return hooksPath;
      } catch {
        // .git directory doesn't exist
        return null;
      }
    } catch {
      return null;
    }
  }

  /**
   * Get status of all git hooks
   */
  async getStatus(workspacePath: string): Promise<GitHooksStatus> {
    const hooksPath = await this.getHooksPath(workspacePath);

    if (!hooksPath) {
      return {
        gitAvailable: false,
        hooksPath: null,
        hooks: [],
      };
    }

    const config = await databaseConfigService.loadConfig(workspacePath);
    const hookConfigs = [
      { name: 'pre-commit', enabled: config.git.pre_commit, template: PRE_COMMIT_HOOK },
      { name: 'post-checkout', enabled: config.git.post_checkout, template: POST_CHECKOUT_HOOK },
      { name: 'post-merge', enabled: config.git.post_merge, template: POST_MERGE_HOOK },
    ];

    const hooks: HookStatus[] = [];

    for (const hookConfig of hookConfigs) {
      const hookPath = `${hooksPath}/${hookConfig.name}`;
      let installed = false;
      let hasConflict = false;

      try {
        const content = await platformFileService.readFile(hookPath);
        installed = content.includes('Data Model');
        hasConflict = !installed && content.trim().length > 0;
      } catch {
        // Hook file doesn't exist
        installed = false;
        hasConflict = false;
      }

      hooks.push({
        name: hookConfig.name,
        installed,
        enabled: hookConfig.enabled,
        path: hookPath,
        hasConflict,
      });
    }

    return {
      gitAvailable: true,
      hooksPath,
      hooks,
    };
  }

  /**
   * Install a specific git hook
   */
  async installHook(
    workspacePath: string,
    hookName: 'pre-commit' | 'post-checkout' | 'post-merge'
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.isAvailable()) {
      return { success: false, error: 'Git hooks are only available in Electron' };
    }

    const hooksPath = await this.getHooksPath(workspacePath);
    if (!hooksPath) {
      return { success: false, error: 'Git repository not found' };
    }

    const templates: Record<string, string> = {
      'pre-commit': PRE_COMMIT_HOOK,
      'post-checkout': POST_CHECKOUT_HOOK,
      'post-merge': POST_MERGE_HOOK,
    };

    const template = templates[hookName];
    if (!template) {
      return { success: false, error: `Unknown hook: ${hookName}` };
    }

    const hookPath = `${hooksPath}/${hookName}`;

    try {
      // Check if hook already exists
      let existingContent = '';
      try {
        existingContent = await platformFileService.readFile(hookPath);
      } catch {
        // File doesn't exist - that's fine
      }

      // If hook exists and is not ours, append our hook
      if (existingContent && !existingContent.includes('Data Model')) {
        // Append our hook to existing hook
        const newContent = `${existingContent}\n\n# --- Data Model Hook ---\n${template}`;
        await platformFileService.writeFile(hookPath, newContent);
      } else {
        // Write our hook
        await platformFileService.writeFile(hookPath, template);
      }

      // Make hook executable (on Unix systems)
      // Note: This requires Electron to support chmod, which may need native module
      console.log(`[GitHooks] Installed ${hookName} hook at ${hookPath}`);

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }

  /**
   * Uninstall a specific git hook
   */
  async uninstallHook(
    workspacePath: string,
    hookName: 'pre-commit' | 'post-checkout' | 'post-merge'
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.isAvailable()) {
      return { success: false, error: 'Git hooks are only available in Electron' };
    }

    const hooksPath = await this.getHooksPath(workspacePath);
    if (!hooksPath) {
      return { success: false, error: 'Git repository not found' };
    }

    const hookPath = `${hooksPath}/${hookName}`;

    try {
      let content = '';
      try {
        content = await platformFileService.readFile(hookPath);
      } catch {
        // File doesn't exist
        return { success: true };
      }

      // Remove our hook section
      if (content.includes('# --- Data Model Hook ---')) {
        // Remove our section
        const parts = content.split('# --- Data Model Hook ---');
        const newContent = parts[0]?.trim() || '';

        if (newContent) {
          await platformFileService.writeFile(hookPath, newContent);
        } else {
          await platformFileService.deleteFile(hookPath);
        }
      } else if (content.includes('Data Model')) {
        // Our hook is the entire file
        await platformFileService.deleteFile(hookPath);
      }

      console.log(`[GitHooks] Uninstalled ${hookName} hook`);
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }

  /**
   * Install all enabled hooks
   */
  async installAllHooks(workspacePath: string): Promise<{ success: boolean; errors: string[] }> {
    const config = await databaseConfigService.loadConfig(workspacePath);
    const errors: string[] = [];

    if (!config.git.hooks_enabled) {
      return { success: true, errors: [] };
    }

    const hooks: Array<{ name: 'pre-commit' | 'post-checkout' | 'post-merge'; enabled: boolean }> =
      [
        { name: 'pre-commit', enabled: config.git.pre_commit },
        { name: 'post-checkout', enabled: config.git.post_checkout },
        { name: 'post-merge', enabled: config.git.post_merge },
      ];

    for (const hook of hooks) {
      if (hook.enabled) {
        const result = await this.installHook(workspacePath, hook.name);
        if (!result.success && result.error) {
          errors.push(`${hook.name}: ${result.error}`);
        }
      }
    }

    return { success: errors.length === 0, errors };
  }

  /**
   * Uninstall all hooks
   */
  async uninstallAllHooks(workspacePath: string): Promise<{ success: boolean; errors: string[] }> {
    const errors: string[] = [];
    const hookNames: Array<'pre-commit' | 'post-checkout' | 'post-merge'> = [
      'pre-commit',
      'post-checkout',
      'post-merge',
    ];

    for (const hookName of hookNames) {
      const result = await this.uninstallHook(workspacePath, hookName);
      if (!result.success && result.error) {
        errors.push(`${hookName}: ${result.error}`);
      }
    }

    return { success: errors.length === 0, errors };
  }

  /**
   * Execute pre-commit hook logic programmatically
   * Called when saving in the app to export DB to YAML
   */
  async executePreCommit(workspacePath: string): Promise<boolean> {
    const config = await databaseConfigService.loadConfig(workspacePath);

    if (!config.git.hooks_enabled || !config.git.pre_commit) {
      return true;
    }

    if (!isDatabaseEnabled(config)) {
      return true;
    }

    try {
      // Export database to YAML
      const result = await databaseService.exportToYaml(workspacePath);
      console.log('[GitHooks] Pre-commit export:', result);
      return result.success;
    } catch (error) {
      console.error('[GitHooks] Pre-commit failed:', error);
      return false;
    }
  }

  /**
   * Execute post-checkout/post-merge hook logic programmatically
   * Called when opening a workspace to sync YAML to DB
   */
  async executePostSync(workspacePath: string): Promise<boolean> {
    const config = await databaseConfigService.loadConfig(workspacePath);

    if (!config.git.hooks_enabled) {
      return true;
    }

    if (!isDatabaseEnabled(config)) {
      return true;
    }

    try {
      // Sync YAML to database
      const result = await databaseService.syncToDatabase(workspacePath);
      console.log('[GitHooks] Post-sync result:', result);
      return result.success;
    } catch (error) {
      console.error('[GitHooks] Post-sync failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const gitHooksService = new GitHooksService();
