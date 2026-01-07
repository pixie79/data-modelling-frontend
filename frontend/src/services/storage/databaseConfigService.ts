/**
 * Database Configuration Service
 * Handles loading, saving, and validating database configuration (.data-model.toml)
 * SDK 1.13.1+
 */

import type { DatabaseConfig, PostgresConfig, SyncConfig } from '@/types/database';
import { DatabaseBackend, DEFAULT_DATABASE_CONFIG, validateDatabaseConfig } from '@/types/database';

// Configuration file name
const CONFIG_FILE_NAME = '.data-model.toml';

/**
 * Parse TOML content into DatabaseConfig
 * Simple TOML parser for our specific config format
 */
function parseTOML(content: string): DatabaseConfig {
  const config: DatabaseConfig = { ...DEFAULT_DATABASE_CONFIG };
  const lines = content.split('\n');
  let currentSection = '';

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    // Check for section header
    const sectionMatch = trimmed.match(/^\[([^\]]+)\]$/);
    if (sectionMatch && sectionMatch[1]) {
      currentSection = sectionMatch[1];
      continue;
    }

    // Parse key-value pair
    const kvMatch = trimmed.match(/^(\w+)\s*=\s*(.+)$/);
    if (kvMatch && kvMatch[1] && kvMatch[2]) {
      const [, key, rawValue] = kvMatch;
      const value = parseValue(rawValue as string);

      // Assign to appropriate section
      switch (currentSection) {
        case 'database':
          if (key === 'backend') {
            config.database.backend = value as DatabaseBackend;
          } else if (key === 'path') {
            config.database.path = value as string;
          }
          break;

        case 'postgres':
          if (!config.postgres) {
            config.postgres = {} as PostgresConfig;
          }
          if (key === 'connection_string') {
            config.postgres.connection_string = value as string;
          } else if (key === 'pool_size') {
            config.postgres.pool_size = value as number;
          } else if (key === 'ssl_mode') {
            config.postgres.ssl_mode = value as PostgresConfig['ssl_mode'];
          } else if (key === 'connect_timeout') {
            config.postgres.connect_timeout = value as number;
          }
          break;

        case 'sync':
          if (key === 'auto_sync') {
            config.sync.auto_sync = value as boolean;
          } else if (key === 'watch') {
            config.sync.watch = value as boolean;
          } else if (key === 'sync_on_save') {
            config.sync.sync_on_save = value as boolean;
          } else if (key === 'conflict_strategy') {
            config.sync.conflict_strategy = value as SyncConfig['conflict_strategy'];
          }
          break;

        case 'git':
          if (key === 'hooks_enabled') {
            config.git.hooks_enabled = value as boolean;
          } else if (key === 'pre_commit') {
            config.git.pre_commit = value as boolean;
          } else if (key === 'post_checkout') {
            config.git.post_checkout = value as boolean;
          } else if (key === 'post_merge') {
            config.git.post_merge = value as boolean;
          }
          break;
      }
    }
  }

  return config;
}

/**
 * Parse a TOML value (handles strings, numbers, booleans)
 */
function parseValue(raw: string): string | number | boolean {
  const trimmed = raw.trim();

  // Boolean
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;

  // String (quoted)
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  // Number
  const num = Number(trimmed);
  if (!isNaN(num)) return num;

  // Default to string
  return trimmed;
}

/**
 * Serialize DatabaseConfig to TOML format
 */
function serializeToTOML(config: DatabaseConfig): string {
  const lines: string[] = [
    '# Data Model Database Configuration',
    '# SDK 1.13.1+ DuckDB/PostgreSQL backend support',
    '',
    '[database]',
    `backend = "${config.database.backend}"`,
  ];

  if (config.database.path) {
    lines.push(`path = "${config.database.path}"`);
  }

  if (config.postgres && config.database.backend === DatabaseBackend.PostgreSQL) {
    lines.push('');
    lines.push('[postgres]');
    lines.push(`connection_string = "${config.postgres.connection_string}"`);
    if (config.postgres.pool_size !== undefined) {
      lines.push(`pool_size = ${config.postgres.pool_size}`);
    }
    if (config.postgres.ssl_mode) {
      lines.push(`ssl_mode = "${config.postgres.ssl_mode}"`);
    }
    if (config.postgres.connect_timeout !== undefined) {
      lines.push(`connect_timeout = ${config.postgres.connect_timeout}`);
    }
  }

  lines.push('');
  lines.push('[sync]');
  lines.push(`auto_sync = ${config.sync.auto_sync}`);
  lines.push(`watch = ${config.sync.watch}`);
  lines.push(`sync_on_save = ${config.sync.sync_on_save}`);
  lines.push(`conflict_strategy = "${config.sync.conflict_strategy}"`);

  lines.push('');
  lines.push('[git]');
  lines.push(`hooks_enabled = ${config.git.hooks_enabled}`);
  lines.push(`pre_commit = ${config.git.pre_commit}`);
  lines.push(`post_checkout = ${config.git.post_checkout}`);
  lines.push(`post_merge = ${config.git.post_merge}`);

  return lines.join('\n') + '\n';
}

