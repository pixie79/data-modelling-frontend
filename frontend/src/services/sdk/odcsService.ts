/**
 * ODCS Service
 * Handles ODCS 3.1.0 format operations
 * Supports both online (via API) and offline (via WASM SDK) modes
 */

import { sdkLoader } from './sdkLoader';
import * as yaml from 'js-yaml';
import { isValidUUID, generateUUID } from '@/utils/validation';
import type { Table, Column } from '@/types/table'; // Import Column type
import type { Relationship } from '@/types/relationship';
import type { DataFlowDiagram } from '@/types/dataflow';

export interface ODCSWorkspace {
  workspace_id?: string;
  domain_id?: string;
  system_id?: string; // System ID used as contract.id when exporting
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

/**
 * Helper function to get a value from customProperties array
 * @param customProps - Array of {property, value} objects or undefined
 * @param propertyName - The property name to find
 * @returns The value if found, undefined otherwise
 */
function getCustomProp(
  customProps: Array<{ property: string; value: unknown }> | undefined,
  propertyName: string
): unknown {
  if (!customProps || !Array.isArray(customProps)) return undefined;
  const prop = customProps.find((p) => p.property === propertyName);
  return prop?.value;
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

    // Load SDK (will throw SDKLoadError if not available)
    await sdkLoader.load();

    console.log('[ODCSService] SDK module loaded for ODCS parsing');
    console.log('[ODCSService] Using SDK 2.0.6+ V2 methods for ODCS parsing');

    // SDK 2.0.6+: Use V2 methods for native ODCSContract with lossless round-trip
    return await this.parseYAMLv2(yamlContent);
  }

