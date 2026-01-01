/**
 * Unit tests for Import/Export Service
 * Tests import/export functionality for various formats
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { importExportService } from '@/services/sdk/importExportService';
import { sdkLoader } from '@/services/sdk/sdkLoader';
import { sdkModeDetector } from '@/services/sdk/sdkMode';
import { apiClient } from '@/services/api/apiClient';
import type { ODCSWorkspace } from '@/services/sdk/odcsService';
import type { Table } from '@/types/table';

vi.mock('@/services/sdk/sdkLoader');
vi.mock('@/services/sdk/sdkMode');
vi.mock('@/services/api/apiClient');

describe('ImportExportService', () => {
  const mockTables: Table[] = [
    {
      id: 'table-1',
      workspace_id: 'workspace-1',
      primary_domain_id: 'domain-1',
      name: 'Users',
      model_type: 'conceptual',
      columns: [
        {
          id: 'col-1',
          table_id: 'table-1',
          name: 'id',
          data_type: 'INTEGER',
          nullable: false,
          is_primary_key: true,
          is_foreign_key: false,
          order: 0,
          created_at: '2025-01-01T00:00:00Z',
        },
      ],
      position_x: 0,
      position_y: 0,
      width: 200,
      height: 150,
      visible_domains: ['domain-1'],
      created_at: '2025-01-01T00:00:00Z',
      last_modified_at: '2025-01-01T00:00:00Z',
    },
  ];

  const mockWorkspace: ODCSWorkspace = {
    tables: mockTables,
    relationships: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock SDK module
    const mockSDKModule = {
      init: vi.fn().mockResolvedValue(undefined),
      SQLImporter: vi.fn().mockImplementation(() => ({
        import: vi.fn().mockReturnValue({ tables: mockTables, errors: [] }),
      })),
      AvroImporter: vi.fn().mockImplementation(() => ({
        import: vi.fn().mockReturnValue({ tables: mockTables, errors: [] }),
      })),
      JSONSchemaImporter: vi.fn().mockImplementation(() => ({
        import: vi.fn().mockReturnValue({ tables: mockTables, errors: [] }),
      })),
      ProtobufImporter: vi.fn().mockImplementation(() => ({
        import: vi.fn().mockReturnValue({ tables: mockTables, errors: [] }),
      })),
      SQLExporter: vi.fn().mockImplementation(() => ({
        export_data_model: vi.fn().mockReturnValue({ content: 'CREATE TABLE users...' }),
      })),
      AvroExporter: vi.fn().mockImplementation(() => ({
        export_data_model: vi.fn().mockReturnValue({ content: '{"type":"record",...}' }),
      })),
      JSONSchemaExporter: vi.fn().mockImplementation(() => ({
        export_data_model: vi.fn().mockReturnValue({ content: '{"$schema":"...",...}' }),
      })),
      ProtobufExporter: vi.fn().mockImplementation(() => ({
        export_data_model: vi.fn().mockReturnValue({ content: 'syntax = "proto3";...' }),
      })),
    };
    
    vi.mocked(sdkLoader.load).mockResolvedValue(mockSDKModule as any);
    
    // Mock API client
    vi.mocked(apiClient.getClient).mockReturnValue({
      post: vi.fn().mockResolvedValue({
        data: {
          tables: mockTables,
          errors: [],
        },
      }),
      get: vi.fn().mockResolvedValue({
        data: 'exported content',
      }),
    } as any);
  });

  describe('importFromSQL', () => {
    it('should import tables from SQL CREATE TABLE statements', async () => {
      const sqlContent = `
        CREATE TABLE users (
          id INT PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255)
        );
      `;

      vi.mocked(sdkModeDetector.getMode).mockResolvedValue('online');
      
      const result = await importExportService.importFromSQL(sqlContent, 'postgresql');
      
      expect(result.tables).toBeDefined();
      expect(result.tables.length).toBeGreaterThan(0);
      expect(apiClient.getClient().post).toHaveBeenCalledWith(
        '/api/v1/import/sql/text',
        { sql_text: sqlContent, dialect: 'postgresql' }
      );
    });

    it('should handle multiple SQL formats (PostgreSQL, MySQL, SQLite)', async () => {
      const sqlContent = 'CREATE TABLE users (id INT);';
      
      vi.mocked(sdkModeDetector.getMode).mockResolvedValue('online');
      
      const dialects = ['postgresql', 'mysql', 'sqlite'] as const;
      for (const dialect of dialects) {
        await importExportService.importFromSQL(sqlContent, dialect);
        expect(apiClient.getClient().post).toHaveBeenCalledWith(
          '/api/v1/import/sql/text',
          { sql_text: sqlContent, dialect }
        );
      }
    });

    it('should use WASM SDK when offline', async () => {
      const sqlContent = 'CREATE TABLE users (id INT);';
      
      vi.mocked(sdkModeDetector.getMode).mockResolvedValue('offline');
      
      // Mock SDK to throw error (WASM not available yet)
      await expect(importExportService.importFromSQL(sqlContent)).rejects.toThrow();
      expect(sdkLoader.load).toHaveBeenCalled();
    });
  });

  describe('importFromAVRO', () => {
    it('should import from AVRO Schema', async () => {
      const avroSchema = JSON.stringify({
        type: 'record',
        name: 'User',
        namespace: 'com.example',
        fields: [
          { name: 'id', type: 'int' },
          { name: 'name', type: 'string' },
        ],
      });

      vi.mocked(sdkModeDetector.getMode).mockResolvedValue('online');
      
      const result = await importExportService.importFromAVRO(avroSchema);
      
      expect(result.tables).toBeDefined();
      expect(apiClient.getClient().post).toHaveBeenCalledWith(
        '/api/v1/import/avro',
        { avro_text: avroSchema }
      );
    });

    it('should handle nested AVRO schemas', async () => {
      const nestedAvroSchema = JSON.stringify({
        type: 'record',
        name: 'User',
        fields: [
          { name: 'id', type: 'int' },
          {
            name: 'address',
            type: {
              type: 'record',
              name: 'Address',
              fields: [
                { name: 'street', type: 'string' },
                { name: 'city', type: 'string' },
              ],
            },
          },
        ],
      });

      vi.mocked(sdkModeDetector.getMode).mockResolvedValue('online');
      
      const result = await importExportService.importFromAVRO(nestedAvroSchema);
      
      expect(result.tables).toBeDefined();
      expect(apiClient.getClient().post).toHaveBeenCalledWith(
        '/api/v1/import/avro',
        { avro_text: nestedAvroSchema }
      );
    });
  });

  describe('importFromJSONSchema', () => {
    it('should import from JSON Schema', async () => {
      const jsonSchema = JSON.stringify({
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
        },
        required: ['id'],
      });

      vi.mocked(sdkModeDetector.getMode).mockResolvedValue('online');
      
      const result = await importExportService.importFromJSONSchema(jsonSchema);
      
      expect(result.tables).toBeDefined();
      expect(apiClient.getClient().post).toHaveBeenCalledWith(
        '/api/v1/import/json-schema',
        { json_schema_text: jsonSchema }
      );
    });

    it('should handle external references in JSON Schema', async () => {
      const jsonSchemaWithRef = JSON.stringify({
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        properties: {
          user: { $ref: 'https://example.com/schemas/user.json' },
        },
      });

      vi.mocked(sdkModeDetector.getMode).mockResolvedValue('online');
      
      const result = await importExportService.importFromJSONSchema(jsonSchemaWithRef);
      
      expect(result.tables).toBeDefined();
      expect(apiClient.getClient().post).toHaveBeenCalledWith(
        '/api/v1/import/json-schema',
        { json_schema_text: jsonSchemaWithRef }
      );
    });
  });

  describe('importFromProtobuf', () => {
    it('should import from Protobuf Schema', async () => {
      const protobufContent = `
        syntax = "proto3";
        message User {
          int32 id = 1;
          string name = 2;
        }
      `;

      vi.mocked(sdkModeDetector.getMode).mockResolvedValue('online');
      
      const result = await importExportService.importFromProtobuf(protobufContent);
      
      expect(result.tables).toBeDefined();
      expect(apiClient.getClient().post).toHaveBeenCalledWith(
        '/api/v1/import/protobuf',
        { protobuf_text: protobufContent }
      );
    });

    it('should handle nested Protobuf messages', async () => {
      const nestedProtobuf = `
        syntax = "proto3";
        message User {
          int32 id = 1;
          Address address = 2;
        }
        message Address {
          string street = 1;
          string city = 2;
        }
      `;

      vi.mocked(sdkModeDetector.getMode).mockResolvedValue('online');
      
      const result = await importExportService.importFromProtobuf(nestedProtobuf);
      
      expect(result.tables).toBeDefined();
      expect(apiClient.getClient().post).toHaveBeenCalledWith(
        '/api/v1/import/protobuf',
        { protobuf_text: nestedProtobuf }
      );
    });

    it('should handle external Protobuf imports', async () => {
      const protobufWithImport = `
        syntax = "proto3";
        import "common.proto";
        message User {
          int32 id = 1;
        }
      `;

      vi.mocked(sdkModeDetector.getMode).mockResolvedValue('online');
      
      const result = await importExportService.importFromProtobuf(protobufWithImport);
      
      expect(result.tables).toBeDefined();
      expect(apiClient.getClient().post).toHaveBeenCalledWith(
        '/api/v1/import/protobuf',
        { protobuf_text: protobufWithImport }
      );
    });
  });

  describe('exportToSQL', () => {
    const exportWorkspace: ODCSWorkspace = {
      workspace_id: 'workspace-1',
      domain_id: 'domain-1',
      tables: mockTables,
      relationships: [],
    };

    it('should export to PostgreSQL format', async () => {
      vi.mocked(sdkModeDetector.getMode).mockResolvedValue('online');
      
      const result = await importExportService.exportToSQL(exportWorkspace, 'postgresql');
      
      expect(result).toBeDefined();
      expect(apiClient.getClient().get).toHaveBeenCalledWith(
        `/api/v1/workspaces/${exportWorkspace.workspace_id}/domains/${exportWorkspace.domain_id}/export`,
        expect.objectContaining({
          params: expect.objectContaining({ format: 'sql', dialect: 'postgresql' }),
        })
      );
    });

    it('should export to MySQL format', async () => {
      vi.mocked(sdkModeDetector.getMode).mockResolvedValue('online');
      
      const result = await importExportService.exportToSQL(exportWorkspace, 'mysql');
      
      expect(result).toBeDefined();
      expect(apiClient.getClient().get).toHaveBeenCalledWith(
        `/api/v1/workspaces/${exportWorkspace.workspace_id}/domains/${exportWorkspace.domain_id}/export`,
        expect.objectContaining({
          params: expect.objectContaining({ format: 'sql', dialect: 'mysql' }),
        })
      );
    });

    it('should export to SQLite format', async () => {
      vi.mocked(sdkModeDetector.getMode).mockResolvedValue('online');
      
      const result = await importExportService.exportToSQL(exportWorkspace, 'sqlite');
      
      expect(result).toBeDefined();
      expect(apiClient.getClient().get).toHaveBeenCalledWith(
        `/api/v1/workspaces/${exportWorkspace.workspace_id}/domains/${exportWorkspace.domain_id}/export`,
        expect.objectContaining({
          params: expect.objectContaining({ format: 'sql', dialect: 'sqlite' }),
        })
      );
    });
  });

  describe('exportToAVRO', () => {
    it('should export workspace to AVRO Schema', async () => {
      const exportWorkspace: ODCSWorkspace = {
        workspace_id: 'workspace-1',
        domain_id: 'domain-1',
        tables: mockTables,
        relationships: [],
      };

      vi.mocked(sdkModeDetector.getMode).mockResolvedValue('online');
      
      const result = await importExportService.exportToAVRO(exportWorkspace);
      
      expect(result).toBeDefined();
      expect(apiClient.getClient().get).toHaveBeenCalledWith(
        `/api/v1/workspaces/${exportWorkspace.workspace_id}/domains/${exportWorkspace.domain_id}/export`,
        expect.objectContaining({
          params: expect.objectContaining({ format: 'avro' }),
        })
      );
    });
  });

  describe('exportToJSONSchema', () => {
    it('should export workspace to JSON Schema', async () => {
      const exportWorkspace: ODCSWorkspace = {
        workspace_id: 'workspace-1',
        domain_id: 'domain-1',
        tables: mockTables,
        relationships: [],
      };

      vi.mocked(sdkModeDetector.getMode).mockResolvedValue('online');
      
      const result = await importExportService.exportToJSONSchema(exportWorkspace);
      
      expect(result).toBeDefined();
      expect(apiClient.getClient().get).toHaveBeenCalledWith(
        `/api/v1/workspaces/${exportWorkspace.workspace_id}/domains/${exportWorkspace.domain_id}/export`,
        expect.objectContaining({
          params: expect.objectContaining({ format: 'json_schema' }),
        })
      );
    });
  });

  describe('exportToProtobuf', () => {
    it('should export workspace to Protobuf Schema', async () => {
      const exportWorkspace: ODCSWorkspace = {
        workspace_id: 'workspace-1',
        domain_id: 'domain-1',
        tables: mockTables,
        relationships: [],
      };

      vi.mocked(sdkModeDetector.getMode).mockResolvedValue('online');
      
      const result = await importExportService.exportToProtobuf(exportWorkspace);
      
      expect(result).toBeDefined();
      expect(apiClient.getClient().get).toHaveBeenCalledWith(
        `/api/v1/workspaces/${exportWorkspace.workspace_id}/domains/${exportWorkspace.domain_id}/export`,
        expect.objectContaining({
          params: expect.objectContaining({ format: 'protobuf' }),
        })
      );
    });
  });
});

