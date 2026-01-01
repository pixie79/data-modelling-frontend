/**
 * Import/Export Service
 * Handles import/export operations for various formats (SQL, AVRO, JSON Schema, Protobuf)
 * Supports both online (via API) and offline (via WASM SDK) modes
 */

import { apiClient } from '../api/apiClient';
import { sdkModeDetector } from './sdkMode';
import { sdkLoader } from './sdkLoader';
import type { ODCSWorkspace } from './odcsService';
import type { Table } from '@/types/table';

export interface ImportResult {
  tables: Table[];
  errors: Array<{
    error_type: string;
    field: string;
    message: string;
  }>;
  ai_suggestions?: unknown[];
}

class ImportExportService {
  /**
   * Import from SQL format (multiple dialects)
   * Uses API when online, WASM SDK when offline
   */
  async importFromSQL(
    sqlContent: string,
    dialect: 'postgresql' | 'mysql' | 'sqlite' | 'mssql' = 'postgresql'
  ): Promise<ODCSWorkspace> {
    const mode = await sdkModeDetector.getMode();

    if (mode === 'online') {
      // Use API endpoint (which uses SDK)
      try {
        const response = await apiClient.getClient().post<ImportResult>('/api/v1/import/sql/text', {
          sql_text: sqlContent,
          dialect: dialect,
        });

        return {
          tables: response.data.tables || [],
          relationships: [],
        } as ODCSWorkspace;
      } catch (error) {
        throw new Error(
          `Failed to import SQL via API: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    } else {
      // Use WASM SDK directly for offline mode
      try {
        await sdkLoader.load();
        // TODO: Call SDK importFromSQL when WASM bindings are available
        // const sdk = await sdkLoader.load();
        // return await sdk.importFromSQL(sqlContent, dialect);
        throw new Error('WASM SDK not yet available - offline mode requires SDK build');
      } catch (error) {
        throw new Error(
          `Failed to import SQL offline: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
  }

  /**
   * Import from AVRO Schema
   * Uses API when online, WASM SDK when offline
   */
  async importFromAVRO(avroContent: string): Promise<ODCSWorkspace> {
    const mode = await sdkModeDetector.getMode();

    if (mode === 'online') {
      try {
        const response = await apiClient.getClient().post<ImportResult>('/api/v1/import/avro', {
          avro_text: avroContent,
        });

        return {
          tables: response.data.tables || [],
          relationships: [],
        } as ODCSWorkspace;
      } catch (error) {
        throw new Error(
          `Failed to import AVRO via API: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    } else {
      try {
        await sdkLoader.load();
        // TODO: Call SDK importFromAVRO when WASM bindings are available
        // const sdk = await sdkLoader.load();
        // return await sdk.importFromAVRO(avroContent);
        throw new Error('WASM SDK not yet available - offline mode requires SDK build');
      } catch (error) {
        throw new Error(
          `Failed to import AVRO offline: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
  }

  /**
   * Import from JSON Schema
   * Uses API when online, WASM SDK when offline
   */
  async importFromJSONSchema(jsonSchemaContent: string): Promise<ODCSWorkspace> {
    const mode = await sdkModeDetector.getMode();

    if (mode === 'online') {
      try {
        const response = await apiClient.getClient().post<ImportResult>('/api/v1/import/json-schema', {
          json_schema_text: jsonSchemaContent,
        });

        return {
          tables: response.data.tables || [],
          relationships: [],
        } as ODCSWorkspace;
      } catch (error) {
        throw new Error(
          `Failed to import JSON Schema via API: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    } else {
      try {
        await sdkLoader.load();
        // TODO: Call SDK importFromJSONSchema when WASM bindings are available
        // const sdk = await sdkLoader.load();
        // return await sdk.importFromJSONSchema(jsonSchemaContent);
        throw new Error('WASM SDK not yet available - offline mode requires SDK build');
      } catch (error) {
        throw new Error(
          `Failed to import JSON Schema offline: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
  }

  /**
   * Import from Protobuf Schema (including nested schemas and external references)
   * Uses API when online, WASM SDK when offline
   */
  async importFromProtobuf(protobufContent: string): Promise<ODCSWorkspace> {
    const mode = await sdkModeDetector.getMode();

    if (mode === 'online') {
      try {
        const response = await apiClient.getClient().post<ImportResult>('/api/v1/import/protobuf', {
          protobuf_text: protobufContent,
        });

        return {
          tables: response.data.tables || [],
          relationships: [],
        } as ODCSWorkspace;
      } catch (error) {
        throw new Error(
          `Failed to import Protobuf via API: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    } else {
      try {
        await sdkLoader.load();
        // TODO: Call SDK importFromProtobuf when WASM bindings are available
        // const sdk = await sdkLoader.load();
        // return await sdk.importFromProtobuf(protobufContent);
        throw new Error('WASM SDK not yet available - offline mode requires SDK build');
      } catch (error) {
        throw new Error(
          `Failed to import Protobuf offline: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
  }

  /**
   * Export to SQL Create Table format (multiple dialects)
   * Uses API when online, WASM SDK when offline
   */
  async exportToSQL(
    workspace: ODCSWorkspace,
    dialect: 'postgresql' | 'mysql' | 'sqlite' | 'mssql' = 'postgresql',
    _options?: { includeConstraints?: boolean; includeIndexes?: boolean }
  ): Promise<string> {
    const mode = await sdkModeDetector.getMode();

    if (mode === 'online') {
      try {
        const workspaceId = (workspace as any).workspace_id || 'default';
        const domainId = (workspace as any).domain_id || 'default';
        
        const response = await apiClient.getClient().get<string>(
          `/api/v1/workspaces/${workspaceId}/domains/${domainId}/export`,
          {
            params: {
              format: 'sql',
              dialect: dialect,
            },
          }
        );

        return response.data;
      } catch (error) {
        throw new Error(
          `Failed to export SQL via API: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    } else {
      try {
        await sdkLoader.load();
        // TODO: Call SDK exportToSQL when WASM bindings are available
        // const sdk = await sdkLoader.load();
        // return await sdk.exportToSQL(workspace, dialect, options);
        throw new Error('WASM SDK not yet available - offline mode requires SDK build');
      } catch (error) {
        throw new Error(
          `Failed to export SQL offline: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
  }

  /**
   * Export to AVRO Schema
   * Uses API when online, WASM SDK when offline
   */
  async exportToAVRO(workspace: ODCSWorkspace, _options?: Record<string, unknown>): Promise<string> {
    const mode = await sdkModeDetector.getMode();

    if (mode === 'online') {
      try {
        const workspaceId = (workspace as any).workspace_id || 'default';
        const domainId = (workspace as any).domain_id || 'default';
        
        const response = await apiClient.getClient().get<string>(
          `/api/v1/workspaces/${workspaceId}/domains/${domainId}/export`,
          {
            params: {
              format: 'avro',
            },
          }
        );

        return response.data;
      } catch (error) {
        throw new Error(
          `Failed to export AVRO via API: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    } else {
      try {
        await sdkLoader.load();
        // TODO: Call SDK exportToAVRO when WASM bindings are available
        // const sdk = await sdkLoader.load();
        // return await sdk.exportToAVRO(workspace, options);
        throw new Error('WASM SDK not yet available - offline mode requires SDK build');
      } catch (error) {
        throw new Error(
          `Failed to export AVRO offline: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
  }

  /**
   * Export to JSON Schema
   * Uses API when online, WASM SDK when offline
   */
  async exportToJSONSchema(workspace: ODCSWorkspace, _options?: Record<string, unknown>): Promise<string> {
    const mode = await sdkModeDetector.getMode();

    if (mode === 'online') {
      try {
        const workspaceId = (workspace as any).workspace_id || 'default';
        const domainId = (workspace as any).domain_id || 'default';
        
        const response = await apiClient.getClient().get<string>(
          `/api/v1/workspaces/${workspaceId}/domains/${domainId}/export`,
          {
            params: {
              format: 'json_schema',
            },
          }
        );

        return response.data;
      } catch (error) {
        throw new Error(
          `Failed to export JSON Schema via API: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    } else {
      try {
        await sdkLoader.load();
        // TODO: Call SDK exportToJSONSchema when WASM bindings are available
        // const sdk = await sdkLoader.load();
        // return await sdk.exportToJSONSchema(workspace, options);
        throw new Error('WASM SDK not yet available - offline mode requires SDK build');
      } catch (error) {
        throw new Error(
          `Failed to export JSON Schema offline: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
  }

  /**
   * Export to Protobuf Schema
   * Uses API when online, WASM SDK when offline
   */
  async exportToProtobuf(workspace: ODCSWorkspace, _options?: Record<string, unknown>): Promise<string> {
    const mode = await sdkModeDetector.getMode();

    if (mode === 'online') {
      try {
        const workspaceId = (workspace as any).workspace_id || 'default';
        const domainId = (workspace as any).domain_id || 'default';
        
        const response = await apiClient.getClient().get<string>(
          `/api/v1/workspaces/${workspaceId}/domains/${domainId}/export`,
          {
            params: {
              format: 'protobuf',
            },
          }
        );

        return response.data;
      } catch (error) {
        throw new Error(
          `Failed to export Protobuf via API: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    } else {
      try {
        await sdkLoader.load();
        // TODO: Call SDK exportToProtobuf when WASM bindings are available
        // const sdk = await sdkLoader.load();
        // return await sdk.exportToProtobuf(workspace, options);
        throw new Error('WASM SDK not yet available - offline mode requires SDK build');
      } catch (error) {
        throw new Error(
          `Failed to export Protobuf offline: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
  }
}

// Export singleton instance
export const importExportService = new ImportExportService();