/**
 * Database Configuration Service
 */
class DatabaseConfigService {
  private configCache: Map<string, DatabaseConfig> = new Map();

  /**
   * Get the configuration file path for a workspace
   */
  getConfigPath(workspacePath: string): string {
    // Normalize path separators
    const normalizedPath = workspacePath.replace(/\\/g, '/');
    return `${normalizedPath}/${CONFIG_FILE_NAME}`;
  }

  /**
   * Load database configuration from a workspace
   * Falls back to default config if file doesn't exist
   */
  async loadConfig(workspacePath: string): Promise<DatabaseConfig> {
    // Check cache first
    const cached = this.configCache.get(workspacePath);
    if (cached) {
      return cached;
    }

    const configPath = this.getConfigPath(workspacePath);

    try {
      // Try to read the config file
      const content = await this.readFile(configPath);
      const config = parseTOML(content);

      // Validate the config
      const validation = validateDatabaseConfig(config);
      if (!validation.valid) {
        console.warn('[DatabaseConfig] Invalid configuration:', validation.errors);
        // Return config anyway but log warnings
      }

      this.configCache.set(workspacePath, config);
      return config;
    } catch {
      // File doesn't exist or couldn't be read - return default config
      console.log('[DatabaseConfig] No config file found, using defaults');
      const defaultConfig = this.getDefaultConfig();
      this.configCache.set(workspacePath, defaultConfig);
      return defaultConfig;
    }
  }

  /**
   * Save database configuration to a workspace
   */
  async saveConfig(workspacePath: string, config: DatabaseConfig): Promise<void> {
    // Validate before saving
    const validation = validateDatabaseConfig(config);
    if (!validation.valid) {
      throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
    }

    const configPath = this.getConfigPath(workspacePath);
    const content = serializeToTOML(config);

    await this.writeFile(configPath, content);

    // Update cache
    this.configCache.set(workspacePath, config);
  }

  /**
   * Get the default configuration
   */
  getDefaultConfig(): DatabaseConfig {
    return { ...DEFAULT_DATABASE_CONFIG };
  }

  /**
   * Check if a configuration file exists for a workspace
   */
  async configExists(workspacePath: string): Promise<boolean> {
    const configPath = this.getConfigPath(workspacePath);
    try {
      await this.readFile(configPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create a new configuration file with defaults
   */
  async createDefaultConfig(workspacePath: string): Promise<DatabaseConfig> {
    const config = this.getDefaultConfig();
    await this.saveConfig(workspacePath, config);
    return config;
  }

  /**
   * Update specific configuration sections
   */
  async updateConfig(
    workspacePath: string,
    updates: Partial<DatabaseConfig>
  ): Promise<DatabaseConfig> {
    const currentConfig = await this.loadConfig(workspacePath);

    const newConfig: DatabaseConfig = {
      database: { ...currentConfig.database, ...updates.database },
      postgres: updates.postgres ?? currentConfig.postgres,
      sync: { ...currentConfig.sync, ...updates.sync },
      git: { ...currentConfig.git, ...updates.git },
    };

    await this.saveConfig(workspacePath, newConfig);
    return newConfig;
  }

  /**
   * Clear the configuration cache
   */
  clearCache(): void {
    this.configCache.clear();
  }

  /**
   * Clear cache for a specific workspace
   */
  clearWorkspaceCache(workspacePath: string): void {
    this.configCache.delete(workspacePath);
  }

  /**
   * Read a file - platform-aware implementation
   */
  private async readFile(filePath: string): Promise<string> {
    // Check if we're in Electron
    if (typeof window !== 'undefined' && (window as any).electronAPI?.readFile) {
      return await (window as any).electronAPI.readFile(filePath);
    }

    // Browser fallback - use fetch for local files
    const response = await fetch(filePath);
    if (!response.ok) {
      throw new Error(`Failed to read file: ${response.statusText}`);
    }
    return await response.text();
  }

  /**
   * Write a file - platform-aware implementation
   */
  private async writeFile(filePath: string, content: string): Promise<void> {
    // Check if we're in Electron
    if (typeof window !== 'undefined' && (window as any).electronAPI?.writeFile) {
      await (window as any).electronAPI.writeFile(filePath, content);
      return;
    }

    // Browser - can't write to filesystem directly
    // Store in IndexedDB or localStorage as fallback
    console.warn('[DatabaseConfig] Cannot write to filesystem in browser mode');
    throw new Error('Cannot write configuration file in browser mode');
  }
}

// Export singleton instance
export const databaseConfigService = new DatabaseConfigService();

// Export types and functions for external use
export { parseTOML, serializeToTOML };