  /**
   * Parse ODCS YAML using SDK 2.0.4+ V2 methods
   * Returns native ODCSContract with full metadata preservation
   * Supports multi-table import and lossless round-trip
   *
   * @param yamlContent - ODCS YAML content
   * @returns ODCSWorkspace with all tables and metadata
   */
  private async parseYAMLv2(yamlContent: string): Promise<ODCSWorkspace> {
    console.log('[ODCSService] parseYAMLv2 called (SDK 2.0.4+ native contract parsing)');

    await sdkLoader.load();
    const sdk = sdkLoader.getModule();

    if (!sdk || !sdk.parse_odcs_yaml_v2) {
      throw new Error('SDK 2.0.4+ V2 methods not available');
    }

    try {
      // Step 1: Parse YAML to native ODCSContract using SDK
      const contractJson = sdk.parse_odcs_yaml_v2(yamlContent);
      const contract = JSON.parse(contractJson);

      console.log('[ODCSService] V2 parsed contract:', {
        id: contract.id,
        name: contract.name,
        schemaCount: contract.schema?.length || 0,
        hasCustomProperties: !!contract.customProperties,
        contractStatus: contract.status,
      });

      // Step 2: Convert schema entries directly to tables
      // SDK v2 API returns:
      // - status at contract level (contract.status)
      // - custom_properties at schema level (schemaEntry.custom_properties) - snake_case from SDK
      // - custom_properties at property level (property.custom_properties) - snake_case from SDK
      const schemaEntries = contract.schema || [];

      // WORKAROUND: SDK returns snake_case 'custom_properties', but we also need 'custom' (app extension)
      // Also extract 'id' field from raw YAML to preserve table identity on reload
      let rawSchemaMap: Map<string, { id?: string; properties?: any[] }> = new Map();
      try {
        const rawParsed = yaml.load(yamlContent) as any;
        if (rawParsed?.schema && Array.isArray(rawParsed.schema)) {
          for (const schemaItem of rawParsed.schema) {
            if (schemaItem.name) {
              rawSchemaMap.set(schemaItem.name, {
                id: schemaItem.id,
                properties: schemaItem.properties,
              });
            }
          }
        }
      } catch (yamlErr) {
        console.warn('[ODCSService] V2 failed to extract raw schema data:', yamlErr);
      }

      const finalTables = schemaEntries.map((schemaEntry: any) => {
        // Normalize SDK snake_case to camelCase
        if (schemaEntry.custom_properties && !schemaEntry.customProperties) {
          schemaEntry.customProperties = schemaEntry.custom_properties;
        }

        // Get raw data including the preserved table ID
        const rawData = rawSchemaMap.get(schemaEntry.name);

        // Preserve table ID from raw YAML if SDK didn't include it
        // This is critical for maintaining table identity across save/reload cycles
        if (rawData?.id && !schemaEntry.id) {
          schemaEntry.id = rawData.id;
        }

        // Normalize SDK snake_case to camelCase and migrate 'custom' to 'customProperties'
        if (rawData?.properties && schemaEntry.properties) {
          for (const sdkProp of schemaEntry.properties) {
            // Normalize SDK snake_case to camelCase for properties
            if (sdkProp.custom_properties && !sdkProp.customProperties) {
              sdkProp.customProperties = sdkProp.custom_properties;
            }
            // Migrate legacy 'custom' field to 'customProperties' array format
            const rawProp = rawData.properties.find((p: any) => p.name === sdkProp.name);
            if (rawProp?.custom) {
              // Convert custom object to customProperties array format
              const existingCustomProps: Array<{ property: string; value: unknown }> =
                Array.isArray(sdkProp.customProperties) ? [...sdkProp.customProperties] : [];
              for (const [key, value] of Object.entries(rawProp.custom)) {
                if (!existingCustomProps.find((p) => p.property === key)) {
                  existingCustomProps.push({ property: key, value });
                }
              }
              if (existingCustomProps.length > 0) {
                sdkProp.customProperties = existingCustomProps;
              }
            }
          }
        }

        return schemaEntry;
      });

      const tables = finalTables.map((schemaEntry: any, index: number) => {
        // Schema entry already has all ODCS fields - use it directly
        // Convert ODCS 'properties' to our 'columns' format
        const tableData = {
          ...schemaEntry,
          // Map ODCS 'properties' to 'columns' for our internal format
          columns: schemaEntry.properties || [],
          // Contract-level customProperties as fallback
          customProperties: schemaEntry.customProperties || contract.customProperties,
        };

        return this.normalizeTableV2(tableData, index, contract);
      });

      // Step 3: Extract relationships from contract schema
      const relationships = this.extractRelationshipsFromContract(contract);

      console.log('[ODCSService] V2 import complete:', {
        tablesCount: tables.length,
        relationshipsCount: relationships.length,
      });

      // contract.id is the system_id (contracts are saved per-system)
      // Set system_id on each table's metadata for system linkage during loading
      const contractId = contract.id;
      if (contractId && isValidUUID(contractId)) {
        for (const table of tables) {
          if (!table.metadata) {
            table.metadata = {};
          }
          table.metadata.system_id = contractId;
        }
        console.log(
          `[ODCSService] V2 set system_id="${contractId}" on ${tables.length} table(s) from contract.id`
        );
      }

      return {
        workspace_id: generateUUID(), // Workspace ID is NOT the contract ID
        domain_id: contract.domain,
        system_id: contractId, // Preserve contract.id as system_id
        tables,
        relationships,
        data_flow_diagrams: [],
        // Preserve contract-level metadata
        contractMetadata: {
          apiVersion: contract.apiVersion,
          kind: contract.kind,
          version: contract.version,
          status: contract.status,
          name: contract.name,
          domain: contract.domain,
          dataProduct: contract.dataProduct,
          tenant: contract.tenant,
          description: contract.description,
          servers: contract.servers,
          customProperties: contract.customProperties,
          tags: contract.tags,
        },
      };
    } catch (error) {
      console.error('[ODCSService] V2 parsing failed:', error);
      throw new Error(
        `Failed to parse ODCS YAML with V2 methods: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Normalize table from SDK 2.0.4+ V2 output
   * Handles full ODCS v3.1.0 field set including physicalName, logicalType, etc.
   *
   * @param table - Table from SDK odcs_contract_to_tables output
   * @param index - Table index for positioning
   * @param contract - Original contract for context
   * @returns Normalized Table
   */
  private normalizeTableV2(table: any, index: number, contract: any): Table {
    const now = new Date().toISOString();

    // Debug: Log incoming table ODCS fields including status
    console.log(
      `[ODCSService] normalizeTableV2 - Input ODCS for ${table.name}: status=${table.status}, physicalName=${table.physicalName}`
    );

    // Table ID comes from schema[].id field (preserved in ODCS file)
    // Note: contract.id is the system_id, NOT a table ID
    let tableId: string;

    if (table.id && isValidUUID(table.id)) {
      // Use the table ID from schema[].id (preserved from raw YAML or SDK)
      tableId = table.id;
      console.log(
        `[ODCSService] normalizeTableV2 - Using preserved table ID: ${tableId} (table: ${table.name})`
      );
    } else {
      // Fallback: generate new ID
      tableId = generateUUID();
      console.log(`[ODCSService] normalizeTableV2 - Generated new ID: ${tableId}`);
    }

    // Extract table name from various possible fields
    const tableName = (
      table.name ||
      table.physicalName ||
      table.physical_name ||
      `Table_${index + 1}`
    ).trim();

    console.log(`[ODCSService] normalizeTableV2 - Processing table: ${tableName}`);

    // Extract columns/properties
    let columns: any[] = [];
    if (Array.isArray(table.columns)) {
      columns = table.columns;
    } else if (Array.isArray(table.properties)) {
      columns = table.properties;
    }

    /**
     * Helper to normalize a single column from ODCS format
     * Returns the normalized column with all ODCS v3.1.0 fields
     */
    const normalizeColumn = (
      col: any,
      colIndex: number,
      parentColumnId?: string
    ): {
      id: string;
      table_id: string;
      name: string;
      data_type: string;
      nullable: boolean;
      is_primary_key: boolean;
      is_foreign_key: boolean;
      is_unique: boolean;
      foreign_key_reference?: string;
      default_value?: string;
      description?: string;
      constraints?: Record<string, unknown>;
      quality_rules?: Record<string, unknown> | unknown[];
      quality?: unknown[];
      order: number;
      created_at: string;
      parent_column_id?: string;
      nested_columns?: any[];
      physicalName?: string;
      physicalType?: string;
      logicalType?: string;
      businessName?: string;
      primaryKeyPosition?: number;
      partitioned?: boolean;
      partitionKeyPosition?: number;
      clustered?: boolean;
      classification?: string;
      criticalDataElement?: boolean;
      encryptedName?: string;
      transformSourceObjects?: string[];
      transformLogic?: string;
      transformDescription?: string;
      examples?: string[];
      logicalTypeOptions?: any;
      authoritativeDefinitions?: any[];
      tags?: any[];
      customProperties?: any[];
    } => {
      const columnId = col.id && isValidUUID(col.id) ? col.id : generateUUID();

      // Extract constraints from logicalTypeOptions
      const constraints: Record<string, unknown> = {};
      if (col.logicalTypeOptions) {
        if (col.logicalTypeOptions.minLength !== undefined)
          constraints.minLength = col.logicalTypeOptions.minLength;
        if (col.logicalTypeOptions.maxLength !== undefined)
          constraints.maxLength = col.logicalTypeOptions.maxLength;
        if (col.logicalTypeOptions.pattern !== undefined)
          constraints.pattern = col.logicalTypeOptions.pattern;
        if (col.logicalTypeOptions.format !== undefined)
          constraints.format = col.logicalTypeOptions.format;
        if (col.logicalTypeOptions.minimum !== undefined)
          constraints.minimum = col.logicalTypeOptions.minimum;
        if (col.logicalTypeOptions.maximum !== undefined)
          constraints.maximum = col.logicalTypeOptions.maximum;
        if (col.logicalTypeOptions.enum !== undefined)
          constraints.validValues = col.logicalTypeOptions.enum;
      }

      // Determine data_type from physicalType or logicalType
      const dataType =
        col.physicalType || col.physical_type || col.logicalType || col.logical_type || 'VARCHAR';

      // Determine nullable from required field
      const nullable = col.required === true ? false : (col.nullable ?? true);

      // Check for primary key
      const isPrimaryKey =
        col.primaryKey === true ||
        col.primary_key === true ||
        (col.primaryKeyPosition !== undefined && col.primaryKeyPosition >= 0);

      // Check for foreign key from relationships or customProperties (array or legacy object format)
      const isForeignKeyFromCustomProps = Array.isArray(col.customProperties)
        ? col.customProperties.find((p: any) => p.property === 'is_foreign_key')?.value === true
        : false;
      // Fallback to legacy 'custom' object format
      const isForeignKeyFromLegacyCustom = col.custom?.is_foreign_key === true;
      const isForeignKey =
        col.is_foreign_key ??
        col.isForeignKey ??
        isForeignKeyFromCustomProps ??
        isForeignKeyFromLegacyCustom ??
        false;

      // Check for unique
      const isUnique = col.unique === true || col.is_unique === true;

      return {
        id: columnId,
        table_id: tableId,
        name: col.name || `column_${colIndex + 1}`,
        data_type: dataType,
        nullable,
        is_primary_key: isPrimaryKey,
        is_foreign_key: isForeignKey,
        is_unique: isUnique,
        foreign_key_reference: col.foreign_key_reference || col.foreignKeyReference,
        default_value: col.default_value || col.defaultValue,
        description: col.description,
        constraints: Object.keys(constraints).length > 0 ? constraints : undefined,
        quality_rules: col.quality || col.quality_rules,
        quality: col.quality,
        order: (() => {
          // Check customProperties array for order
          if (Array.isArray(col.customProperties)) {
            const orderProp = col.customProperties.find((p: any) => p.property === 'order');
            if (orderProp?.value !== undefined) return orderProp.value as number;
          }
          // Fallback to legacy 'custom' object format
          if (col.custom?.order !== undefined) return col.custom.order as number;
          return col.order ?? colIndex;
        })(),
        created_at: col.created_at || now,
        parent_column_id: parentColumnId,
        // V2 ODCS 3.1.0 fields
        physicalName: col.physicalName || col.physical_name,
        physicalType: col.physicalType || col.physical_type,
        logicalType: col.logicalType || col.logical_type,
        businessName: col.businessName || col.business_name,
        primaryKeyPosition: col.primaryKeyPosition ?? col.primary_key_position,
        partitioned: col.partitioned,
        partitionKeyPosition: col.partitionKeyPosition ?? col.partition_key_position,
        clustered: col.clustered,
        classification: col.classification,
        criticalDataElement: col.criticalDataElement ?? col.critical_data_element,
        encryptedName: col.encryptedName || col.encrypted_name,
        transformSourceObjects: col.transformSourceObjects || col.transform_source_objects,
        transformLogic: col.transformLogic || col.transform_logic,
        transformDescription: col.transformDescription || col.transform_description,
        // Normalize examples: convert Date objects to ISO date strings (YYYY-MM-DD)
        examples: col.examples
          ? col.examples.map((ex: unknown) => {
              if (ex instanceof Date) {
                return ex.toISOString().split('T')[0]; // Convert to YYYY-MM-DD
              }
              return ex;
            })
          : undefined,
        logicalTypeOptions: col.logicalTypeOptions || col.logical_type_options,
        authoritativeDefinitions: col.authoritativeDefinitions || col.authoritative_definitions,
        tags: col.tags,
        customProperties: col.customProperties || col.custom_properties,
      };
    };

    /**
     * Recursively process columns including nested properties from array/object types
     * For arrays with items.properties or objects with properties, creates child columns
     * Returns a flat array of all columns with parent_column_id set for hierarchy
     */
    const processColumnsRecursively = (
      cols: any[],
      parentColumnId?: string
    ): ReturnType<typeof normalizeColumn>[] => {
      const result: ReturnType<typeof normalizeColumn>[] = [];

      cols.forEach((col, colIndex) => {
        // Normalize the current column
        const normalizedCol = normalizeColumn(col, colIndex, parentColumnId);
        result.push(normalizedCol);

        // Check for nested properties in array types (items.properties)
        const nestedProperties = col.items?.properties || col.properties; // array type with items containing properties // object/record type with direct properties

        if (Array.isArray(nestedProperties) && nestedProperties.length > 0) {
          // Recursively process nested columns
          const nestedColumns = processColumnsRecursively(nestedProperties, normalizedCol.id);
          // Add nested_columns reference to parent for display hierarchy
          normalizedCol.nested_columns = nestedColumns;
          // Add all nested columns to the flat result
          result.push(...nestedColumns);
        }
      });

      return result;
    };

    // Normalize columns with V2 field set, including nested columns
    const normalizedColumns = processColumnsRecursively(columns);

    // Extract owner
    const owner = table.owner
      ? {
          name: table.owner.name,
          email: table.owner.email,
          team: table.owner.team,
          role: table.owner.role,
        }
      : undefined;

    // Extract SLA
    const sla = table.sla
      ? {
          latency: table.sla.latency,
          uptime: table.sla.uptime,
          response_time: table.sla.response_time,
          error_rate: table.sla.error_rate,
          update_frequency: table.sla.update_frequency,
        }
      : undefined;

    // Build metadata
    const metadata: Record<string, unknown> = {};
    if (table.metadata) {
      // Copy metadata but exclude internal fields that shouldn't be duplicated
      const {
        status: _status,
        customProperties: _cp,
        ...rest
      } = table.metadata as Record<string, unknown>;
      Object.assign(metadata, rest);
    }
    if (table.apiVersion) metadata.apiVersion = table.apiVersion;
    if (table.version) metadata.version = table.version;
    // Note: status is stored in customProperties per ODCS spec, not in metadata
    if (table.kind) metadata.kind = table.kind;
    // Note: customProperties are stored at table level, not duplicated in metadata

    // MIGRATION: Move contract-level tags to table tags (legacy files have tags at root)
    // This ensures tags like dm_level:Silver get applied to the table where they belong
    // On save, the tags will be written to the correct location (schema item, not root)
    const tableTags: string[] = [];
    if (table.tags && Array.isArray(table.tags)) {
      tableTags.push(...table.tags);
    }
    // Migrate contract-level tags to table (only if table doesn't already have tags)
    if (tableTags.length === 0 && contract.tags && Array.isArray(contract.tags)) {
      for (const tag of contract.tags) {
        if (typeof tag === 'string') {
          tableTags.push(tag);
        }
      }
      if (tableTags.length > 0) {
        console.log(
          `[ODCSService] MIGRATION: Moved ${tableTags.length} root-level tag(s) to table "${tableName}"`
        );
      }
    }

    // Extract data_level from table tags
    let dataLevel: 'operational' | 'bronze' | 'silver' | 'gold' | undefined;
    for (const tag of tableTags) {
      if (typeof tag === 'string' && tag.toLowerCase().startsWith('dm_level:')) {
        const levelValue = tag.substring('dm_level:'.length).toLowerCase();
        if (['operational', 'bronze', 'silver', 'gold'].includes(levelValue)) {
          dataLevel = levelValue as typeof dataLevel;
          console.log(
            `[ODCSService] Extracted data_level="${dataLevel}" from tag for table "${tableName}"`
          );
        }
        break;
      }
    }

    // Extract description (handle object format)
    let description: string | undefined;
    if (typeof table.description === 'string') {
      description = table.description;
    } else if (table.description && typeof table.description === 'object') {
      description = table.description.purpose || JSON.stringify(table.description);
    }

    return {
      id: tableId,
      workspace_id: contract.id || '',
      primary_domain_id: contract.domain || '',
      name: tableName,
      alias: table.alias || table.businessName || table.business_name,
      description,
      // Note: status is stored in customProperties per ODCS spec
      tags: tableTags.length > 0 ? tableTags : undefined,
      model_type: table.model_type || 'logical',
      columns: normalizedColumns,
      compoundKeys: this.normalizeCompoundKeys(table, tableId, now),
      owner,
      roles: table.roles,
      support: table.support,
      pricing: table.pricing,
      team: table.team,
      sla,
      metadata,
      quality_rules: table.quality_rules || table.qualityRules,
      position_x: table.position_x ?? index * 300,
      position_y: table.position_y ?? index * 100,
      width: table.width ?? 200,
      height: table.height ?? 150,
      visible_domains: table.visible_domains || [contract.domain || ''],
      data_level: dataLevel,
      is_owned_by_domain: true,
      created_at: table.created_at || now,
      last_modified_at: table.last_modified_at || now,
      // V2 ODCS 3.1.0 table-level fields
      physicalName: table.physicalName || table.physical_name,
      physicalType: table.physicalType || table.physical_type,
      businessName: table.businessName || table.business_name,
      dataGranularityDescription:
        table.dataGranularityDescription || table.data_granularity_description,
      authoritativeDefinitions: table.authoritativeDefinitions || table.authoritative_definitions,
      // Preserve customProperties at table level (for ODCS round-trip)
      customProperties: table.customProperties || table.custom_properties,
    } as Table;
  }

  /**
   * Extract relationships from ODCS contract schema
   * Handles both schema-level and property-level relationships
   *
   * @param contract - ODCSContract from SDK
   * @returns Array of Relationship objects
   */
  private extractRelationshipsFromContract(contract: any): Relationship[] {
    const relationships: Relationship[] = [];
    const now = new Date().toISOString();

    if (!contract.schema || !Array.isArray(contract.schema)) {
      return relationships;
    }

    // Build a map of table names to IDs for relationship resolution
    const tableNameToId = new Map<string, string>();
    for (const schemaItem of contract.schema) {
      const tableId = schemaItem.id && isValidUUID(schemaItem.id) ? schemaItem.id : generateUUID();
      tableNameToId.set(schemaItem.name, tableId);
    }

    for (const schemaItem of contract.schema) {
      const sourceTableId = tableNameToId.get(schemaItem.name) || generateUUID();

      // Check for schema-level relationships
      if (schemaItem.relationships && Array.isArray(schemaItem.relationships)) {
        for (const rel of schemaItem.relationships) {
          const relationship = this.parseODCSRelationship(rel, sourceTableId, tableNameToId, now);
          if (relationship) {
            relationships.push(relationship);
          }
        }
      }

      // Check for property-level relationships
      if (schemaItem.properties && Array.isArray(schemaItem.properties)) {
        for (const prop of schemaItem.properties) {
          if (prop.relationships && Array.isArray(prop.relationships)) {
            for (const rel of prop.relationships) {
              const relationship = this.parseODCSRelationship(
                rel,
                sourceTableId,
                tableNameToId,
                now,
                prop.name
              );
              if (relationship) {
                relationships.push(relationship);
              }
            }
          }
        }
      }
    }

    console.log(`[ODCSService] Extracted ${relationships.length} relationships from contract`);
    return relationships;
  }

  /**
   * Parse a single ODCS relationship definition
   */
  private parseODCSRelationship(
    rel: any,
    sourceTableId: string,
    tableNameToId: Map<string, string>,
    now: string,
    sourceColumnName?: string
  ): Relationship | null {
    try {
      // Handle 'to' field which can be string like "receivers.id" or array
      let targetTableName: string | undefined;
      let targetColumnName: string | undefined;

      if (typeof rel.to === 'string') {
        const parts = rel.to.split('.');
        targetTableName = parts[0];
        targetColumnName = parts[1];
      } else if (Array.isArray(rel.to) && rel.to.length > 0) {
        const firstTarget = rel.to[0];
        if (typeof firstTarget === 'string') {
          const parts = firstTarget.split('.');
          targetTableName = parts[0];
          targetColumnName = parts[1];
        }
      }

      if (!targetTableName) {
        console.warn('[ODCSService] Could not resolve target table for relationship:', rel);
        return null;
      }

      const targetTableId = tableNameToId.get(targetTableName);
      if (!targetTableId) {
        console.warn(`[ODCSService] Target table "${targetTableName}" not found in schema`);
        return null;
      }

      // Determine cardinality from relationship type or customProperties
      let sourceCardinality: '0' | '1' | 'N' = '1';
      let targetCardinality: '0' | '1' | 'N' = 'N';
      let relType: 'one-to-one' | 'one-to-many' | 'many-to-many' = 'one-to-many';

      if (rel.customProperties && Array.isArray(rel.customProperties)) {
        const cardProp = rel.customProperties.find((p: any) => p.property === 'cardinality');
        if (cardProp) {
          const cardValue = cardProp.value?.toLowerCase();
          if (cardValue === 'one-to-one') {
            relType = 'one-to-one';
            sourceCardinality = '1';
            targetCardinality = '1';
          } else if (cardValue === 'many-to-many') {
            relType = 'many-to-many';
            sourceCardinality = 'N';
            targetCardinality = 'N';
          } else if (cardValue === 'many-to-one') {
            relType = 'one-to-many';
            sourceCardinality = 'N';
            targetCardinality = '1';
          }
        }
      }

      return {
        id: generateUUID(),
        workspace_id: '',
        domain_id: '',
        source_id: sourceTableId,
        target_id: targetTableId,
        source_type: 'table',
        target_type: 'table',
        source_table_id: sourceTableId,
        target_table_id: targetTableId,
        type: relType,
        source_cardinality: sourceCardinality,
        target_cardinality: targetCardinality,
        foreign_key_details:
          sourceColumnName || targetColumnName
            ? {
                source_column: sourceColumnName,
                target_column: targetColumnName,
              }
            : undefined,
        created_at: now,
        last_modified_at: now,
      } as Relationship;
    } catch (error) {
      console.warn('[ODCSService] Failed to parse relationship:', error, rel);
      return null;
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
    // Load SDK (will throw SDKLoadError if not available)
    await sdkLoader.load();

    console.log('[ODCSService] Using SDK 2.0.6+ V2 methods for ODCS export');

    // SDK 2.0.6+: Use V2 methods for lossless export with full ODCS v3.1.0 support
    return await this.toYAMLv2(workspace);
  }

  /**
   * Export workspace to ODCS YAML using direct ODCS v3.1.0 spec
   * Builds the contract structure directly without SDK conversion functions
   * This ensures lossless round-trip with full ODCS field preservation
   *
   * @param workspace - Workspace to export
   * @returns ODCS YAML string
   */
  private async toYAMLv2(workspace: ODCSWorkspace): Promise<string> {
    console.log('[ODCSService] toYAMLv2 called (direct ODCS v3.1.0 export)');

    const { generateUUID } = await import('@/utils/validation');
    const tables = workspace.tables || [];

    // Contract ID should be the system_id (contracts are saved per system)
    // Fall back to generating a new UUID if system_id is not provided
    const contractId = workspace.system_id || generateUUID();

    // Build ODCS v3.1.0 contract structure directly
    const contract: any = {
      apiVersion: (workspace as any).contractMetadata?.apiVersion || 'v3.1.0',
      kind: (workspace as any).contractMetadata?.kind || 'DataContract',
      id: contractId,
      version: (workspace as any).contractMetadata?.version || '1.0.0',
      status: tables[0]?.status || (workspace as any).contractMetadata?.status || 'draft',
    };

    // Add optional contract-level fields
    if ((workspace as any).contractMetadata?.name || tables[0]?.name) {
      contract.name = (workspace as any).contractMetadata?.name || tables[0]?.name;
    }
    if (workspace.domain_id) {
      contract.domain = workspace.domain_id;
    }
    if ((workspace as any).contractMetadata?.description) {
      contract.description = (workspace as any).contractMetadata.description;
    }
    if ((workspace as any).contractMetadata?.tenant) {
      contract.tenant = (workspace as any).contractMetadata.tenant;
    }
    if ((workspace as any).contractMetadata?.dataProduct) {
      contract.dataProduct = (workspace as any).contractMetadata.dataProduct;
    }
    if ((workspace as any).contractMetadata?.tags) {
      contract.tags = (workspace as any).contractMetadata.tags;
    }
    if ((workspace as any).contractMetadata?.customProperties) {
      contract.customProperties = (workspace as any).contractMetadata.customProperties;
    }

    // Build schema array from tables
    contract.schema = tables.map((table: any) => {
      const schemaEntry: any = {
        // Include table ID in schema entry to preserve identity on reload
        // This is critical for multi-table contracts where workspace.yaml references table IDs
        ...(table.id && { id: table.id }),
        name: table.name,
        physicalName: table.physicalName || table.name,
        physicalType: table.physicalType || 'table',
        ...(table.businessName && { businessName: table.businessName }),
        ...(table.description && { description: table.description }),
        // Note: status is stored in customProperties per ODCS spec
        ...(table.dataGranularityDescription && {
          dataGranularityDescription: table.dataGranularityDescription,
        }),
        ...(table.authoritativeDefinitions && {
          authoritativeDefinitions: table.authoritativeDefinitions,
        }),
        ...(table.tags && table.tags.length > 0 && { tags: table.tags }),
        ...(table.customProperties && { customProperties: table.customProperties }),
      };

      // Build properties array from columns, handling nested structures
      const columns = table.columns || [];

      /**
       * Convert a column to ODCS property format
       */
      const columnToProperty = (col: any): any => {
        return {
          name: col.name,
          ...(col.physicalName && { physicalName: col.physicalName }),
          logicalType: col.logicalType || col.data_type || 'string',
          physicalType: col.physicalType || col.data_type || 'varchar',
          ...(col.businessName && { businessName: col.businessName }),
          ...(col.description && { description: col.description }),
          required: col.required ?? !col.nullable,
          ...(col.is_primary_key && { primaryKey: true }),
          // Preserve primaryKeyPosition including -1 (means "not a primary key")
          ...(col.primaryKeyPosition !== undefined && {
            primaryKeyPosition: col.primaryKeyPosition,
          }),
          ...(col.is_unique && { unique: true }),
          ...(col.partitioned !== undefined && { partitioned: col.partitioned }),
          // Preserve partitionKeyPosition including -1 (means "not partitioned")
          ...(col.partitionKeyPosition !== undefined && {
            partitionKeyPosition: col.partitionKeyPosition,
          }),
          ...(col.clustered !== undefined && { clustered: col.clustered }),
          ...(col.classification && { classification: col.classification }),
          ...(col.criticalDataElement !== undefined && {
            criticalDataElement: col.criticalDataElement,
          }),
          ...(col.encryptedName && { encryptedName: col.encryptedName }),
          ...(col.transformSourceObjects && { transformSourceObjects: col.transformSourceObjects }),
          ...(col.transformLogic && { transformLogic: col.transformLogic }),
          ...(col.transformDescription && { transformDescription: col.transformDescription }),
          ...(col.examples && col.examples.length > 0 && { examples: col.examples }),
          ...(col.logicalTypeOptions && { logicalTypeOptions: col.logicalTypeOptions }),
          ...(col.authoritativeDefinitions && {
            authoritativeDefinitions: col.authoritativeDefinitions,
          }),
          ...(col.tags && col.tags.length > 0 && { tags: col.tags }),
          // Build customProperties array including order and is_foreign_key
          ...(() => {
            const customProps: Array<{ property: string; value: unknown }> = [];
            // Add existing customProperties
            if (col.customProperties && Array.isArray(col.customProperties)) {
              customProps.push(...col.customProperties);
            }
            // Add order if not already in customProperties
            if (col.order !== undefined && !customProps.find((p) => p.property === 'order')) {
              customProps.push({ property: 'order', value: col.order });
            }
            // Add is_foreign_key if true and not already in customProperties
            if (
              col.is_foreign_key === true &&
              !customProps.find((p) => p.property === 'is_foreign_key')
            ) {
              customProps.push({ property: 'is_foreign_key', value: true });
            }
            return customProps.length > 0 ? { customProperties: customProps } : {};
          })(),
          ...(col.quality && col.quality.length > 0 && { quality: col.quality }),
        };
      };

      /**
       * Recursively build properties with nested structure for array/object types
       * Reconstructs items.properties for arrays and properties for objects
       */
      const buildPropertiesRecursively = (allColumns: any[], parentId?: string): any[] => {
        // Get columns at this level (root or children of parentId)
        const levelColumns = allColumns.filter((col) =>
          parentId ? col.parent_column_id === parentId : !col.parent_column_id
        );

        return levelColumns.map((col) => {
          const prop = columnToProperty(col);

          // Check if this column has children (nested columns)
          const childColumns = allColumns.filter((c) => c.parent_column_id === col.id);

          if (childColumns.length > 0) {
            // Recursively build nested properties
            const nestedProps = buildPropertiesRecursively(allColumns, col.id);
            const logicalType = (col.logicalType || col.data_type || '').toLowerCase();

            // For array types, nest under items.properties
            if (logicalType === 'array') {
              prop.items = {
                properties: nestedProps,
              };
            } else {
              // For object/record types, nest directly under properties
              prop.properties = nestedProps;
            }
          }

          return prop;
        });
      };

      schemaEntry.properties = buildPropertiesRecursively(columns);

      return schemaEntry;
    });

    console.log('[ODCSService] V2 contract built:', {
      id: contract.id,
      status: contract.status,
      schemaCount: contract.schema?.length || 0,
    });

    // Serialize to YAML
    const yamlResult = yaml.dump(contract, {
      lineWidth: -1,
      noRefs: true,
      sortKeys: false,
    });

    console.log('[ODCSService] V2 export complete, YAML length:', yamlResult.length);

    return yamlResult;
  }

  /**
   * Convert customProperties to SDK-expected format (object/map)
   * SDK 2.0.4 tables_to_odcs_contract expects: {key: "val", ...}
   * But ODCS YAML format uses: [{property: "key", value: "val"}, ...]
   * The SDK handles the conversion to YAML array format internally
   */
  private normalizeCustomPropertiesToObject(customProps: any): Record<string, any> | undefined {
    if (!customProps) return undefined;

    // Already in object format
    if (!Array.isArray(customProps) && typeof customProps === 'object') {
      return customProps;
    }

    // Convert array format to object format for SDK
    if (Array.isArray(customProps)) {
      const result: Record<string, any> = {};
      for (const prop of customProps) {
        if (prop.property && prop.value !== undefined) {
          result[prop.property] = prop.value;
        }
      }
      return Object.keys(result).length > 0 ? result : undefined;
    }

    return undefined;
  }

  /**
   * Convert workspace tables to ODCSContract structure
   * Uses SDK 2.0.4+ tables_to_odcs_contract for native conversion
   *
   * @param workspace - Workspace with tables to convert
   * @returns ODCSContract object
   */
  // @ts-expect-error - Kept for future SDK integration
  private async tablesToContract(workspace: ODCSWorkspace): Promise<any> {
    const sdk = sdkLoader.getModule();

    if (!sdk || !sdk.tables_to_odcs_contract) {
      throw new Error('SDK 2.0.4+ tables_to_odcs_contract method not available');
    }

    const { normalizeWorkspaceUUIDs, generateUUID } = await import('@/utils/validation');
    const normalized = normalizeWorkspaceUUIDs(workspace);
    const now = new Date().toISOString();

    // Prepare tables for V2 SDK with full ODCS field set
    const v2Tables = (normalized.tables || []).map((table: any) => {
      // Sort columns by order field before mapping, then map with full ODCS v3.1.0 field set
      const sortedColumns = [...(table.columns || [])].sort((a: any, b: any) => {
        const orderA =
          a.order ?? (getCustomProp(a.customProperties, 'order') as number | undefined) ?? 0;
        const orderB =
          b.order ?? (getCustomProp(b.customProperties, 'order') as number | undefined) ?? 0;
        return orderA - orderB;
      });
      const columns = sortedColumns.map((col: any, colIndex: number) => {
        const columnData: any = {
          id: col.id || generateUUID(),
          table_id: col.table_id || table.id,
          name: col.name,
          data_type: col.data_type || col.dataType || 'VARCHAR',
          nullable: col.nullable ?? true,
          description: col.description,
          default_value: col.default_value || col.defaultValue,
          order:
            col.order ??
            (getCustomProp(col.customProperties, 'order') as number | undefined) ??
            colIndex,
          created_at: col.created_at || now,

          // Primary key handling
          primary_key: col.is_primary_key ?? col.primaryKey ?? false,
          primaryKeyPosition: col.primaryKeyPosition ?? col.primary_key_position,

          // Foreign key handling - store in customProperties
          is_foreign_key:
            col.is_foreign_key ??
            (getCustomProp(col.customProperties, 'is_foreign_key') as boolean | undefined) ??
            false,
          foreign_key_reference: col.foreign_key_reference || col.foreignKeyReference,

          // Unique constraint
          unique: col.is_unique ?? col.unique ?? false,

          // V2 ODCS 3.1.0 physical/logical fields
          physicalName: col.physicalName || col.physical_name,
          physicalType: col.physicalType || col.physical_type,
          logicalType: col.logicalType || col.logical_type,
          businessName: col.businessName || col.business_name,

          // Debug: Log column types at export time
          ...(col.name === 'rcvr_id' &&
          console.log(
            '[ODCSService] tablesToContract rcvr_id:',
            JSON.stringify({
              colLogicalType: col.logicalType,
              colPhysicalType: col.physicalType,
              colDataType: col.data_type,
            })
          )
            ? {}
            : {}),

          // Partitioning and clustering
          partitioned: col.partitioned,
          partitionKeyPosition: col.partitionKeyPosition ?? col.partition_key_position,
          clustered: col.clustered,

          // Governance fields
          classification: col.classification,
          criticalDataElement: col.criticalDataElement ?? col.critical_data_element,
          encryptedName: col.encryptedName || col.encrypted_name,

          // Transform fields
          transformSourceObjects: col.transformSourceObjects || col.transform_source_objects,
          transformLogic: col.transformLogic || col.transform_logic,
          transformDescription: col.transformDescription || col.transform_description,

          // Additional metadata
          // Normalize examples: convert Date objects to ISO date strings (YYYY-MM-DD)
          examples: col.examples
            ? col.examples.map((ex: unknown) => {
                if (ex instanceof Date) {
                  return ex.toISOString().split('T')[0]; // Convert to YYYY-MM-DD
                }
                return ex;
              })
            : undefined,
          logicalTypeOptions: col.logicalTypeOptions || col.logical_type_options,
          authoritativeDefinitions: col.authoritativeDefinitions || col.authoritative_definitions,
          tags: col.tags,
          // IMPORTANT: SDK expects customProperties as object {key: value}, not array
          // The SDK will convert to ODCS array format [{property, value}] internally
          // We merge existing customProperties with order and is_foreign_key
          customProperties: (() => {
            const baseProps =
              this.normalizeCustomPropertiesToObject(
                col.customProperties || col.custom_properties
              ) || {};
            const orderVal =
              col.order ??
              (getCustomProp(col.customProperties, 'order') as number | undefined) ??
              colIndex;
            const isFk =
              col.is_foreign_key ??
              (getCustomProp(col.customProperties, 'is_foreign_key') as boolean | undefined) ??
              false;
            return {
              ...baseProps,
              order: orderVal,
              ...(isFk ? { is_foreign_key: true } : {}),
            };
          })(),

          // Quality rules
          quality: col.quality || col.quality_rules,
        };

        // NOTE: constraints is NOT a standard ODCS field - it's stored in logicalTypeOptions
        // The SDK doesn't support constraints as a separate field, so we skip it here
        // Constraints (min, max, pattern, etc.) should be in logicalTypeOptions which is already set above

        return columnData;
      });

      // Build table data with full ODCS field set
      // Note: status is stored in customProperties per ODCS spec

      const tableData: any = {
        id: table.id || generateUUID(),
        workspace_id: table.workspace_id || normalized.workspace_id,
        name: table.name,
        model_type: table.model_type || 'logical',
        // Note: status is in customProperties per ODCS spec
        columns,
        created_at: table.created_at || now,
        updated_at: table.last_modified_at || table.updated_at || now,

        // V2 ODCS 3.1.0 table fields
        physicalName: table.physicalName || table.physical_name,
        physicalType: table.physicalType || table.physical_type,
        businessName: table.businessName || table.business_name || table.alias,
        dataGranularityDescription:
          table.dataGranularityDescription || table.data_granularity_description,
        authoritativeDefinitions: table.authoritativeDefinitions || table.authoritative_definitions,
        // Preserve customProperties which includes status
        customProperties: table.customProperties,
      };

      // Add optional fields
      if (table.primary_domain_id) tableData.primary_domain_id = table.primary_domain_id;
      if (table.alias) tableData.alias = table.alias;
      if (table.description) tableData.description = table.description;

      // Handle tags - ensure data_level is included as dm_level:xxx tag
      const tableTags: string[] = Array.isArray(table.tags) ? [...table.tags] : [];

      // Add dm_level tag from data_level if not already present
      if (table.data_level) {
        const dmLevelTag = `dm_level:${table.data_level}`;
        const hasDmLevelTag = tableTags.some(
          (t) => typeof t === 'string' && t.toLowerCase().startsWith('dm_level:')
        );
        if (!hasDmLevelTag) {
          tableTags.push(dmLevelTag);
          console.log(`[ODCSService] Added dm_level tag: ${dmLevelTag} for table ${table.name}`);
        }
        tableData.data_level = table.data_level;
      }

      if (tableTags.length > 0) {
        tableData.tags = tableTags;
      }

      // Preserve owner
      if (table.owner) {
        tableData.owner = {
          name: table.owner.name,
          email: table.owner.email,
          team: table.owner.team,
          role: table.owner.role,
        };
      }

      // Preserve SLA
      if (table.sla) {
        tableData.sla = table.sla;
      }

      // Preserve roles, support, pricing, team
      if (table.roles) tableData.roles = table.roles;
      if (table.support) tableData.support = table.support;
      if (table.pricing) tableData.pricing = table.pricing;
      if (table.team) tableData.team = table.team;

      // Preserve quality rules
      if (table.quality_rules) tableData.quality_rules = table.quality_rules;

      // Preserve metadata (but strip UI-specific fields)
      if (table.metadata && typeof table.metadata === 'object') {
        const {
          customProperties: _customProperties,
          odcsMetadata: _odcsMetadata,
          ...cleanedMetadata
        } = table.metadata;
        if (Object.keys(cleanedMetadata).length > 0) {
          tableData.metadata = cleanedMetadata;
        }
      }

      // Preserve compound keys
      if (Array.isArray(table.compoundKeys) && table.compoundKeys.length > 0) {
        tableData.compound_keys = table.compoundKeys.map((ck: any) => ({
          id: ck.id,
          table_id: ck.table_id || ck.tableId || table.id,
          column_ids: ck.column_ids || ck.columnIds || [],
          is_primary: ck.is_primary ?? ck.isPrimary ?? false,
          created_at: ck.created_at || ck.createdAt || now,
          ...(ck.name && { name: ck.name }),
        }));
      } else if (Array.isArray(table.compound_keys) && table.compound_keys.length > 0) {
        tableData.compound_keys = table.compound_keys;
      }

      return tableData;
    });

    // Prepare contract metadata from workspace
    // IMPORTANT: For single-table contracts, use the table's ID as the contract ID
    // This ensures the contract ID matches what's stored in workspace.yaml table_ids
    // and allows future expansion to multi-table contracts
    const isSingleTable = v2Tables.length === 1;
    const contractId =
      isSingleTable && v2Tables[0]?.id ? v2Tables[0].id : normalized.workspace_id || generateUUID();

    if (isSingleTable) {
      console.log(
        `[ODCSService] Single-table contract: using table ID as contract ID: ${contractId}`
      );
    }

    const contractMetadata: any = {
      id: contractId,
      name: (normalized as any).name || 'Data Contract',
      domain: normalized.domain_id,
      apiVersion: (workspace as any).contractMetadata?.apiVersion || 'v3.1.0',
      kind: (workspace as any).contractMetadata?.kind || 'DataContract',
      version: (workspace as any).contractMetadata?.version || '1.0.0',
      status: (workspace as any).contractMetadata?.status || 'draft',
    };

    // Add optional contract metadata
    if ((workspace as any).contractMetadata?.description) {
      contractMetadata.description = (workspace as any).contractMetadata.description;
    }
    if ((workspace as any).contractMetadata?.tenant) {
      contractMetadata.tenant = (workspace as any).contractMetadata.tenant;
    }
    if ((workspace as any).contractMetadata?.dataProduct) {
      contractMetadata.dataProduct = (workspace as any).contractMetadata.dataProduct;
    }
    if ((workspace as any).contractMetadata?.servers) {
      contractMetadata.servers = (workspace as any).contractMetadata.servers;
    }
    if ((workspace as any).contractMetadata?.customProperties) {
      contractMetadata.customProperties = (workspace as any).contractMetadata.customProperties;
    }
    if ((workspace as any).contractMetadata?.tags) {
      contractMetadata.tags = (workspace as any).contractMetadata.tags;
    }

    // Call SDK to convert tables to contract
    const tablesJson = JSON.stringify(v2Tables);
    const metadataJson = JSON.stringify(contractMetadata);

    console.log('[ODCSService] Converting tables to contract:', {
      tableCount: v2Tables.length,
      hasMetadata: true,
    });

    // Debug: Log table-level fields to verify they're being passed
    if (v2Tables.length > 0) {
      const t = v2Tables[0];
      console.log('[ODCSService] V2 table ODCS fields:', {
        name: t.name,
        physicalName: t.physicalName,
        physicalType: t.physicalType,
        businessName: t.businessName,
        description: t.description,
        status: t.status,
        dataGranularityDescription: t.dataGranularityDescription,
      });
    }

    // Log first table structure
    if (v2Tables.length > 0) {
      const firstTable = v2Tables[0];
      console.log('[ODCSService] V2 table structure sample:', {
        name: firstTable.name,
        columnCount: firstTable.columns?.length,
        hasCustomProperties: !!firstTable.customProperties,
        customPropertiesType: firstTable.customProperties
          ? Array.isArray(firstTable.customProperties)
            ? 'array'
            : typeof firstTable.customProperties
          : 'undefined',
        hasMetadata: !!firstTable.metadata,
        metadataType: firstTable.metadata ? typeof firstTable.metadata : 'undefined',
      });
      // Log column customProperties
      if (firstTable.columns?.length > 0) {
        for (const col of firstTable.columns) {
          if (col.customProperties) {
            console.log(
              `[ODCSService] Column ${col.name} customProperties type:`,
              Array.isArray(col.customProperties) ? 'array' : typeof col.customProperties,
              col.customProperties
            );
          }
        }
      }
    }

    const contractJson = sdk.tables_to_odcs_contract(tablesJson, metadataJson);
    const contract = JSON.parse(contractJson);

    console.log('[ODCSService] Contract created:', {
      id: contract.id,
      schemaCount: contract.schema?.length || 0,
    });

    // IMPORTANT: SDK's tables_to_odcs_contract() may not preserve all ODCS fields
    // We need to patch the schema entries with the original table data
    if (
      contract.schema &&
      Array.isArray(contract.schema) &&
      v2Tables.length === contract.schema.length
    ) {
      contract.schema = contract.schema.map((schemaEntry: any, idx: number) => {
        const originalTable = v2Tables[idx];

        // Debug: Log status patching
        console.log(`[ODCSService] Patching schema entry "${schemaEntry.name}":`, {
          originalTableStatus: originalTable?.status,
          schemaEntryStatus: schemaEntry.status,
        });

        // Merge original table ODCS fields that SDK may not include
        // Also patch column-level fields that SDK may drop (like logicalType)
        const originalColumns = originalTable?.columns || [];
        const schemaProperties = schemaEntry.properties || [];

        const patchedProperties = schemaProperties.map((prop: any) => {
          const originalCol = originalColumns.find((c: any) => c.name === prop.name);
          if (originalCol) {
            return {
              ...prop,
              // Preserve logicalType from original (SDK may overwrite with physicalType)
              ...(originalCol.logicalType && { logicalType: originalCol.logicalType }),
              // Preserve other column fields SDK may drop
              ...(originalCol.logicalTypeOptions && {
                logicalTypeOptions: originalCol.logicalTypeOptions,
              }),
              ...(originalCol.classification && { classification: originalCol.classification }),
              ...(originalCol.criticalDataElement !== undefined && {
                criticalDataElement: originalCol.criticalDataElement,
              }),
              ...(originalCol.encryptedName && { encryptedName: originalCol.encryptedName }),
              ...(originalCol.tags && originalCol.tags.length > 0 && { tags: originalCol.tags }),
              ...(originalCol.customProperties && {
                customProperties: originalCol.customProperties,
              }),
            };
          }
          return prop;
        });

        const patchedEntry = {
          ...schemaEntry,
          // Patched properties with preserved column fields
          properties: patchedProperties,
          // Table ID
          ...(originalTable?.id && !schemaEntry.id && { id: originalTable.id }),
          // ODCS table-level fields
          ...(originalTable?.physicalName && { physicalName: originalTable.physicalName }),
          ...(originalTable?.physicalType && { physicalType: originalTable.physicalType }),
          ...(originalTable?.businessName && { businessName: originalTable.businessName }),
          ...(originalTable?.description && { description: originalTable.description }),
          // Note: status is in customProperties per ODCS spec
          ...(originalTable?.customProperties && {
            customProperties: originalTable.customProperties,
          }),
          ...(originalTable?.dataGranularityDescription && {
            dataGranularityDescription: originalTable.dataGranularityDescription,
          }),
          ...(originalTable?.authoritativeDefinitions && {
            authoritativeDefinitions: originalTable.authoritativeDefinitions,
          }),
          ...(originalTable?.tags && originalTable.tags.length > 0 && { tags: originalTable.tags }),
        };

        if (originalTable?.id && !schemaEntry.id) {
          console.log(
            `[ODCSService] Adding table ID to schema entry: ${originalTable.id} (${schemaEntry.name})`
          );
        }

        return patchedEntry;
      });
    }

    return contract;
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
    // Note: status is stored in customProperties per ODCS spec, not in metadata
    if (item.kind) metadata.kind = item.kind;
    if (item.odcsMetadata && typeof item.odcsMetadata === 'object') {
      metadata.odcsMetadata = item.odcsMetadata;
    }
    // Note: customProperties are stored at table level, not duplicated in metadata

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
      // Note: status is stored in customProperties per ODCS spec, not in metadata

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
          col.is_foreign_key ??
          col.isForeignKey ??
          (getCustomProp(col.customProperties, 'is_foreign_key') as boolean | undefined) ?? // Check customProperties
          (typeof col.foreign_key === 'object' && col.foreign_key !== null) ?? // Infer from FK object
          (typeof col.foreignKey === 'object' && col.foreignKey !== null) ??
          false,
        // is_unique: true if ODCS unique=true (will show as IX only if not PK)
        is_unique: col.unique ?? col.is_unique ?? col.isUnique ?? false,
        foreign_key_reference:
          col.foreign_key_reference || col.foreign_key || col.reference || col.foreignKeyReference,
        default_value: col.default_value || col.default || col.defaultValue,
        description:
          col.description || col.desc || (colConstraints.description as string) || undefined,
        constraints: Object.keys(colConstraints).length > 0 ? colConstraints : undefined,
        quality_rules: qualityArray || colQualityRules, // Store quality array if present, otherwise use quality_rules object
        quality: qualityArray, // Preserve raw quality array for UI components
        order:
          col.order ??
          (getCustomProp(col.customProperties, 'order') as number | undefined) ??
          colIndex,
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
   * Valid ODCS logical types per ODCS v3.1.0 spec
   * All values must be lowercase
   */
  private static readonly VALID_LOGICAL_TYPES = [
    'string',
    'date',
    'timestamp',
    'time',
    'number',
    'integer',
    'object',
    'array',
    'boolean',
  ] as const;

  /**
   * Normalize a logical/physical type to lowercase ODCS-compliant value
   * Maps common uppercase types to their lowercase equivalents
   * Falls back to 'string' for unknown types
   */
  private normalizeLogicalType(type: string | undefined): string {
    if (!type) return 'string';

    const lowerType = type.toLowerCase();

    // Check if it's already a valid ODCS type
    if (ODCSService.VALID_LOGICAL_TYPES.includes(lowerType as any)) {
      return lowerType;
    }

    // Map common SQL/database types to ODCS logical types
    const upperType = type.toUpperCase();

    if (
      upperType.includes('INT') ||
      upperType === 'BIGINT' ||
      upperType === 'SMALLINT' ||
      upperType === 'TINYINT'
    ) {
      return 'integer';
    }
    if (
      upperType.includes('FLOAT') ||
      upperType.includes('DOUBLE') ||
      upperType.includes('DECIMAL') ||
      upperType.includes('NUMERIC') ||
      upperType === 'REAL'
    ) {
      return 'number';
    }
    if (upperType.includes('BOOL')) {
      return 'boolean';
    }
    if (upperType === 'DATE') {
      return 'date';
    }
    if (upperType.includes('TIMESTAMP') || upperType.includes('DATETIME')) {
      return 'timestamp';
    }
    if (upperType === 'TIME') {
      return 'time';
    }
    if (upperType.includes('ARRAY') || upperType.includes('LIST')) {
      return 'array';
    }
    if (
      upperType.includes('STRUCT') ||
      upperType.includes('OBJECT') ||
      upperType === 'JSON' ||
      upperType === 'JSONB'
    ) {
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
      // ODCS v3.1.0 requires lowercase logical/physical types
      logicalType: this.normalizeLogicalType(col.logicalType || col.data_type),
      physicalType: this.normalizeLogicalType(col.physicalType || col.data_type),
      ...(col.is_primary_key && { primaryKey: true }),
      ...(col.is_foreign_key && { foreignKey: true }),
      ...(col.nullable === false && { required: true }),
      ...(col.default_value && { default: col.default_value }),
    }));

    // Helper to get status from customProperties
    const getStatusFromCustomProps = (
      customProps: Array<{ property: string; value: unknown }> | undefined
    ): string => {
      if (!customProps || !Array.isArray(customProps)) return 'active';
      const statusProp = customProps.find((p) => p.property === 'status');
      return typeof statusProp?.value === 'string' ? statusProp.value : 'active';
    };

    // Build ODCS v3.1.0 Data Contract structure
    const odcsContract: Record<string, unknown> = {
      apiVersion: 'v3.1.0',
      kind: 'DataContract',
      id: table.id,
      version: '1.0.0',
      // Status is stored in customProperties per ODCS spec
      status: getStatusFromCustomProps(table.customProperties),
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
   * Uses SDK 2.0.6+ export_odcs_yaml_to_markdown method
   * Converts table to ODCS YAML first, then exports to Markdown
   */
  async exportTableToMarkdown(table: Table): Promise<string> {
    try {
      await sdkLoader.load();
      const sdk = sdkLoader.getModule();

      // SDK 2.0.6+: Use export_odcs_yaml_to_markdown which accepts ODCS YAML directly
      if (typeof (sdk as any).export_odcs_yaml_to_markdown === 'function') {
        console.log('[ODCSService] Using export_odcs_yaml_to_markdown');
        // Convert table to ODCS YAML using existing toYAML method
        const odcsYaml = await this.toYAML({
          tables: [table],
          relationships: [],
        });
        console.log('[ODCSService] Markdown export - ODCS YAML length:', odcsYaml.length);
        return (sdk as any).export_odcs_yaml_to_markdown(odcsYaml);
      }

      // Fallback to export_table_to_markdown if available
      if (typeof (sdk as any).export_table_to_markdown === 'function') {
        console.log('[ODCSService] Using export_table_to_markdown');
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
   * Uses SDK 2.0.6+ export_odcs_yaml_to_pdf method
   * Converts table to ODCS YAML first, then exports to PDF
   * Returns base64-encoded PDF data
   */
  async exportTableToPDF(
    table: Table,
    branding?: { logo_base64?: string; company_name?: string; footer_text?: string }
  ): Promise<{ pdf_base64: string }> {
    try {
      await sdkLoader.load();
      const sdk = sdkLoader.getModule();

      // SDK 2.0.6+: Use export_odcs_yaml_to_pdf which accepts ODCS YAML directly
      if (typeof (sdk as any).export_odcs_yaml_to_pdf === 'function') {
        console.log('[ODCSService] Using export_odcs_yaml_to_pdf');
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

      // Fallback to export_table_to_pdf if available
      if (typeof (sdk as any).export_table_to_pdf === 'function') {
        console.log('[ODCSService] Using export_table_to_pdf');
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
