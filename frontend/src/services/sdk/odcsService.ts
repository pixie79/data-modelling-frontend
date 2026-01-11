/**
 * ODCS Service
 * Handles ODCS 3.1.0 format operations
 * Supports both online (via API) and offline (via WASM SDK) modes
 */

import { apiClient } from '../api/apiClient';
import { sdkModeDetector } from './sdkMode';
import { sdkLoader } from './sdkLoader';
import * as yaml from 'js-yaml';
import { isValidUUID, generateUUID } from '@/utils/validation';
import type { Table, Column } from '@/types/table'; // Import Column type
import type { Relationship } from '@/types/relationship';
import type { DataFlowDiagram } from '@/types/dataflow';

export interface ODCSWorkspace {
  workspace_id?: string;
  domain_id?: string;
  tables: Table[];
  relationships?: Relationship[];
  data_flow_diagrams?: DataFlowDiagram[];
  [key: string]: unknown;
}

export interface ImportResult {
  tables: Table[];
  errors: Array<{
    error_type: string;
    field: string;
    message: string;
  }>;
  ai_suggestions?: unknown[];
}

class ODCSService {
  /**
   * Parse ODCS (Open Data Contract Standard) YAML content to workspace object
   * SDK 1.8.4+: Uses separate parsers for ODCS and ODCL
   *
   * For ODCL files, use parseODCL() instead
   * Note: API mode is out of scope - offline/WASM only
   */
  async parseYAML(yamlContent: string): Promise<ODCSWorkspace> {
    console.log('[ODCSService] parseYAML called (ODCS only), content length:', yamlContent.length);

    // SDK 1.8.4+: API is out of scope, skip API mode check
    const mode = await sdkModeDetector.getMode();

    if (mode === 'online') {
      // API mode is out of scope for SDK 1.8.4+ migration
      // If online mode is needed in future, implement API endpoints separately
      console.warn('[ODCSService] API mode is not supported - falling through to offline mode');
    }

    // Use WASM SDK directly for offline mode (SDK 1.8.4+)
    try {
      await sdkLoader.load();
      const sdk = sdkLoader.getModule();

      console.log('[ODCSService] SDK module loaded for ODCS parsing');

      if (sdk && 'parse_odcs_yaml' in sdk && typeof (sdk as any).parse_odcs_yaml === 'function') {
        console.log('[ODCSService] Using SDK parse_odcs_yaml method (SDK 1.8.4+)');
        try {
          // IMPORTANT: SDK parse_odcs_yaml does NOT return customProperties from the YAML
          // We need to extract it from the raw YAML before SDK processing
          let rawCustomProperties: any[] = [];
          try {
            const yaml = await import('js-yaml');
            const rawParsed = yaml.load(yamlContent) as any;
            if (
              rawParsed &&
              rawParsed.customProperties &&
              Array.isArray(rawParsed.customProperties)
            ) {
              rawCustomProperties = rawParsed.customProperties;
              console.log(
                '[ODCSService] Extracted customProperties from raw YAML:',
                rawCustomProperties
              );
            }
          } catch (yamlErr) {
            console.warn(
              '[ODCSService] Failed to extract customProperties from raw YAML:',
              yamlErr
            );
          }

          // SDK 1.8.4+: No preprocessing needed, SDK handles validation
          const resultJson = (sdk as any).parse_odcs_yaml(yamlContent);
          const result = JSON.parse(resultJson);
          console.log('[ODCSService] SDK parse_odcs_yaml result:', result);

          // Log table structure to verify quality rules are included
          if (result.tables && result.tables.length > 0) {
            console.log('[ODCSService] First table structure:', {
              id: result.tables[0].id,
              name: result.tables[0].name,
              columnsCount: result.tables[0].columns?.length,
              hasQualityRules: !!result.tables[0].quality_rules,
              firstColumnQuality: result.tables[0].columns?.[0]?.quality,
              firstColumnSample: result.tables[0].columns?.[0],
            });
          }
          // Also log the root-level id from ODCS file
          console.log('[ODCSService] Result root-level id:', result.id);

          // SDK 1.8.4+: Normalize tables to ensure quality rules are in expected format
          // The SDK returns 'quality' array on columns, but UI expects 'quality_rules'
          // IMPORTANT: customProperties is at the root level of ODCS, not on each table
          // SDK does NOT pass through customProperties, so we use the raw YAML extraction
          const rootCustomProperties = rawCustomProperties;
          console.log(
            '[ODCSService] Injecting root customProperties into tables:',
            rootCustomProperties
          );

          const normalizedTables = (result.tables || []).map((table: any, index: number) => {
            // Inject root-level customProperties into table if table doesn't have its own
            const tableWithCustomProps = {
              ...table,
              customProperties:
                table.customProperties || table.custom_properties || rootCustomProperties,
            };
            return this.normalizeTable(tableWithCustomProps, index, {}, {});
          });

          // SDK 1.8.4+: Returns complete, validated data - preserve all fields
          // Spread result first, then override tables with normalized version
          const { tables: _rawTables, ...restResult } = result;
          return {
            ...restResult, // Preserve any additional fields from SDK
            workspace_id: result.workspace_id,
            domain_id: result.domain_id,
            tables: normalizedTables,
            relationships: result.relationships || [],
            data_flow_diagrams: result.data_flow_diagrams || [],
          };
        } catch (error) {
          console.error('[ODCSService] Error parsing ODCS with SDK:', error);
          throw new Error(
            `Failed to parse ODCS YAML with SDK: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      }

      // SDK 1.8.4+ method not available - provide helpful error
      console.warn('[ODCSService] SDK parse_odcs_yaml method not found');
      throw new Error(
        'ODCS parsing requires SDK version 1.8.4 or higher. ' +
          'The parse_odcs_yaml method is not available. ' +
          'Please update the WASM SDK to version 1.8.4+.'
      );
    } catch (error) {
      // Fallback to basic YAML parser if SDK fails
      console.warn('[ODCSService] SDK parsing failed, trying fallback parser:', error);
      try {
        return this.parseYAMLFallback(yamlContent, 'odcs');
      } catch (fallbackError) {
        throw new Error(
          `Failed to parse ODCS YAML: ${error instanceof Error ? error.message : 'Unknown error'}. ` +
            `Fallback parser also failed: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown error'}`
        );
      }
    }
  }

  /**
   * Parse ODCL (Open Data Contract Language) YAML content to workspace object
   * SDK 1.8.4+ provides a separate parser for ODCL format
   * ODCL is identified by the 'dataContractSpecification' field at root level
   *
   * Note: This is for import only - we don't support ODCL export
   */
  async parseODCL(yamlContent: string): Promise<ODCSWorkspace> {
    console.log('[ODCSService] parseODCL called, content length:', yamlContent.length);

    // SDK 1.8.4+ uses offline mode only (API is out of scope)
    try {
      await sdkLoader.load();
      const sdk = sdkLoader.getModule();

      console.log('[ODCSService] SDK module loaded for ODCL parsing');

      if (sdk && 'parse_odcl_yaml' in sdk && typeof (sdk as any).parse_odcl_yaml === 'function') {
        console.log('[ODCSService] Using SDK parse_odcl_yaml method (SDK 1.8.4+)');
        try {
          // Call SDK function (synchronous, returns JSON string)
          const resultJson = (sdk as any).parse_odcl_yaml(yamlContent);
          const result = JSON.parse(resultJson);
          console.log('[ODCSService] SDK parse_odcl_yaml result:', result);

          // Log table structure to verify quality rules are included
          if (result.tables && result.tables.length > 0) {
            console.log('[ODCSService] First table structure:', {
              name: result.tables[0].name,
              columnsCount: result.tables[0].columns?.length,
              hasQualityRules: !!result.tables[0].quality_rules,
              firstColumnQuality: result.tables[0].columns?.[0]?.quality,
              firstColumnSample: result.tables[0].columns?.[0],
            });
          }

          // SDK 1.8.4+: Normalize tables to ensure quality rules are in expected format
          // The SDK returns 'quality' array on columns, but UI expects 'quality_rules'
          const normalizedTables = (result.tables || []).map((table: any, index: number) =>
            this.normalizeTable(table, index, {}, {})
          );

          // SDK 1.8.4+ returns complete workspace structure with all ODCL metadata
          // Spread result first, then override tables with normalized version
          const { tables: _rawTables, ...restResult } = result;
          return {
            ...restResult, // Preserve any additional fields from SDK
            workspace_id: result.workspace_id,
            domain_id: result.domain_id,
            tables: normalizedTables,
            relationships: result.relationships || [],
            data_flow_diagrams: result.data_flow_diagrams || [],
          };
        } catch (error) {
          console.error('[ODCSService] Error parsing ODCL with SDK:', error);
          throw new Error(
            `Failed to parse ODCL YAML with SDK: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      }

      // If SDK 1.8.4 not available, provide helpful error message
      throw new Error(
        'ODCL parsing requires SDK version 1.8.4 or higher. ' +
          'The parse_odcl_yaml method is not available in the current SDK. ' +
          'Please update the WASM SDK to version 1.8.4+.'
      );
    } catch (error) {
      // Re-throw with context
      throw new Error(
        `Failed to parse ODCL YAML: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Convert workspace object to ODCS YAML format
   * Uses API when online, WASM SDK when offline
   */
  async toYAML(workspace: ODCSWorkspace): Promise<string> {
    const mode = await sdkModeDetector.getMode();

    if (mode === 'online') {
      // Use API endpoint (which uses SDK)
      try {
        const workspaceId = workspace.workspace_id || 'default';
        const domainId = workspace.domain_id || 'default';

        const response = await apiClient
          .getClient()
          .get<string>(`/api/v1/workspaces/${workspaceId}/domains/${domainId}/export`, {
            params: {
              format: 'odcl',
            },
          });

        return response.data;
      } catch (error) {
        throw new Error(
          `Failed to convert to ODCS YAML via API: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    } else {
      // Use WASM SDK directly for offline mode, with fallback to basic YAML conversion
      try {
        await sdkLoader.load();
        const sdk = sdkLoader.getModule();

        // Check if SDK actually has toYAML method (when WASM bindings are available)
        // SDK 1.1.0+ exposes export_to_odcs_yaml function
        if (sdk) {
          // SDK 1.1.0+ uses export_to_odcs_yaml (takes JSON string, returns YAML string)
          if (
            'export_to_odcs_yaml' in sdk &&
            typeof (sdk as any).export_to_odcs_yaml === 'function'
          ) {
            console.log('[ODCSService] Using SDK export_to_odcs_yaml method (SDK 1.1.0+)');
            try {
              // Use the same workspace preparation as importExportService to ensure DataModel structure
              // The SDK's export_to_odcs_yaml expects a DataModel structure with all required fields
              const { normalizeWorkspaceUUIDs, generateUUID } = await import('@/utils/validation');
              const normalized = normalizeWorkspaceUUIDs(workspace);

              // Prepare DataModel structure with all required fields (same as importExportService)
              const now = new Date().toISOString();
              const workspaceId = normalized.workspace_id || generateUUID();

              // Clean tables (remove complex nested objects, but preserve metadata including system_id)
              // SDK 1.14.2+ export_to_odcs_yaml expects camelCase field names
              const cleanedTables = Array.isArray(normalized.tables)
                ? normalized.tables.map((table: any) => {
                    const cleaned: any = {
                      id: table.id,
                      workspaceId: table.workspace_id,
                      name: table.name,
                      modelType: table.model_type || 'conceptual',
                      // Ensure status is present (required by ODCS schema)
                      status: table.status || table.metadata?.status || 'draft',
                      columns: Array.isArray(table.columns)
                        ? table.columns.map((col: any) => {
                            const column: any = {
                              id: col.id,
                              tableId: col.table_id,
                              name: col.name,
                              dataType: col.data_type || col.dataType || 'string',
                              nullable: col.nullable ?? false,
                              primaryKey: col.is_primary_key ?? col.primaryKey ?? false,
                              order: col.order ?? 0,
                              createdAt: col.created_at || col.createdAt || now,
                            };
                            // Only add foreignKey as an object if there's a reference
                            if (col.is_foreign_key || col.foreignKey) {
                              column.foreignKey = {
                                columnId:
                                  col.foreign_key_reference || col.foreignKeyReference || null,
                              };
                            }
                            if (col.description) column.description = col.description;
                            if (col.default_value) column.defaultValue = col.default_value;
                            return column;
                          })
                        : [],
                      createdAt: table.created_at || now,
                      updatedAt: table.last_modified_at || table.updated_at || now,
                    };
                    if (table.primary_domain_id) cleaned.primaryDomainId = table.primary_domain_id;
                    if (table.alias) cleaned.alias = table.alias;
                    if (table.description) cleaned.description = table.description;
                    if (Array.isArray(table.tags)) cleaned.tags = table.tags;
                    if (table.data_level) cleaned.dataLevel = table.data_level;
                    // IMPORTANT: Preserve metadata (including system_id) when saving
                    if (table.metadata && typeof table.metadata === 'object') {
                      cleaned.metadata = { ...table.metadata };
                      if (table.metadata.system_id) {
                        console.log(
                          `[ODCSService] Preserving system_id="${table.metadata.system_id}" in metadata for table "${table.name}"`
                        );
                      }
                    }
                    // IMPORTANT: Preserve compound keys (composite primary/unique keys)
                    if (Array.isArray(table.compoundKeys) && table.compoundKeys.length > 0) {
                      cleaned.compoundKeys = table.compoundKeys.map((ck: any) => ({
                        id: ck.id,
                        tableId: ck.table_id || table.id,
                        columnIds: ck.column_ids || ck.columnIds,
                        isPrimary: ck.is_primary ?? ck.isPrimary ?? false,
                        createdAt: ck.created_at || ck.createdAt || now,
                        ...(ck.name && { name: ck.name }),
                      }));
                    } else if (
                      Array.isArray(table.compound_keys) &&
                      table.compound_keys.length > 0
                    ) {
                      cleaned.compoundKeys = table.compound_keys.map((ck: any) => ({
                        id: ck.id,
                        tableId: ck.table_id || table.id,
                        columnIds: ck.column_ids || ck.columnIds,
                        isPrimary: ck.is_primary ?? ck.isPrimary ?? false,
                        createdAt: ck.created_at || ck.createdAt || now,
                        ...(ck.name && { name: ck.name }),
                      }));
                    }
                    return cleaned;
                  })
                : [];

              // Clean relationships (SDK 1.14.2+ expects camelCase)
              const cleanedRelationships = Array.isArray(normalized.relationships)
                ? normalized.relationships.map((rel: any) => ({
                    id: rel.id,
                    workspaceId: rel.workspace_id,
                    sourceTableId: rel.source_table_id || rel.source_id,
                    targetTableId: rel.target_table_id || rel.target_id,
                    createdAt: rel.created_at || now,
                    updatedAt: rel.last_modified_at || rel.updated_at || now,
                    ...(rel.domain_id && { domainId: rel.domain_id }),
                    ...(rel.cardinality && { cardinality: rel.cardinality }),
                    ...(rel.type && { type: rel.type }),
                    ...(rel.name && { name: rel.name }),
                    ...(rel.label && { label: rel.label }),
                  }))
                : [];

              // Create DataModel structure with all required fields (SDK 1.14.2+ expects camelCase)
              const dataModel = {
                id: workspaceId,
                name: (normalized as any).name || 'Workspace',
                gitDirectoryPath: (normalized as any).git_directory_path || '',
                controlFilePath: (normalized as any).control_file_path || '',
                tables: cleanedTables,
                relationships: cleanedRelationships,
                domains: [],
                createdAt: (normalized as any).created_at || now,
                updatedAt:
                  (normalized as any).updated_at || (normalized as any).last_modified_at || now,
                isSubfolder: (normalized as any).is_subfolder ?? false,
              };

              // Convert DataModel to JSON string
              const workspaceJson = JSON.stringify(dataModel);
              // Call SDK function (synchronous, returns YAML string)
              let yamlResult = (sdk as any).export_to_odcs_yaml(workspaceJson);

              // Post-process YAML to fix SDK schema generation issues
              // SDK sometimes generates invalid schema where properties should be an array
              try {
                const parsed = yaml.load(yamlResult) as any;
                let modified = false;

                // Fix schema properties structure if needed
                if (parsed.schema && Array.isArray(parsed.schema)) {
                  parsed.schema.forEach((schemaItem: any, index: number) => {
                    if (
                      schemaItem.properties &&
                      typeof schemaItem.properties === 'object' &&
                      !Array.isArray(schemaItem.properties)
                    ) {
                      // Convert properties object to array format
                      const propertiesArray = Object.entries(schemaItem.properties).map(
                        ([name, prop]: [string, any]) => ({
                          name,
                          ...prop,
                        })
                      );
                      schemaItem.properties = propertiesArray;
                      modified = true;
                      console.log(
                        `[ODCSService] Fixed schema[${index}].properties: converted object to array`
                      );
                    }

                    // Ensure status is present (required by ODCS schema)
                    if (!schemaItem.status) {
                      schemaItem.status = 'draft';
                      modified = true;
                      console.log(`[ODCSService] Added missing status field to schema[${index}]`);
                    }
                  });
                }

                if (modified) {
                  yamlResult = yaml.dump(parsed, {
                    lineWidth: -1,
                    noRefs: true,
                    sortKeys: false,
                  });
                  console.log('[ODCSService] Post-processed YAML to fix schema structure');
                }
              } catch (error) {
                console.warn(
                  '[ODCSService] Failed to post-process YAML, returning original:',
                  error
                );
              }

              return yamlResult;
            } catch (error) {
              console.error('[ODCSService] Error calling SDK export_to_odcs_yaml:', error);
              throw error;
            }
          }

          // Try legacy method names for backward compatibility
          const exportMethods = [
            'toODCSYAML',
            'to_odcs_yaml',
            'toODCLYAML',
            'to_odcl_yaml',
            'export_odcs',
            'exportOdcs',
            'to_yaml',
            'toYaml',
          ];

          for (const methodName of exportMethods) {
            if (methodName in sdk && typeof (sdk as any)[methodName] === 'function') {
              console.log(`[ODCSService] Using SDK ${methodName} method for export`);
              return await (sdk as any)[methodName](workspace);
            }
          }

          // Try namespace access
          if ((sdk as any).odcs && typeof (sdk as any).odcs.toYAML === 'function') {
            console.log('[ODCSService] Using SDK odcs.toYAML method');
            return await (sdk as any).odcs.toYAML(workspace);
          }

          console.warn(
            '[ODCSService] SDK loaded but no export_to_odcs_yaml method found. Available methods:',
            Object.keys(sdk)
          );
        }

        // Fallback: Use basic YAML conversion for offline mode
        console.log(
          '[ODCSService] Falling back to JavaScript YAML converter (SDK export methods not available)'
        );
        return this.toYAMLFallback(workspace);
      } catch (error) {
        // If SDK loading fails, try fallback converter
        try {
          return this.toYAMLFallback(workspace);
        } catch (fallbackError) {
          throw new Error(
            `Failed to convert to ODCS YAML offline: ${error instanceof Error ? error.message : 'Unknown error'}. Fallback converter also failed: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown error'}`
          );
        }
      }
    }
  }

  /**
   * Fallback YAML parser for offline mode when WASM SDK is not available
   * Parses basic ODCS/ODCL YAML structure
   */
  private parseYAMLFallback(yamlContent: string, format: 'odcl' | 'odcs' = 'odcs'): ODCSWorkspace {
    try {
      const parsed = yaml.load(yamlContent) as any;
      console.log('[ODCSService] parseYAMLFallback - Parsed YAML:', parsed);

      // Extract tables and relationships from parsed YAML
      // ODCS format may vary, so we try common structures
      let tables: Table[] = [];
      let relationships: Relationship[] = [];

      // Extract ODCL metadata if it's ODCL format
      let odclMetadata: ReturnType<typeof this.extractODCLInfo> = {};
      if (
        format === 'odcl' ||
        (parsed && typeof parsed === 'object' && parsed.dataContractSpecification)
      ) {
        console.log('[ODCSService] parseYAMLFallback - Detected ODCL format (Data Contract)');
        odclMetadata = this.extractODCLInfo(parsed);
      }

      // Get table metadata for applying to tables
      const odclTableMetadata = odclMetadata.tableMetadata;

      // Check if this is a Data Contract format (ODCL or ODCS 3.1.0)
      if (parsed && typeof parsed === 'object' && parsed.dataContractSpecification) {
        console.log('[ODCSService] parseYAMLFallback - Detected Data Contract format (ODCL)');

        // Data Contract format: look for models.entities or models.tables
        if (parsed.models && typeof parsed.models === 'object') {
          // Check for entities array in models
          if (parsed.models.entities && Array.isArray(parsed.models.entities)) {
            console.log(
              `[ODCSService] parseYAMLFallback - Found 'models.entities' array with ${parsed.models.entities.length} items`
            );
            tables = parsed.models.entities.map((item: any, index: number) =>
              this.normalizeTable(item, index, odclTableMetadata, odclMetadata)
            );
          } else if (parsed.models.tables && Array.isArray(parsed.models.tables)) {
            console.log(
              `[ODCSService] parseYAMLFallback - Found 'models.tables' array with ${parsed.models.tables.length} items`
            );
            tables = parsed.models.tables.map((item: any, index: number) =>
              this.normalizeTable(item, index, odclTableMetadata, odclMetadata)
            );
          } else {
            // Try to find entities/tables in nested structures
            const modelsKeys = Object.keys(parsed.models);
            console.log(`[ODCSService] parseYAMLFallback - Models keys: ${modelsKeys.join(', ')}`);

            // Look for entities/tables in nested model objects (e.g., models.Order.entities)
            for (const key of modelsKeys) {
              const modelObj = parsed.models[key];
              if (modelObj && typeof modelObj === 'object') {
                // Check if this model object has entities/tables arrays
                if (Array.isArray(modelObj.entities)) {
                  console.log(
                    `[ODCSService] parseYAMLFallback - Found 'models.${key}.entities' array with ${modelObj.entities.length} items`
                  );
                  tables = modelObj.entities.map((item: any, index: number) =>
                    this.normalizeTable(item, index, odclTableMetadata, odclMetadata)
                  );
                  break;
                } else if (Array.isArray(modelObj.tables)) {
                  console.log(
                    `[ODCSService] parseYAMLFallback - Found 'models.${key}.tables' array with ${modelObj.tables.length} items`
                  );
                  tables = modelObj.tables.map((item: any, index: number) =>
                    this.normalizeTable(item, index, odclTableMetadata, odclMetadata)
                  );
                  break;
                } else if (Array.isArray(modelObj)) {
                  // The model object itself might be an array of entities
                  console.log(
                    `[ODCSService] parseYAMLFallback - Found array in models.${key} with ${modelObj.length} items`
                  );
                  const firstItem = modelObj[0];
                  if (
                    firstItem &&
                    typeof firstItem === 'object' &&
                    (firstItem.name || firstItem.entity_name || firstItem.table_name)
                  ) {
                    tables = modelObj.map((item: any, index: number) =>
                      this.normalizeTable(item, index, odclTableMetadata, odclMetadata)
                    );
                    break;
                  }
                } else {
                  // Check nested properties for entities/tables
                  const nestedKeys = Object.keys(modelObj);
                  for (const nestedKey of nestedKeys) {
                    if (Array.isArray(modelObj[nestedKey])) {
                      const firstItem = modelObj[nestedKey][0];
                      if (
                        firstItem &&
                        typeof firstItem === 'object' &&
                        (firstItem.name ||
                          firstItem.entity_name ||
                          firstItem.table_name ||
                          firstItem.id)
                      ) {
                        console.log(
                          `[ODCSService] parseYAMLFallback - Found array in models.${key}.${nestedKey} with ${modelObj[nestedKey].length} items`
                        );
                        tables = modelObj[nestedKey].map((item: any, index: number) =>
                          this.normalizeTable(item, index, odclTableMetadata, odclMetadata)
                        );
                        break;
                      }
                    }
                  }
                  if (tables.length > 0) break;
                }
              } else if (Array.isArray(modelObj)) {
                // Direct array in models
                console.log(
                  `[ODCSService] parseYAMLFallback - Found array in models.${key} with ${modelObj.length} items`
                );
                const firstItem = modelObj[0];
                if (
                  firstItem &&
                  typeof firstItem === 'object' &&
                  (firstItem.name || firstItem.entity_name || firstItem.table_name)
                ) {
                  tables = modelObj.map((item: any, index: number) =>
                    this.normalizeTable(item, index, odclTableMetadata, odclMetadata)
                  );
                  break;
                }
              }
            }
          }

          // Look for relationships in models
          if (parsed.models.relationships && Array.isArray(parsed.models.relationships)) {
            console.log(
              `[ODCSService] parseYAMLFallback - Found 'models.relationships' array with ${parsed.models.relationships.length} items`
            );
            relationships = parsed.models.relationships.map((item: any, index: number) =>
              this.normalizeRelationship(item, index)
            );
          }
        }

        // Extract workspace/domain info from Data Contract
        // Use ODCL metadata if available, otherwise fall back to parsed values
        const workspaceId =
          odclMetadata.workspace_id || parsed.workspace_id || parsed.id || undefined;
        const domainId = odclMetadata.domain_id || parsed.domain_id || undefined;

        return {
          workspace_id: workspaceId,
          domain_id: domainId,
          tables,
          relationships: relationships.length > 0 ? relationships : undefined,
          data_flow_diagrams: parsed.data_flow_diagrams || [],
          ...odclMetadata,
        };
      }

      // Handle different YAML structures (legacy formats)
      if (Array.isArray(parsed)) {
        // If it's an array, assume it's an array of tables
        console.log(
          `[ODCSService] parseYAMLFallback - Parsed as array of tables, found ${parsed.length} tables.`
        );
        tables = parsed.map((item: any, index: number) =>
          this.normalizeTable(item, index, odclTableMetadata, odclMetadata)
        );
      } else if (parsed && typeof parsed === 'object') {
        // If it's an object, look for tables and relationships properties
        if (parsed.tables && Array.isArray(parsed.tables)) {
          console.log(
            `[ODCSService] parseYAMLFallback - Found 'tables' array, found ${parsed.tables.length} tables.`
          );
          tables = parsed.tables.map((item: any, index: number) =>
            this.normalizeTable(item, index, odclTableMetadata, odclMetadata)
          );
        } else if (parsed.entities && Array.isArray(parsed.entities)) {
          // Alternative: entities property
          console.log(
            `[ODCSService] parseYAMLFallback - Found 'entities' array, found ${parsed.entities.length} tables.`
          );
          tables = parsed.entities.map((item: any, index: number) =>
            this.normalizeTable(item, index, odclTableMetadata, odclMetadata)
          );
        } else {
          // Try to parse as a single table if it's an object
          const singleTable = this.normalizeTable(parsed, 0, odclTableMetadata, odclMetadata);
          if (singleTable.name && singleTable.name !== `Table_1`) {
            // Heuristic to avoid adding empty default table
            tables = [singleTable];
            console.log(
              `[ODCSService] parseYAMLFallback - Parsed as single table: ${singleTable.name}`
            );
          } else {
            console.warn(
              '[ODCSService] parseYAMLFallback - No tables or entities array found, and single object does not look like a table.'
            );
          }
        }

        if (parsed.relationships && Array.isArray(parsed.relationships)) {
          relationships = parsed.relationships.map((item: any, index: number) =>
            this.normalizeRelationship(item, index)
          );
          console.log(
            `[ODCSService] parseYAMLFallback - Found 'relationships' array, found ${relationships.length} relationships.`
          );
        }

        if (parsed.data_flow_diagrams && Array.isArray(parsed.data_flow_diagrams)) {
          console.log(
            `[ODCSService] parseYAMLFallback - Found 'data_flow_diagrams' array, found ${parsed.data_flow_diagrams.length} diagrams.`
          );
          return {
            workspace_id: parsed.workspace_id,
            domain_id: parsed.domain_id,
            tables,
            relationships: relationships.length > 0 ? relationships : undefined,
            data_flow_diagrams: parsed.data_flow_diagrams,
          };
        }
      }

      const result = {
        workspace_id: parsed.workspace_id,
        domain_id: parsed.domain_id,
        tables,
        relationships: relationships.length > 0 ? relationships : undefined,
        data_flow_diagrams: [],
      };

      console.log('[ODCSService] parseYAMLFallback - Parsed workspace result:', result);
      console.log(
        '[ODCSService] parseYAMLFallback - Tables:',
        tables.map((t) => ({ name: t.name, columnsCount: t.columns.length }))
      );

      return result;
    } catch (error) {
      console.error('[ODCSService] parseYAMLFallback - Error parsing YAML:', error);
      throw new Error(
        `Failed to parse YAML: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Extract ODCL metadata from parsed YAML
   * Returns workspace-level metadata AND table-level metadata mapping
   *
   * @deprecated SDK 1.8.4+ handles ODCL parsing natively via parse_odcl_yaml()
   * This method is only used by the fallback parser when SDK is not available
   */
  private extractODCLInfo(
    parsed: any
  ): Partial<ODCSWorkspace> & { tableMetadata?: Record<string, unknown> } {
    const info: Partial<ODCSWorkspace> & { tableMetadata?: Record<string, unknown> } = {};
    const tableMetadata: Record<string, unknown> = {};

    if (parsed.dataContractSpecification) {
      info.odcl_version = parsed.dataContractSpecification;
    }

    if (parsed.id) {
      info.odcl_id = parsed.id;
      // Try to extract workspace_id from ODCL id if it's a URN
      // e.g., "urn:datacontract:example:ecommerce_system" -> extract domain
      if (typeof parsed.id === 'string' && parsed.id.startsWith('urn:')) {
        const parts = parsed.id.split(':');
        if (parts.length >= 4) {
          // Use the domain part as workspace_id, but normalize to UUID
          const extractedWorkspaceId = parts[parts.length - 2] || parts[parts.length - 1];
          const extractedDomainId = parts[parts.length - 1];
          // Only set if they're valid UUIDs, otherwise they'll be normalized later
          if (isValidUUID(extractedWorkspaceId)) {
            info.workspace_id = extractedWorkspaceId;
          }
          if (isValidUUID(extractedDomainId)) {
            info.domain_id = extractedDomainId;
          }
        }
      }
      // Note: Non-URN IDs (like "gst" or "global_betting_system") are not valid UUIDs
      // They will be normalized when tables are imported using the current workspace/domain IDs
    }

    if (parsed.info && typeof parsed.info === 'object') {
      info.odcl_info = {
        title: parsed.info.title,
        version: parsed.info.version,
        description: parsed.info.description,
        owner: parsed.info.owner,
        contact: parsed.info.contact,
        status: parsed.info.status,
        ...parsed.info,
      };

      // Map info fields to table metadata
      if (parsed.info.title) {
        // Title could be used as table name or alias - we'll use it as alias if name exists
        tableMetadata.odcl_title = parsed.info.title;
      }
      if (parsed.info.version) {
        tableMetadata.version = parsed.info.version;
      }
      if (parsed.info.status) {
        tableMetadata.status = parsed.info.status;
      }

      // Extract owner information from ODCL info
      if (parsed.info.owner) {
        // Owner might be a string (team name) or object
        if (typeof parsed.info.owner === 'string') {
          tableMetadata.odcl_owner_team = parsed.info.owner;
        } else if (typeof parsed.info.owner === 'object') {
          tableMetadata.odcl_owner = parsed.info.owner;
        }
      }

      // Extract contact information
      if (parsed.info.contact) {
        if (typeof parsed.info.contact === 'object') {
          if (parsed.info.contact.name) {
            tableMetadata.odcl_contact_name = parsed.info.contact.name;
          }
          if (parsed.info.contact.url) {
            // Extract email from mailto: URL
            const mailtoMatch = parsed.info.contact.url.match(/^mailto:(.+)$/i);
            if (mailtoMatch) {
              tableMetadata.odcl_contact_email = mailtoMatch[1];
            } else {
              tableMetadata.odcl_contact_url = parsed.info.contact.url;
            }
          }
        }
      }
    }

    // Extract terms section
    if (parsed.terms && typeof parsed.terms === 'object') {
      if (parsed.terms.usage) {
        tableMetadata.terms_usage = parsed.terms.usage;
      }
      if (parsed.terms.limitations) {
        tableMetadata.terms_limitations = parsed.terms.limitations;
      }
      // Store full terms object for reference
      tableMetadata.terms = parsed.terms;
    }

    if (Object.keys(tableMetadata).length > 0) {
      info.tableMetadata = tableMetadata;
    }

    return info;
  }

  /**
   * TEMPORARY WORKAROUND: Merge original YAML data with SDK result to preserve fields that SDK might not return
   * This ensures fields like 'description' and 'quality' arrays are preserved
   *
   * @deprecated SDK 1.8.4+ returns complete data - no merging needed
   * This method is only used by the fallback parser when SDK is not available
   */
  // @ts-expect-error - Kept for fallback parser, marked as deprecated
  private mergeOriginalYAMLWithSDKResult(sdkResult: any, originalYAML: any): any {
    if (!originalYAML || !sdkResult) return sdkResult;

    // Extract tables from original YAML
    const originalTables = originalYAML.models?.tables || originalYAML.tables || [];
    const sdkTables = sdkResult.tables || [];

    // Merge column data from original YAML into SDK result
    const mergedTables = sdkTables.map((sdkTable: any) => {
      // Find matching table in original YAML by name
      const originalTable = originalTables.find((t: any) => {
        const sdkName = sdkTable.name || sdkTable.table_name || sdkTable.entity_name;
        const origName = t.name || t.table_name || t.entity_name;
        return sdkName === origName;
      });

      if (!originalTable) return sdkTable;

      // Extract columns from original table (could be object or array)
      let originalColumns: any[] = [];
      if (Array.isArray(originalTable.columns)) {
        originalColumns = originalTable.columns;
      } else if (originalTable.columns && typeof originalTable.columns === 'object') {
        originalColumns = Object.entries(originalTable.columns).map(
          ([key, value]: [string, any]) => ({
            name: key,
            ...value,
          })
        );
      }

      // Merge column data
      const mergedColumns = (sdkTable.columns || []).map((sdkCol: any) => {
        const originalCol = originalColumns.find((oc: any) => {
          const sdkColName = sdkCol.name || sdkCol.attribute_name || sdkCol.field_name;
          const origColName = oc.name || oc.attribute_name || oc.field_name;
          return sdkColName === origColName;
        });

        if (!originalCol) return sdkCol;

        // Merge: preserve SDK parsed fields but add missing fields from original
        return {
          ...sdkCol,
          // Preserve description from original if SDK doesn't have it or it's empty
          description: sdkCol.description || originalCol.description,
          // Preserve quality array from original if SDK doesn't have it
          quality: originalCol.quality || sdkCol.quality,
          // Preserve quality_rules if SDK doesn't have it
          quality_rules: sdkCol.quality_rules || originalCol.quality_rules,
          // Preserve $ref if present
          $ref: originalCol.$ref || sdkCol.$ref,
        };
      });

      return {
        ...sdkTable,
        columns: mergedColumns,
        // Also preserve table-level description if missing
        description: sdkTable.description || originalTable.description,
      };
    });

    return {
      ...sdkResult,
      tables: mergedTables,
    };
  }

  /**
   * Convert SDK import result to ODCSWorkspace format
   * SDK 1.1.0+ returns JSON string with tables/relationships structure
   * Validates that SDK parsed all ODCS attributes and raises errors for missing fields
   *
   * @deprecated SDK 1.8.4+ returns workspace structure directly - no conversion needed
   * This method is only used by the fallback parser when SDK is not available
   */
  // @ts-expect-error - Kept for fallback parser, marked as deprecated
  private convertSDKResultToWorkspace(
    sdkResult: any,
    format: 'odcl' | 'odcs' = 'odcs',
    odclTableMetadata?: Record<string, unknown>,
    odclInfo?: any
  ): ODCSWorkspace {
    try {
      // SDK may return different structures, handle common formats
      if (typeof sdkResult === 'string') {
        sdkResult = JSON.parse(sdkResult);
      }

      // Extract tables and relationships with validation
      const tables: Table[] = Array.isArray(sdkResult.tables)
        ? sdkResult.tables.map((item: any, index: number) => {
            const normalized = this.normalizeTable(item, index, odclTableMetadata, odclInfo);

            // Validate that SDK parsed all expected ODCS fields
            this.validateTableCompleteness(item, normalized, index);

            return normalized;
          })
        : [];

      const relationships: Relationship[] = Array.isArray(sdkResult.relationships)
        ? sdkResult.relationships.map((item: any, index: number) =>
            this.normalizeRelationship(item, index)
          )
        : [];

      // Extract workspace_id and domain_id from SDK result or use defaults
      // SDK may not return these for ODCL format, so we'll extract from original if needed
      const workspaceId = sdkResult.workspace_id;
      const domainId = sdkResult.domain_id;

      // For ODCL format, workspace_id and domain_id might not be in SDK result
      // They should be extracted from the ODCL id field
      if (format === 'odcl' && (!workspaceId || !domainId)) {
        // These will be set by extractODCLInfo if available
        console.log(
          '[ODCSService] ODCL format detected - workspace_id and domain_id will be extracted from ODCL id'
        );
      }

      // Validate that SDK returned tables
      if (!Array.isArray(sdkResult.tables)) {
        const errorMsg = `[ODCSService] SDK result missing 'tables' array`;
        console.error(errorMsg);
        throw new Error(errorMsg);
      }

      return {
        workspace_id: workspaceId,
        domain_id: domainId,
        tables,
        relationships: relationships.length > 0 ? relationships : undefined,
        data_flow_diagrams: sdkResult.data_flow_diagrams || [],
      };
    } catch (error) {
      console.error('[ODCSService] Error converting SDK result:', error);
      throw new Error(
        `Failed to convert SDK result: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Validate that a table has all expected ODCS fields parsed
   * Raises errors if critical fields are missing
   *
   * @deprecated SDK 1.8.4+ handles validation internally
   * This method is only used by the fallback parser when SDK is not available
   */
  private validateTableCompleteness(
    originalItem: any,
    normalizedTable: Table,
    index: number
  ): void {
    const originalFields = new Set(Object.keys(originalItem || {}));
    const missingFields: string[] = [];

    // Critical fields that must be present (even if empty)
    const criticalFields = ['name'];
    criticalFields.forEach((field) => {
      if (!normalizedTable[field as keyof Table] && !originalFields.has(field)) {
        missingFields.push(field);
      }
    });

    // Check if quality rules were loaded for columns
    const columnsWithMissingQualityRules: string[] = [];
    normalizedTable.columns.forEach((col, colIndex) => {
      const originalCol =
        originalItem.columns?.[colIndex] ||
        originalItem.attributes?.[colIndex] ||
        originalItem.fields?.[colIndex];
      if (originalCol) {
        // Check if original column had quality rules that weren't loaded
        const originalColFields = new Set(Object.keys(originalCol));
        const hasQualityRulesInOriginal =
          originalColFields.has('quality_rules') ||
          originalColFields.has('qualityRules') ||
          originalColFields.has('constraints') ||
          (originalCol.constraints && Object.keys(originalCol.constraints).length > 0);

        const hasQualityRulesInNormalized =
          (col.constraints && Object.keys(col.constraints).length > 0) ||
          (col.quality_rules && Object.keys(col.quality_rules).length > 0);

        if (hasQualityRulesInOriginal && !hasQualityRulesInNormalized) {
          columnsWithMissingQualityRules.push(col.name || `column_${colIndex}`);
        }
      }
    });

    if (missingFields.length > 0) {
      const errorMsg = `[ODCSService] SDK failed to parse critical fields for table ${normalizedTable.name} (index ${index}): ${missingFields.join(', ')}`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    if (columnsWithMissingQualityRules.length > 0) {
      const errorMsg = `[ODCSService] SDK failed to parse quality rules for columns in table ${normalizedTable.name}: ${columnsWithMissingQualityRules.join(', ')}`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    // Check if table-level quality rules were loaded
    const originalHasQualityRules =
      originalItem.quality_rules ||
      originalItem.qualityRules ||
      (originalItem.metadata && originalItem.metadata.quality_rules);

    const normalizedHasQualityRules =
      normalizedTable.quality_rules ||
      (normalizedTable.metadata && normalizedTable.metadata.quality_rules);

    if (originalHasQualityRules && !normalizedHasQualityRules) {
      const errorMsg = `[ODCSService] SDK failed to parse table-level quality rules for table ${normalizedTable.name}`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    // Check if owner/SLA were loaded
    if (originalItem.owner && !normalizedTable.owner) {
      console.warn(
        `[ODCSService] SDK may not have parsed owner information for table ${normalizedTable.name}`
      );
    }

    if (originalItem.sla && !normalizedTable.sla) {
      console.warn(
        `[ODCSService] SDK may not have parsed SLA information for table ${normalizedTable.name}`
      );
    }
  }

  /**
   * Apply ODCL metadata to a table
   *
   * @deprecated SDK 1.8.4+ applies ODCL metadata automatically via parse_odcl_yaml()
   * This method is only used by the fallback parser when SDK is not available
   */
  // @ts-expect-error - Kept for fallback parser, marked as deprecated
  private applyODCLMetadataToTable(table: Table, odclMetadata: Record<string, unknown>): Table {
    const updates: Partial<Table> = {};

    // Map ODCL metadata to table fields
    if (odclMetadata.odcl_title && !table.alias) {
      updates.alias = odclMetadata.odcl_title as string;
    }

    // Build owner object from ODCL info
    const owner: Table['owner'] = table.owner || {};
    if (odclMetadata.odcl_owner_team) {
      owner.team = odclMetadata.odcl_owner_team as string;
    }
    if (odclMetadata.odcl_contact_name) {
      owner.name = odclMetadata.odcl_contact_name as string;
    }
    if (odclMetadata.odcl_contact_email) {
      owner.email = odclMetadata.odcl_contact_email as string;
    }
    if (Object.keys(owner).length > 0) {
      updates.owner = owner;
    }

    // Build metadata object
    const metadata: Record<string, unknown> = { ...table.metadata };
    if (odclMetadata.version) {
      metadata.version = odclMetadata.version;
    }
    if (odclMetadata.status) {
      metadata.status = odclMetadata.status;
    }
    if (odclMetadata.terms_usage) {
      metadata.terms_usage = odclMetadata.terms_usage;
    }
    if (odclMetadata.terms_limitations) {
      metadata.terms_limitations = odclMetadata.terms_limitations;
    }
    if (odclMetadata.terms) {
      metadata.terms = odclMetadata.terms;
    }
    if (Object.keys(metadata).length > 0) {
      updates.metadata = metadata;
    }

    return { ...table, ...updates };
  }

  /**
   * Normalize a table object from YAML to Table type
   * Loads ALL ODCS 3.1.0 fields and validates completeness
   */
  private normalizeTable(
    item: any,
    index: number,
    odclTableMetadata?: Record<string, unknown>,
    odclInfo?: any
  ): Table {
    const now = new Date().toISOString();
    // Always generate proper UUID for table ID
    const tableId = item.id && isValidUUID(item.id) ? item.id : generateUUID();
    if (item.id && !isValidUUID(item.id)) {
      console.warn(
        `[ODCSService] Invalid table ID format "${item.id}", generated new UUID: ${tableId}`
      );
    }

    // Track all fields found in the source item for validation
    const sourceFields = new Set(Object.keys(item));
    const expectedFields = [
      'id',
      'name',
      'alias',
      'description',
      'tags',
      'model_type',
      'columns',
      'attributes',
      'fields',
      'owner',
      'sla',
      'metadata',
      'quality_rules',
      'position_x',
      'position_y',
      'width',
      'height',
      'workspace_id',
      'primary_domain_id',
      'domain_id',
      'created_at',
      'last_modified_at',
      // ODCS v3.x standard fields
      'tableIndex',
      'apiVersion',
      'version',
      'status',
      'kind',
      'odcsMetadata',
      'customProperties',
      // Additional ODCS fields
      'roles',
      'support',
      'pricing',
      'price',
      'team',
      'stakeholders',
      'quality_tier',
      'data_modeling_method',
      'info',
      'qualityRules',
      'table_name',
      'entity_name',
      'label',
      'title',
      'x',
      'y',
    ];

    // Try multiple possible name fields (ODCS format variations)
    const tableName = (
      item.name ||
      item.table_name ||
      item.entity_name ||
      item.label ||
      item.title ||
      `Table_${index + 1}`
    ).trim();
    console.log(`[ODCSService] normalizeTable - Resolving name for item ${index}: '${tableName}'`);

    let columns: Column[] = [];
    if (Array.isArray(item.columns)) {
      columns = item.columns;
      console.log(
        `[ODCSService] normalizeTable - Found 'columns' array with ${columns.length} items.`
      );
    } else if (Array.isArray(item.properties)) {
      // ODCS schema uses 'properties' for columns
      columns = item.properties;
      console.log(
        `[ODCSService] normalizeTable - Found 'properties' array with ${columns.length} items.`
      );
    } else if (Array.isArray(item.attributes)) {
      columns = item.attributes;
      console.log(
        `[ODCSService] normalizeTable - Found 'attributes' array with ${columns.length} items.`
      );
    } else if (Array.isArray(item.fields)) {
      columns = item.fields;
      console.log(
        `[ODCSService] normalizeTable - Found 'fields' array with ${columns.length} items.`
      );
    } else if (item.columns && typeof item.columns === 'object') {
      columns = Object.entries(item.columns).map(([key, value]: [string, any]) => ({
        name: key,
        ...value,
      }));
      console.log(
        `[ODCSService] normalizeTable - Converted 'columns' object to array with ${columns.length} items.`
      );
    } else {
      console.warn(
        `[ODCSService] normalizeTable - No columns found for table '${tableName}' (ID: ${tableId}), item:`,
        item
      );
    }

    // Extract owner information
    let owner = item.owner
      ? {
          name: item.owner.name || item.owner.owner_name,
          email: item.owner.email || item.owner.owner_email,
          team: item.owner.team || item.owner.owner_team,
          role: item.owner.role || item.owner.owner_role,
        }
      : undefined;

    // Extract SLA information
    const sla = item.sla
      ? {
          latency: item.sla.latency,
          uptime: item.sla.uptime,
          response_time: item.sla.response_time,
          error_rate: item.sla.error_rate,
          update_frequency: item.sla.update_frequency,
        }
      : undefined;

    // Extract Support channels (ODCS v3.0.2)
    const support = Array.isArray(item.support)
      ? item.support
          .map((ch: any) => ({
            channel: ch.channel || '',
            url: ch.url || '',
            description: ch.description,
            tool: ch.tool,
            scope: ch.scope,
            invitationUrl: ch.invitationUrl || ch.invitation_url,
          }))
          .filter((ch: any) => ch.channel && ch.url)
      : undefined;

    // Extract Pricing (ODCS v3.0.2)
    const pricing =
      item.pricing || item.price
        ? {
            priceAmount:
              item.pricing?.priceAmount ??
              item.price?.priceAmount ??
              item.pricing?.price_amount ??
              item.price?.price_amount,
            priceCurrency:
              item.pricing?.priceCurrency ??
              item.price?.priceCurrency ??
              item.pricing?.price_currency ??
              item.price?.price_currency,
            priceUnit:
              item.pricing?.priceUnit ??
              item.price?.priceUnit ??
              item.pricing?.price_unit ??
              item.price?.price_unit,
          }
        : undefined;

    // Extract Team (ODCS v3.0.2, formerly stakeholders in v2.x)
    const team = Array.isArray(item.team)
      ? item.team.map((member: any) => ({
          username: member.username,
          role: member.role,
          dateIn: member.dateIn || member.date_in,
          dateOut: member.dateOut || member.date_out,
          replacedByUsername: member.replacedByUsername || member.replaced_by_username,
          comment: member.comment,
          name: member.name,
        }))
      : Array.isArray(item.stakeholders)
        ? item.stakeholders.map((member: any) => ({
            username: member.username,
            role: member.role,
            dateIn: member.dateIn || member.date_in,
            dateOut: member.dateOut || member.date_out,
            replacedByUsername: member.replacedByUsername || member.replaced_by_username,
            comment: member.comment,
            name: member.name,
          }))
        : undefined;

    // Extract metadata (including quality_tier and data_modeling_method)
    const metadata: Record<string, unknown> = {};
    if (item.metadata && typeof item.metadata === 'object') {
      Object.assign(metadata, item.metadata);
    }
    // Also check for quality_tier and data_modeling_method at top level
    if (item.quality_tier) metadata.quality_tier = item.quality_tier;
    if (item.data_modeling_method) metadata.data_modeling_method = item.data_modeling_method;

    // Map ODCS v3.x standard fields to metadata
    if (item.tableIndex !== undefined) metadata.tableIndex = item.tableIndex;
    if (item.apiVersion) metadata.apiVersion = item.apiVersion;
    if (item.version) metadata.version = item.version;
    if (item.status) metadata.status = item.status;
    if (item.kind) metadata.kind = item.kind;
    if (item.odcsMetadata && typeof item.odcsMetadata === 'object') {
      metadata.odcsMetadata = item.odcsMetadata;
    }

    // Convert customProperties array to metadata object (ODCS v3.1.0 format)
    // customProperties: [{ property: "system_id", value: "js-system-duckdb" }]
    // Also store the raw customProperties for reference
    if (item.customProperties && Array.isArray(item.customProperties)) {
      metadata.customProperties = item.customProperties;
      for (const prop of item.customProperties) {
        if (prop.property && prop.value !== undefined) {
          metadata[prop.property] = prop.value;
        }
      }
    }

    // Apply ODCL table-level metadata if provided
    // IMPORTANT: In ODCS format, description can be an object like { purpose: "..." }
    // We need to extract the string value to avoid React error #31
    let finalDescription: string | undefined;
    if (typeof item.description === 'string') {
      finalDescription = item.description;
    } else if (item.description && typeof item.description === 'object') {
      // Extract purpose field from ODCS description object
      finalDescription = item.description.purpose || JSON.stringify(item.description);
    } else if (item.info?.description) {
      finalDescription =
        typeof item.info.description === 'string'
          ? item.info.description
          : item.info.description?.purpose || JSON.stringify(item.info.description);
    }
    if (odclTableMetadata) {
      // Map ODCL info fields
      if (odclTableMetadata.odcl_title && !item.alias) {
        // Use title as alias if no alias exists
      }
      // Use ODCL info.description if table doesn't have its own description
      if (!finalDescription && odclInfo?.odcl_info?.description) {
        const odclDesc = odclInfo.odcl_info.description;
        finalDescription =
          typeof odclDesc === 'string' ? odclDesc : odclDesc?.purpose || JSON.stringify(odclDesc);
      }
      if (odclTableMetadata.version) {
        metadata.version = odclTableMetadata.version;
      }
      if (odclTableMetadata.status) {
        metadata.status = odclTableMetadata.status;
      }

      // Map ODCL owner fields to owner object
      if (odclTableMetadata.odcl_owner_team && !owner) {
        owner = {
          name: undefined,
          email: undefined,
          team: odclTableMetadata.odcl_owner_team as string,
          role: undefined,
        };
      } else if (odclTableMetadata.odcl_owner_team && owner) {
        owner.team = odclTableMetadata.odcl_owner_team as string;
      }
      if (odclTableMetadata.odcl_contact_name) {
        if (!owner) {
          owner = {
            name: odclTableMetadata.odcl_contact_name as string,
            email: undefined,
            team: undefined,
            role: undefined,
          };
        } else {
          owner.name = odclTableMetadata.odcl_contact_name as string;
        }
      }
      if (odclTableMetadata.odcl_contact_email) {
        if (!owner) {
          owner = {
            name: undefined,
            email: odclTableMetadata.odcl_contact_email as string,
            team: undefined,
            role: undefined,
          };
        } else {
          owner.email = odclTableMetadata.odcl_contact_email as string;
        }
      }

      // Map terms fields
      if (odclTableMetadata.terms_usage) {
        metadata.terms_usage = odclTableMetadata.terms_usage;
      }
      if (odclTableMetadata.terms_limitations) {
        metadata.terms_limitations = odclTableMetadata.terms_limitations;
      }
      if (odclTableMetadata.terms) {
        metadata.terms = odclTableMetadata.terms;
      }
    }

    // Extract quality rules
    const qualityRules = item.quality_rules || item.qualityRules || undefined;

    // Extract tags from multiple possible locations
    let tableTags = item.tags;
    if (!tableTags && item.info && item.info.tags) {
      tableTags = item.info.tags;
    }
    if (!tableTags && item.metadata && item.metadata.tags) {
      tableTags = item.metadata.tags;
    }

    // Extract data_level from dm_level tag (e.g., "dm_level:Gold" -> "gold")
    let dataLevel: 'operational' | 'bronze' | 'silver' | 'gold' | undefined;
    if (tableTags && Array.isArray(tableTags)) {
      for (const tag of tableTags) {
        if (typeof tag === 'string' && tag.toLowerCase().startsWith('dm_level:')) {
          const levelValue = tag.substring('dm_level:'.length).toLowerCase();
          if (['operational', 'bronze', 'silver', 'gold'].includes(levelValue)) {
            dataLevel = levelValue as 'operational' | 'bronze' | 'silver' | 'gold';
          }
          break;
        }
        // Also handle object tag format { key: 'dm_level', value: 'Gold' }
        if (typeof tag === 'object' && tag !== null && 'key' in tag && tag.key === 'dm_level') {
          const levelValue = String(tag.value || '').toLowerCase();
          if (['operational', 'bronze', 'silver', 'gold'].includes(levelValue)) {
            dataLevel = levelValue as 'operational' | 'bronze' | 'silver' | 'gold';
          }
          break;
        }
      }
    }
    // Fallback: check customProperties for data_level (legacy support)
    if (!dataLevel && item.customProperties && Array.isArray(item.customProperties)) {
      const dataLevelProp = item.customProperties.find(
        (p: any) => p.property === 'data_level' || p.property === 'dataLevel'
      );
      if (dataLevelProp) {
        const levelValue = String(dataLevelProp.value || '').toLowerCase();
        if (['operational', 'bronze', 'silver', 'gold'].includes(levelValue)) {
          dataLevel = levelValue as 'operational' | 'bronze' | 'silver' | 'gold';
        }
      }
    }

    // Normalize columns with ALL quality rules
    const normalizedColumns = columns.map((col: any, colIndex: number) => {
      const colConstraints: Record<string, unknown> = {};

      // Copy all constraint fields
      if (col.constraints && typeof col.constraints === 'object') {
        Object.assign(colConstraints, col.constraints);
      }

      // Extract quality rules from column - handle both 'quality' array (ODCL) and 'quality_rules' object
      const colQualityRules = col.quality_rules || col.qualityRules;
      if (colQualityRules && typeof colQualityRules === 'object') {
        Object.assign(colConstraints, colQualityRules);
      }

      // Handle 'quality' array format (ODCL) - extract value_set from implementation.kwargs.value_set
      if (col.quality && Array.isArray(col.quality)) {
        console.log(
          `[ODCSService] Found quality array for column ${col.name || colIndex}:`,
          col.quality
        );
        col.quality.forEach((qualityRule: any) => {
          if (qualityRule.implementation && qualityRule.implementation.kwargs) {
            // Extract value_set from great-expectations format
            if (
              qualityRule.implementation.kwargs.value_set &&
              Array.isArray(qualityRule.implementation.kwargs.value_set)
            ) {
              colConstraints.validValues = qualityRule.implementation.kwargs.value_set;
              console.log(
                `[ODCSService] Extracted validValues from quality rule:`,
                colConstraints.validValues
              );
            }
            // Extract other kwargs fields
            Object.keys(qualityRule.implementation.kwargs).forEach((key) => {
              if (key !== 'value_set') {
                colConstraints[`quality_${key}`] = qualityRule.implementation.kwargs[key];
              }
            });
          }
          // Store the full quality rule structure for reference
          if (qualityRule.type) {
            colConstraints[`quality_type_${qualityRule.type}`] = qualityRule;
          }
        });
      }

      // Extract individual quality rule fields
      if (col.minLength !== undefined) colConstraints.minLength = col.minLength;
      if (col.maxLength !== undefined) colConstraints.maxLength = col.maxLength;
      if (col.pattern !== undefined) colConstraints.pattern = col.pattern;
      if (col.format !== undefined) colConstraints.format = col.format;
      if (col.minimum !== undefined) colConstraints.minimum = col.minimum;
      if (col.maximum !== undefined) colConstraints.maximum = col.maximum;
      if (col.validValues !== undefined || col.valid_values !== undefined) {
        colConstraints.validValues = col.validValues || col.valid_values;
      }
      if (col.description !== undefined) colConstraints.description = col.description;

      // Extract type information (ODCL may use 'type' instead of 'data_type')
      // Also check for $ref which might indicate a type reference
      let columnDataType = col.data_type || col.type || col.dataType;
      if (!columnDataType && col.$ref) {
        // Extract type from $ref if it's a simple reference
        const refMatch = col.$ref.match(/#\/definitions\/(.+)/);
        if (refMatch) {
          columnDataType = refMatch[1].toUpperCase();
        }
      }
      columnDataType = columnDataType || 'VARCHAR';

      // Extract nullable/required (ODCL may use 'required' instead of 'nullable')
      // If 'required' is true, then nullable is false (and vice versa)
      const columnNullable =
        col.nullable !== undefined
          ? col.nullable
          : col.required === false
            ? true
            : col.required === true
              ? false
              : true;

      // Store the full quality array if present (for reference and export)
      const qualityArray = col.quality && Array.isArray(col.quality) ? col.quality : undefined;

      // Log column details for debugging
      console.log(`[ODCSService] Normalizing column ${col.name || colIndex}:`, {
        description: col.description,
        quality: col.quality,
        qualityArray,
        validValues: colConstraints.validValues,
        required: col.required,
        nullable: columnNullable,
      });

      // Generate proper UUID for column if missing or invalid
      const columnId = col.id && isValidUUID(col.id) ? col.id : generateUUID();
      if (col.id && !isValidUUID(col.id)) {
        console.warn(
          `[ODCSService] Invalid column ID format "${col.id}", generated new UUID: ${columnId}`
        );
      }

      return {
        id: columnId,
        table_id: tableId,
        name:
          col.name ||
          col.attribute_name ||
          col.field_name ||
          col.property ||
          `column_${colIndex + 1}`,
        data_type: columnDataType,
        nullable: columnNullable,
        is_primary_key:
          col.is_primary_key ?? col.primary_key ?? col.isPrimaryKey ?? col.primaryKey ?? false,
        is_foreign_key:
          col.is_foreign_key ?? col.foreign_key ?? col.isForeignKey ?? col.foreignKey ?? false,
        foreign_key_reference:
          col.foreign_key_reference || col.foreign_key || col.reference || col.foreignKeyReference,
        default_value: col.default_value || col.default || col.defaultValue,
        description:
          col.description || col.desc || (colConstraints.description as string) || undefined,
        constraints: Object.keys(colConstraints).length > 0 ? colConstraints : undefined,
        quality_rules: qualityArray || colQualityRules, // Store quality array if present, otherwise use quality_rules object
        quality: qualityArray, // Preserve raw quality array for UI components
        order: col.order ?? colIndex,
        created_at: col.created_at || col.createdAt || now,
      };
    });

    // Log normalized columns for debugging
    normalizedColumns.forEach((col, idx) => {
      if (idx < 3) {
        // Log first 3 columns for debugging
        console.log(`[ODCSService] Normalized column ${idx} (${col.name}):`, {
          description: col.description,
          quality_rules: col.quality_rules,
          constraints: col.constraints,
          validValues: col.constraints?.validValues,
          hasConstraints: !!col.constraints,
          constraintKeys: col.constraints ? Object.keys(col.constraints) : [],
        });
      }
    });

    // Validate that we've loaded all expected fields
    const missingFields: string[] = [];
    const criticalFields = ['name'];
    criticalFields.forEach((field) => {
      if (!item[field] && !sourceFields.has(field)) {
        missingFields.push(field);
      }
    });

    if (missingFields.length > 0) {
      const errorMsg = `[ODCSService] Missing critical fields in table ${tableName} (index ${index}): ${missingFields.join(', ')}`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    // Log any unexpected fields for debugging
    const unexpectedFields = Array.from(sourceFields).filter(
      (f) => !expectedFields.includes(f) && !f.startsWith('_')
    );
    if (unexpectedFields.length > 0) {
      console.warn(
        `[ODCSService] Unexpected fields in table ${tableName}: ${unexpectedFields.join(', ')}`
      );
    }

    // Apply ODCL title as alias if no alias exists
    let finalAlias = item.alias;
    if (!finalAlias && odclTableMetadata?.odcl_title) {
      finalAlias = odclTableMetadata.odcl_title as string;
    }

    return {
      id: tableId,
      workspace_id: item.workspace_id || '',
      // Don't default to empty string - leave undefined if missing so it can be set during import
      primary_domain_id: item.primary_domain_id || item.domain_id || undefined,
      name: tableName,
      alias: finalAlias,
      description: finalDescription,
      tags: tableTags || item.tags,
      model_type: item.model_type || 'conceptual',
      columns: normalizedColumns,
      position_x: item.position_x ?? item.x ?? 0,
      position_y: item.position_y ?? item.y ?? 0,
      width: item.width ?? 200,
      height: item.height ?? 150,
      visible_domains: item.visible_domains || [item.primary_domain_id || item.domain_id || ''],
      data_level: dataLevel, // Extracted from dm_level tag
      owner,
      roles: Array.isArray(item.roles) ? item.roles : undefined,
      support,
      pricing:
        pricing && (pricing.priceAmount !== undefined || pricing.priceCurrency || pricing.priceUnit)
          ? pricing
          : undefined,
      team,
      sla,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      quality_rules: qualityRules,
      is_owned_by_domain: true, // Default to true for imported tables
      // Load compound keys (composite primary/unique keys) from YAML
      compoundKeys: this.normalizeCompoundKeys(item, tableId, now),
      created_at: item.created_at || now,
      last_modified_at: item.last_modified_at || now,
    };
  }

  /**
   * Normalize compound keys from YAML to CompoundKey[] type
   */
  private normalizeCompoundKeys(item: any, tableId: string, now: string): any[] | undefined {
    const rawKeys = item.compoundKeys || item.compound_keys;
    if (!Array.isArray(rawKeys) || rawKeys.length === 0) {
      return undefined;
    }

    return rawKeys.map((ck: any) => ({
      id: ck.id || generateUUID(),
      table_id: ck.tableId || ck.table_id || tableId,
      column_ids: ck.columnIds || ck.column_ids || [],
      is_primary: ck.isPrimary ?? ck.is_primary ?? false,
      created_at: ck.createdAt || ck.created_at || now,
      ...(ck.name && { name: ck.name }),
    }));
  }

  /**
   * Normalize a relationship object from YAML to Relationship type
   */
  private normalizeRelationship(item: any, _index: number): Relationship {
    const now = new Date().toISOString();

    // Convert relationship type string to RelationshipType
    let relationshipType: 'one-to-one' | 'one-to-many' | 'many-to-many' = 'one-to-many';
    const typeStr = (item.relationship_type || item.type || 'one-to-many').toLowerCase();
    if (typeStr.includes('one-to-one') || typeStr === '1:1') {
      relationshipType = 'one-to-one';
    } else if (typeStr.includes('many-to-many') || typeStr === 'n:n' || typeStr === 'm:m') {
      relationshipType = 'many-to-many';
    }

    // Convert cardinality to Cardinality type ('0', '1', 'N')
    const convertCardinality = (val: any): '0' | '1' | 'N' => {
      if (val === '0' || val === 0 || val === 'optional') return '0';
      if (val === '1' || val === 1 || val === 'one' || val === 'required') return '1';
      return 'N';
    };

    const sourceId =
      item.source_table_id || item.source_id || item.from_table_id || item.source || '';
    const targetId =
      item.target_table_id || item.target_id || item.to_table_id || item.target || '';
    const sourceType = item.source_type || (sourceId ? 'table' : 'table');
    const targetType = item.target_type || (targetId ? 'table' : 'table');

    // Always generate proper UUID for relationship ID
    const relationshipId = item.id && isValidUUID(item.id) ? item.id : generateUUID();
    if (item.id && !isValidUUID(item.id)) {
      console.warn(
        `[ODCSService] Invalid relationship ID format "${item.id}", generated new UUID: ${relationshipId}`
      );
    }

    const relationship: Relationship = {
      id: relationshipId,
      workspace_id:
        item.workspace_id && isValidUUID(item.workspace_id)
          ? item.workspace_id
          : item.workspace_id || '',
      domain_id:
        item.domain_id && isValidUUID(item.domain_id) ? item.domain_id : item.domain_id || '',
      source_id: sourceId,
      target_id: targetId,
      source_type: sourceType,
      target_type: targetType,
      // Legacy fields for backward compatibility
      source_table_id: sourceType === 'table' ? sourceId : undefined,
      target_table_id: targetType === 'table' ? targetId : undefined,
      type: relationshipType,
      source_cardinality: convertCardinality(
        item.source_cardinality || item.from_cardinality || item.source_optional === false
          ? '1'
          : '0'
      ),
      target_cardinality: convertCardinality(
        item.target_cardinality || item.to_cardinality || item.target_optional === false ? '1' : 'N'
      ),
      label: item.label || item.name,
      model_type: item.model_type || 'conceptual',
      is_circular: item.is_circular ?? false,
      created_at: item.created_at || now,
      last_modified_at: item.last_modified_at || now,
    };

    return relationship;
  }

  /**
   * Fallback YAML converter for offline mode when WASM SDK is not available
   * Converts workspace to ODCS v3.1.0 YAML format
   * Fallback when SDK is not available
   */
  private toYAMLFallback(workspace: ODCSWorkspace): string {
    try {
      const tables = workspace.tables || [];

      // If no tables, return minimal valid ODCS
      if (tables.length === 0) {
        const emptyContract: any = {
          apiVersion: 'v3.1.0',
          kind: 'DataContract',
          id: workspace.workspace_id || 'unknown',
          version: '1.0.0',
          status: 'draft',
        };
        return yaml.dump(emptyContract, {
          indent: 2,
          lineWidth: 120,
          noRefs: true,
          sortKeys: false,
        });
      }

      // For single table export (most common case), produce ODCS v3.1.0 format
      const table = tables[0]!;
      const yamlData: any = {
        // Required fields per ODCS v3.1.0 schema
        apiVersion: 'v3.1.0',
        kind: 'DataContract',
        id: table.id,
        version: '1.0.0',
        status: (table as any).metadata?.status || 'active',
        name: table.name,

        // Optional fields
        ...(table.description && {
          description: {
            purpose: table.description,
          },
        }),
        ...(workspace.domain_id && { domain: workspace.domain_id }),

        // Schema array with table definition
        schema: [
          {
            name: table.name,
            ...(table.description && { description: table.description }),
            logicalType: 'object',
            properties: (table.columns || []).map((col: any) => ({
              name: col.name,
              ...(col.description && { description: col.description }),
              logicalType: this.mapDataTypeToLogicalType(col.data_type),
              physicalType: col.data_type,
              required: !col.nullable,
              ...(col.is_primary_key && { primaryKey: true }),
            })),
          },
        ],

        // Custom properties for metadata (includes system_id, but NOT data_level - that's in tags as dm_level)
        ...(() => {
          const props: { property: string; value: string }[] = [];

          // Add metadata properties (includes system_id)
          if ((table as any).metadata) {
            for (const [property, value] of Object.entries((table as any).metadata)) {
              // Skip data_level - it's stored as dm_level tag instead
              if (property === 'data_level') continue;
              if (value !== undefined && value !== null) {
                props.push({ property, value: String(value) });
              }
            }
          }

          return props.length > 0 ? { customProperties: props } : {};
        })(),

        // Tags
        ...(table.tags &&
          table.tags.length > 0 && {
            tags: table.tags,
          }),
      };

      return yaml.dump(yamlData, {
        indent: 2,
        lineWidth: 120,
        noRefs: true,
        sortKeys: false,
      });
    } catch (error) {
      throw new Error(
        `Failed to convert to YAML: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Map physical data type to ODCS logical type
   */
  private mapDataTypeToLogicalType(dataType: string): string {
    const type = (dataType || 'VARCHAR').toUpperCase();

    if (type.includes('INT') || type === 'BIGINT' || type === 'SMALLINT' || type === 'TINYINT') {
      return 'integer';
    }
    if (
      type.includes('FLOAT') ||
      type.includes('DOUBLE') ||
      type.includes('DECIMAL') ||
      type.includes('NUMERIC') ||
      type === 'REAL'
    ) {
      return 'number';
    }
    if (type.includes('BOOL')) {
      return 'boolean';
    }
    if (type === 'DATE') {
      return 'date';
    }
    if (type.includes('TIMESTAMP') || type.includes('DATETIME')) {
      return 'timestamp';
    }
    if (type === 'TIME') {
      return 'time';
    }
    if (type.includes('ARRAY') || type.includes('LIST')) {
      return 'array';
    }
    if (type.includes('STRUCT') || type.includes('OBJECT') || type === 'JSON' || type === 'JSONB') {
      return 'object';
    }

    // Default to string for VARCHAR, CHAR, TEXT, etc.
    return 'string';
  }

  /**
   * Validate ODCS format
   * Uses API when online, WASM SDK when offline
   */
  async validate(
    odcsContent: string | ODCSWorkspace
  ): Promise<{ valid: boolean; errors: string[] }> {
    try {
      // Try parsing to validate
      const content =
        typeof odcsContent === 'string' ? odcsContent : await this.toYAML(odcsContent);
      await this.parseYAML(content);
      return {
        valid: true,
        errors: [],
      };
    } catch (error) {
      return {
        valid: false,
        errors: [error instanceof Error ? error.message : 'Validation failed'],
      };
    }
  }

  /**
   * Convert a frontend Table object to SDK export format
   * The SDK expects a specific Table structure with camelCase field names
   */
  private tableToSDKFormat(table: Table): Record<string, unknown> {
    // Transform columns to SDK format
    const sdkColumns = (table.columns || []).map((col) => ({
      id: col.id,
      name: col.name,
      dataType: col.data_type,
      ...(col.description && { description: col.description }),
      nullable: col.nullable !== false, // Default to true if not specified
      ...(col.is_primary_key && { primaryKey: true }),
      ...(col.is_foreign_key && { foreignKey: true }),
      ...(col.default_value && { defaultValue: col.default_value }),
    }));

    // Transform SLA to SDK format (array of {property, value, unit})
    const sdkSla: Array<{ property: string; value: number | string; unit?: string }> = [];
    if (table.sla) {
      if (table.sla.latency !== undefined) {
        sdkSla.push({ property: 'latency', value: table.sla.latency, unit: 'milliseconds' });
      }
      if (table.sla.uptime !== undefined) {
        sdkSla.push({ property: 'uptime', value: table.sla.uptime, unit: 'percent' });
      }
      if (table.sla.response_time !== undefined) {
        sdkSla.push({
          property: 'response_time',
          value: table.sla.response_time,
          unit: 'milliseconds',
        });
      }
      if (table.sla.error_rate !== undefined) {
        sdkSla.push({ property: 'error_rate', value: table.sla.error_rate, unit: 'percent' });
      }
      if (table.sla.update_frequency) {
        sdkSla.push({ property: 'update_frequency', value: table.sla.update_frequency });
      }
    }

    // Transform owner to SDK format
    const sdkOwner = table.owner
      ? {
          ...(table.owner.name && { name: table.owner.name }),
          ...(table.owner.email && { email: table.owner.email }),
        }
      : undefined;

    // Build SDK Table structure
    const sdkTable: Record<string, unknown> = {
      id: table.id,
      name: table.name,
      columns: sdkColumns,
      ...(table.alias && { alias: table.alias }),
      ...(table.description && { notes: table.description }),
      ...(table.tags && table.tags.length > 0 && { tags: table.tags }),
      ...(table.data_level && { medallionLayers: [table.data_level] }),
      ...(sdkOwner && Object.keys(sdkOwner).length > 0 && { contactDetails: sdkOwner }),
      ...(sdkSla.length > 0 && { sla: sdkSla }),
      createdAt: table.created_at,
      updatedAt: table.last_modified_at,
    };

    return sdkTable;
  }

  /**
   * Convert a frontend Table object to ODCS v3.1.0 format for SDK export
   * The SDK expects ODCS Data Contract format, not the internal frontend Table type
   */
  // @ts-expect-error - Method retained for potential future use with ODCS Data Contract export
  private _tableToODCSFormat(table: Table): Record<string, unknown> {
    const now = new Date().toISOString();

    // Build schema properties from columns
    const schemaProperties = (table.columns || []).map((col) => ({
      name: col.name,
      ...(col.description && { description: col.description }),
      logicalType: this.mapDataTypeToLogicalType(col.data_type),
      physicalType: col.data_type,
      ...(col.is_primary_key && { primaryKey: true }),
      ...(col.is_foreign_key && { foreignKey: true }),
      ...(col.nullable === false && { required: true }),
      ...(col.default_value && { default: col.default_value }),
    }));

    // Build ODCS v3.1.0 Data Contract structure
    const odcsContract: Record<string, unknown> = {
      apiVersion: 'v3.1.0',
      kind: 'DataContract',
      id: table.id,
      version: '1.0.0',
      status: (table as any).metadata?.status || 'active',
      name: table.name,

      // Optional description
      ...(table.description && {
        description: {
          purpose: table.description,
        },
      }),

      // Domain
      ...(table.primary_domain_id && { domain: table.primary_domain_id }),

      // Owner information
      ...(table.owner && {
        owner: {
          ...(table.owner.name && { name: table.owner.name }),
          ...(table.owner.email && { email: table.owner.email }),
          ...(table.owner.team && { team: table.owner.team }),
        },
      }),

      // Tags
      ...(table.tags && table.tags.length > 0 && { tags: table.tags }),

      // SLA
      ...(table.sla && { sla: table.sla }),

      // Team
      ...(table.team && table.team.length > 0 && { team: table.team }),

      // Roles
      ...(table.roles && table.roles.length > 0 && { roles: table.roles }),

      // Support channels
      ...(table.support && table.support.length > 0 && { support: table.support }),

      // Pricing
      ...(table.pricing && { pricing: table.pricing }),

      // Quality rules
      ...(table.quality_rules && { quality: table.quality_rules }),

      // Schema array with table definition
      schema: [
        {
          name: table.name,
          ...(table.description && { description: table.description }),
          logicalType: 'object',
          columns: schemaProperties,
        },
      ],

      // Timestamps
      contractCreatedTs: table.created_at || now,
    };

    return odcsContract;
  }

  /**
   * Export a table to Markdown format
   * Uses SDK 1.14.2+ export_odcs_yaml_to_markdown method
   * Converts table to ODCS YAML first, then exports to Markdown
   */
  async exportTableToMarkdown(table: Table): Promise<string> {
    if (!sdkLoader.hasODCSExport()) {
      throw new Error('ODCS Markdown export requires SDK 1.14.1 or later');
    }

    try {
      await sdkLoader.load();
      const sdk = sdkLoader.getModule();

      // SDK 1.14.2+: Use export_odcs_yaml_to_markdown which accepts ODCS YAML directly
      if (sdk && typeof (sdk as any).export_odcs_yaml_to_markdown === 'function') {
        console.log('[ODCSService] Using export_odcs_yaml_to_markdown (SDK 1.14.2+)');
        // Convert table to ODCS YAML using existing toYAML method
        const odcsYaml = await this.toYAML({
          tables: [table],
          relationships: [],
        });
        console.log('[ODCSService] Markdown export - ODCS YAML length:', odcsYaml.length);
        return (sdk as any).export_odcs_yaml_to_markdown(odcsYaml);
      }

      // Fallback to SDK 1.14.1 method if available
      if (sdk && typeof (sdk as any).export_table_to_markdown === 'function') {
        console.log('[ODCSService] Falling back to export_table_to_markdown (SDK 1.14.1)');
        const sdkTable = this.tableToSDKFormat(table);
        const tableJson = JSON.stringify(sdkTable);
        return (sdk as any).export_table_to_markdown(tableJson);
      }

      throw new Error('SDK export_odcs_yaml_to_markdown method not available');
    } catch (error) {
      console.error('[ODCSService] Failed to export table to Markdown:', error);
      throw error;
    }
  }

  /**
   * Export a table to PDF format
   * Uses SDK 1.14.2+ export_odcs_yaml_to_pdf method
   * Converts table to ODCS YAML first, then exports to PDF
   * Returns base64-encoded PDF data
   */
  async exportTableToPDF(
    table: Table,
    branding?: { logo_base64?: string; company_name?: string; footer_text?: string }
  ): Promise<{ pdf_base64: string }> {
    if (!sdkLoader.hasODCSExport()) {
      throw new Error('ODCS PDF export requires SDK 1.14.1 or later');
    }

    try {
      await sdkLoader.load();
      const sdk = sdkLoader.getModule();

      // SDK 1.14.2+: Use export_odcs_yaml_to_pdf which accepts ODCS YAML directly
      if (sdk && typeof (sdk as any).export_odcs_yaml_to_pdf === 'function') {
        console.log('[ODCSService] Using export_odcs_yaml_to_pdf (SDK 1.14.2+)');
        // Convert table to ODCS YAML using existing toYAML method
        const odcsYaml = await this.toYAML({
          tables: [table],
          relationships: [],
        });
        console.log('[ODCSService] PDF export - ODCS YAML length:', odcsYaml.length);
        const brandingJson = branding ? JSON.stringify(branding) : null;
        const resultJson = (sdk as any).export_odcs_yaml_to_pdf(odcsYaml, brandingJson);
        return JSON.parse(resultJson);
      }

      // Fallback to SDK 1.14.1 method if available
      if (sdk && typeof (sdk as any).export_table_to_pdf === 'function') {
        console.log('[ODCSService] Falling back to export_table_to_pdf (SDK 1.14.1)');
        const sdkTable = this.tableToSDKFormat(table);
        const tableJson = JSON.stringify(sdkTable);
        console.log('[ODCSService] PDF export - SDK Table JSON length:', tableJson.length);
        const brandingJson = branding ? JSON.stringify(branding) : null;
        const resultJson = (sdk as any).export_table_to_pdf(tableJson, brandingJson);
        return JSON.parse(resultJson);
      }

      throw new Error('SDK export_odcs_yaml_to_pdf method not available');
    } catch (error) {
      console.error('[ODCSService] Failed to export table to PDF:', error);
      throw error;
    }
  }

  /**
   * Export workspace as Git diff format for conflict resolution
   * Creates a diff-friendly format that can be used with Git merge tools
   */
  async exportAsGitDiff(workspace: ODCSWorkspace, baseWorkspace?: ODCSWorkspace): Promise<string> {
    const currentYAML = await this.toYAML(workspace);

    if (!baseWorkspace) {
      // No base workspace - return current as diff
      return `--- /dev/null\n+++ workspace.yaml\n@@ -0,0 +1,${currentYAML.split('\n').length} @@\n${currentYAML}`;
    }

    const baseYAML = await this.toYAML(baseWorkspace);
    const currentLines = currentYAML.split('\n');
    const baseLines = baseYAML.split('\n');

    // Simple diff format (in a real implementation, use a proper diff library)
    let diff = '--- base/workspace.yaml\n+++ current/workspace.yaml\n';

    // Add context lines and changes
    const maxLines = Math.max(currentLines.length, baseLines.length);
    for (let i = 0; i < maxLines; i++) {
      const currentLine = currentLines[i] || '';
      const baseLine = baseLines[i] || '';

      if (currentLine !== baseLine) {
        if (baseLine) diff += `-${baseLine}\n`;
        if (currentLine) diff += `+${currentLine}\n`;
      } else {
        diff += ` ${currentLine}\n`;
      }
    }

    return diff;
  }
}

// Export singleton instance
export const odcsService = new ODCSService();
