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
   * Clean column structure for JSON Schema export (SDK 1.8.1+)
   * Preserves validation rules and constraints for JSON Schema export
   * Maps constraints/quality_rules to JSON Schema validation keywords
   */
  private cleanColumnForJSONSchemaExport(column: any): any {
    const now = new Date().toISOString();
    const cleaned: any = {
      id: column.id,
      table_id: column.table_id,
      name: column.name,
      data_type: column.data_type,
      nullable: column.nullable ?? false,
      is_primary_key: column.is_primary_key ?? false,
      is_foreign_key: column.is_foreign_key ?? false,
      order: column.order ?? 0,
      created_at: column.created_at || now,
    };

    // Include optional simple fields
    if (column.foreign_key_reference) cleaned.foreign_key_reference = column.foreign_key_reference;
    if (column.default_value) cleaned.default_value = column.default_value;
    if (column.description) cleaned.description = column.description;

    // Include constraints and quality_rules for JSON Schema export (SDK 1.8.1+ supports this)
    // Map constraints to JSON Schema validation keywords as top-level properties
    // The SDK expects these as flattened properties, NOT nested in a constraints object
    // Nested objects cause "invalid type: map, expected a sequence" errors
    if (column.constraints || column.quality_rules) {
      const constraints = column.constraints || {};
      const qualityRules = column.quality_rules || {};
      const mergedConstraints = { ...constraints, ...qualityRules };

      // Map common constraint fields to JSON Schema format as top-level properties
      // SDK 1.8.1+ expects these flattened at the column level, not nested
      if (mergedConstraints.minLength !== undefined)
        cleaned.minLength = mergedConstraints.minLength;
      if (mergedConstraints.maxLength !== undefined)
        cleaned.maxLength = mergedConstraints.maxLength;
      if (mergedConstraints.pattern !== undefined) cleaned.pattern = mergedConstraints.pattern;
      if (mergedConstraints.format !== undefined) cleaned.format = mergedConstraints.format;
      if (mergedConstraints.minimum !== undefined) cleaned.minimum = mergedConstraints.minimum;
      if (mergedConstraints.maximum !== undefined) cleaned.maximum = mergedConstraints.maximum;
      if (mergedConstraints.validValues !== undefined || mergedConstraints.enum !== undefined) {
        cleaned.enum = mergedConstraints.validValues || mergedConstraints.enum;
      }

      // Include other simple constraint properties (but NOT nested objects)
      // Only include primitive types: string, number, boolean, or arrays of primitives
      Object.keys(mergedConstraints).forEach((key) => {
        const value = mergedConstraints[key];
        // Skip if already mapped above
        if (
          [
            'minLength',
            'maxLength',
            'pattern',
            'format',
            'minimum',
            'maximum',
            'validValues',
            'enum',
          ].includes(key)
        ) {
          return;
        }
        // Only include simple types - skip objects/arrays of objects
        if (value !== null && value !== undefined) {
          const valueType = typeof value;
          if (valueType === 'string' || valueType === 'number' || valueType === 'boolean') {
            cleaned[key] = value;
          } else if (Array.isArray(value)) {
            // Only include arrays of primitives (strings, numbers, booleans)
            if (
              value.length === 0 ||
              value.every(
                (v) => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
              )
            ) {
              cleaned[key] = value;
            }
          }
          // Skip objects and arrays containing objects
        }
      });

      // DO NOT include nested constraints object - SDK expects flattened properties only
    }

    return cleaned;
  }

  /**
   * Clean column structure for SDK export (AVRO, Protobuf, or general)
   * SDK export functions expect a specific Table structure from DataModel
   * Constraints with complex nested objects cause deserialization errors for AVRO/Protobuf
   * For JSON Schema exports, use cleanColumnForJSONSchemaExport instead
   */
  private cleanColumnForExport(column: any): any {
    const now = new Date().toISOString();
    const cleaned: any = {
      id: column.id,
      table_id: column.table_id,
      name: column.name,
      data_type: column.data_type,
      nullable: column.nullable ?? false,
      is_primary_key: column.is_primary_key ?? false,
      is_foreign_key: column.is_foreign_key ?? false,
      order: column.order ?? 0,
      // SDK may require created_at field
      created_at: column.created_at || now,
    };

    // Include optional fields if they exist (simple types only)
    if (column.foreign_key_reference) cleaned.foreign_key_reference = column.foreign_key_reference;
    if (column.default_value) cleaned.default_value = column.default_value;
    if (column.description) cleaned.description = column.description;

    // Skip constraints entirely - they contain complex nested objects that SDK can't deserialize
    // Schema exports (AVRO, Protobuf, JSON Schema) don't need constraint metadata
    // The SDK will generate the schema based on data_type, nullable, etc.

    return cleaned;
  }

  /**
   * Clean compound key structure for SDK export
   * SDK expects compound keys to have required fields
   */
  private cleanCompoundKeyForExport(compoundKey: any): any {
    const now = new Date().toISOString();
    return {
      id: compoundKey.id,
      table_id: compoundKey.table_id || compoundKey.tableId,
      column_ids: Array.isArray(compoundKey.column_ids)
        ? compoundKey.column_ids
        : Array.isArray(compoundKey.columnIds)
          ? compoundKey.columnIds
          : [],
      is_primary: compoundKey.is_primary ?? compoundKey.isPrimary ?? false,
      created_at: compoundKey.created_at || compoundKey.createdAt || now,
    };
  }

  /**
   * Clean table structure for JSON Schema export (SDK 1.8.1+)
   * Preserves validation rules and constraints for JSON Schema export
   */
  private cleanTableForJSONSchemaExport(table: any): any {
    const now = new Date().toISOString();
    const cleaned: any = {
      id: table.id,
      workspace_id: table.workspace_id,
      name: table.name,
      model_type: table.model_type || 'conceptual',
      columns: Array.isArray(table.columns)
        ? table.columns.map((col: any) => this.cleanColumnForJSONSchemaExport(col))
        : [],
      created_at: table.created_at || now,
      updated_at: table.last_modified_at || table.updated_at || now,
    };

    // Include optional simple fields
    if (table.primary_domain_id) cleaned.primary_domain_id = table.primary_domain_id;
    if (table.alias) cleaned.alias = table.alias;
    if (table.description) cleaned.description = table.description;
    if (Array.isArray(table.tags)) cleaned.tags = table.tags;
    if (table.data_level) cleaned.data_level = table.data_level;

    // Include compound keys if they exist
    if (Array.isArray(table.compoundKeys) && table.compoundKeys.length > 0) {
      cleaned.compound_keys = table.compoundKeys.map((ck: any) =>
        this.cleanCompoundKeyForExport(ck)
      );
    } else if (Array.isArray(table.compound_keys) && table.compound_keys.length > 0) {
      cleaned.compound_keys = table.compound_keys.map((ck: any) =>
        this.cleanCompoundKeyForExport(ck)
      );
    }

    return cleaned;
  }

  /**
   * Clean table structure for SDK export (AVRO, Protobuf, or general)
   * SDK expects DataModel structure with tables array
   * Removes complex nested objects and metadata that SDK export functions don't need
   * But includes required fields like created_at and updated_at that SDK expects
   */
  private cleanTableForExport(table: any): any {
    const now = new Date().toISOString();
    const cleaned: any = {
      id: table.id,
      workspace_id: table.workspace_id,
      name: table.name,
      model_type: table.model_type || 'conceptual',
      columns: Array.isArray(table.columns)
        ? table.columns.map((col: any) => this.cleanColumnForExport(col))
        : [],
      // SDK requires created_at and updated_at fields
      created_at: table.created_at || now,
      updated_at: table.last_modified_at || table.updated_at || now,
    };

    // Include optional simple fields (strings, numbers, booleans, arrays only)
    if (table.primary_domain_id) cleaned.primary_domain_id = table.primary_domain_id;
    if (table.alias) cleaned.alias = table.alias;
    if (table.description) cleaned.description = table.description;
    if (Array.isArray(table.tags)) cleaned.tags = table.tags;
    if (table.data_level) cleaned.data_level = table.data_level;

    // Clean compound keys if they exist (SDK might expect them)
    if (Array.isArray(table.compoundKeys) && table.compoundKeys.length > 0) {
      cleaned.compound_keys = table.compoundKeys.map((ck: any) =>
        this.cleanCompoundKeyForExport(ck)
      );
    } else if (Array.isArray(table.compound_keys) && table.compound_keys.length > 0) {
      cleaned.compound_keys = table.compound_keys.map((ck: any) =>
        this.cleanCompoundKeyForExport(ck)
      );
    }

    // Skip complex nested objects that SDK can't deserialize:
    // - owner (object)
    // - roles (array of objects)
    // - support (array of objects)
    // - pricing (object)
    // - team (array of objects)
    // - sla (object)
    // - metadata (object with nested structures)
    // - quality_rules (object with nested structures)
    // - compoundKeys (handled separately if needed)
    // - position_x, position_y, width, height (UI metadata, not needed for schema export)
    // - visible_domains (domain metadata, not needed for schema export)
    // - is_owned_by_domain (domain metadata, not needed for schema export)

    return cleaned;
  }

  /**
   * Clean relationship structure for SDK export
   * SDK expects relationships to have required fields like id, created_at, updated_at
   */
  private cleanRelationshipForExport(relationship: any): any {
    const now = new Date().toISOString();
    const cleaned: any = {
      id: relationship.id,
      workspace_id: relationship.workspace_id,
      source_table_id: relationship.source_table_id || relationship.source_id,
      target_table_id: relationship.target_table_id || relationship.target_id,
      // SDK requires created_at and updated_at fields
      created_at: relationship.created_at || now,
      updated_at: relationship.last_modified_at || relationship.updated_at || now,
    };

    // Include optional fields if they exist
    if (relationship.domain_id) cleaned.domain_id = relationship.domain_id;
    if (relationship.cardinality) cleaned.cardinality = relationship.cardinality;
    if (relationship.type) cleaned.type = relationship.type;
    if (relationship.name) cleaned.name = relationship.name;
    if (relationship.label) cleaned.label = relationship.label;
    if (relationship.optionality) cleaned.optionality = relationship.optionality;
    if (relationship.is_circular !== undefined) cleaned.is_circular = relationship.is_circular;

    return cleaned;
  }

  /**
   * Prepare workspace for JSON Schema export (SDK 1.8.1+)
   * Preserves validation rules and constraints for JSON Schema export
   */
  private async prepareWorkspaceForJSONSchemaExport(workspace: ODCSWorkspace): Promise<{
    id: string;
    name: string;
    git_directory_path: string;
    control_file_path: string;
    tables: Table[];
    relationships: any[];
    domains: any[];
    is_subfolder: boolean;
    created_at: string;
    updated_at: string;
    workspace_id?: string;
    domain_id?: string;
  }> {
    const { normalizeWorkspaceUUIDs, generateUUID } = await import('@/utils/validation');
    const normalized = normalizeWorkspaceUUIDs(workspace);
    const now = new Date().toISOString();

    const workspaceId = normalized.workspace_id || generateUUID();

    // Use JSON Schema-specific cleaning that preserves constraints
    const cleanedTables = Array.isArray(normalized.tables)
      ? normalized.tables.map((table: any) => this.cleanTableForJSONSchemaExport(table))
      : [];

    const cleanedRelationships = Array.isArray(normalized.relationships)
      ? normalized.relationships.map((rel: any) => this.cleanRelationshipForExport(rel))
      : [];

    const cleanedDomains = Array.isArray(normalized.domains)
      ? normalized.domains.map((domain: any) => ({
          id: domain.id,
          name: domain.name,
          workspace_id: domain.workspace_id,
          created_at: domain.created_at || now,
          updated_at: domain.last_modified_at || domain.updated_at || now,
        }))
      : [];

    const cleanWorkspace: {
      id: string;
      name: string;
      git_directory_path: string;
      control_file_path: string;
      tables: Table[];
      relationships: any[];
      domains: any[];
      is_subfolder: boolean;
      created_at: string;
      updated_at: string;
      workspace_id?: string;
      domain_id?: string;
    } = {
      id: workspaceId,
      name: (normalized as any).name || 'Workspace',
      git_directory_path: (normalized as any).git_directory_path || '',
      control_file_path: (normalized as any).control_file_path || '',
      tables: cleanedTables,
      relationships: cleanedRelationships,
      domains: cleanedDomains,
      is_subfolder: (normalized as any).is_subfolder ?? false,
      created_at: (normalized as any).created_at || now,
      updated_at: (normalized as any).updated_at || now,
    };

    if (normalized.workspace_id) {
      cleanWorkspace.workspace_id = normalized.workspace_id;
    }
    if (normalized.domain_id) {
      cleanWorkspace.domain_id = normalized.domain_id;
    }

    return cleanWorkspace;
  }

  /**
   * Prepare workspace for SDK export functions (AVRO, Protobuf, or general)
   * SDK export functions expect a clean workspace structure with only tables and relationships
   * This removes extra properties that might cause deserialization errors
   */
  private async prepareWorkspaceForExport(workspace: ODCSWorkspace): Promise<{
    id: string;
    name: string;
    git_directory_path: string;
    control_file_path: string;
    tables: Table[];
    relationships: any[];
    domains: any[];
    is_subfolder: boolean;
    created_at: string;
    updated_at: string;
    workspace_id?: string;
    domain_id?: string;
  }> {
    // Normalize UUIDs first
    const { normalizeWorkspaceUUIDs } = await import('@/utils/validation');
    const normalized = normalizeWorkspaceUUIDs(workspace);

    // Clean tables to remove complex nested structures
    const cleanedTables = Array.isArray(normalized.tables)
      ? normalized.tables.map((table: any) => this.cleanTableForExport(table))
      : [];

    // Clean relationships to ensure required fields are present
    const cleanedRelationships = Array.isArray(normalized.relationships)
      ? normalized.relationships.map((rel: any) => this.cleanRelationshipForExport(rel))
      : [];

    // Create clean workspace structure - SDK expects DataModel with all required fields
    // Based on SDK source (data_model.rs), DataModel requires:
    // - id: Uuid (required)
    // - name: String (required)
    // - git_directory_path: String (required)
    // - control_file_path: String (required)
    // - tables: Vec<Table> (required, can be empty)
    // - relationships: Vec<Relationship> (required, can be empty)
    // - domains: Vec<Domain> (required, can be empty)
    // - created_at: DateTime<Utc> (required)
    // - updated_at: DateTime<Utc> (required)
    // - is_subfolder: bool (has default, but should be included)
    const { generateUUID } = await import('@/utils/validation');
    const workspaceId = normalized.workspace_id || generateUUID();
    const now = new Date().toISOString();

    const cleanWorkspace: {
      id: string;
      name: string;
      git_directory_path: string;
      control_file_path: string;
      tables: Table[];
      relationships: any[];
      domains: any[];
      created_at: string;
      updated_at: string;
      is_subfolder: boolean;
      workspace_id?: string;
      domain_id?: string;
    } = {
      id: workspaceId, // SDK requires id field on DataModel/workspace object
      name: (normalized as any).name || 'Workspace', // SDK requires name field on DataModel/workspace object
      git_directory_path: (normalized as any).git_directory_path || '', // SDK requires git_directory_path field (can be empty)
      control_file_path: (normalized as any).control_file_path || '', // SDK requires control_file_path field (can be empty)
      tables: cleanedTables,
      relationships: cleanedRelationships,
      domains: [], // SDK requires domains array (can be empty)
      created_at: (normalized as any).created_at || now, // SDK requires created_at timestamp
      updated_at: (normalized as any).updated_at || (normalized as any).last_modified_at || now, // SDK requires updated_at timestamp
      is_subfolder: (normalized as any).is_subfolder ?? false, // SDK has default but should be included
    };

    // Include workspace_id and domain_id if they exist (for reference)
    if (normalized.workspace_id) {
      cleanWorkspace.workspace_id = normalized.workspace_id;
    }
    if (normalized.domain_id) {
      cleanWorkspace.domain_id = normalized.domain_id;
    }

    return cleanWorkspace;
  }

  /**
   * Preprocess Databricks SQL to handle unsupported syntax
   * NOTE: SDK v1.6.1+ has enhanced Databricks support, so preprocessing may no longer be needed.
   * This function is kept as a fallback for older SDK versions or edge cases.
   *
   * @deprecated SDK v1.6.1+ handles Databricks syntax natively. This preprocessing may be removed in future versions.
   */
  private preprocessDatabricksSQL(sqlContent: string): string {
    let processed = sqlContent;

    // 1. Replace IDENTIFIER(:variable || 'schema.table') with 'schema.table'
    // Pattern: IDENTIFIER(:variable || '.schema.table') or IDENTIFIER(:variable || 'schema.table')
    const identifierPattern = /IDENTIFIER\s*\(\s*:[\w_]+\s*\|\|\s*['"]([^'"]+)['"]\s*\)/gi;
    processed = processed.replace(identifierPattern, (_match, tableName) => {
      // Extract the table name part (everything after the ||)
      // If it starts with '.', we need to handle it differently
      const cleanTableName = tableName.startsWith('.') ? tableName.substring(1) : tableName;
      return `\`${cleanTableName}\``; // Use backticks for Databricks table names
    });

    // 2. Handle IDENTIFIER(:variable) without concatenation (just use a placeholder)
    const simpleIdentifierPattern = /IDENTIFIER\s*\(\s*:[\w_]+\s*\)/gi;
    processed = processed.replace(simpleIdentifierPattern, (_match) => {
      // Extract variable name and use it as a placeholder
      const varMatch = _match.match(/:(\w+)/);
      if (varMatch) {
        return `\`${varMatch[1]}_table\``; // Use variable name as table name hint
      }
      return '`table`'; // Fallback
    });

    // 3. Handle IDENTIFIER with complex expressions - try to extract table name
    // Pattern: IDENTIFIER(:var || '.schema.table' || '.suffix')
    const complexPattern = /IDENTIFIER\s*\(\s*:[\w_]+\s*\|\|\s*['"]([^'"]+)['"]/gi;
    processed = processed.replace(complexPattern, (_match, tablePart) => {
      // Extract the table name part
      const cleanTableName = tablePart.startsWith('.') ? tablePart.substring(1) : tablePart;
      return `\`${cleanTableName}\``;
    });

    // 4. Handle variable references in STRUCT type definitions
    // First, handle STRUCT<:variable> (variable as direct type, not field type) - must come before field patterns
    const structDirectVarPattern = /STRUCT\s*<\s*:[\w_]+\s*>/gi;
    processed = processed.replace(structDirectVarPattern, (match) => {
      console.log(
        '[ImportExportService] Replaced STRUCT direct variable:',
        match,
        '-> STRUCT<STRING>'
      );
      return 'STRUCT<STRING>';
    });

    // Pattern: STRUCT<field: :variable> - replace :variable with STRING
    // More specific pattern to avoid false positives - handle multiline
    const structVarPattern = /STRUCT\s*<\s*([^:>]*:\s*):[\w_]+([^>]*?)>/gis;
    processed = processed.replace(structVarPattern, (match, before, after) => {
      // Replace variable reference with STRING type as fallback
      console.log(
        '[ImportExportService] Replaced STRUCT variable:',
        match.substring(0, 100),
        '->',
        `STRUCT<${before}STRING${after}>`
      );
      return `STRUCT<${before}STRING${after}>`;
    });

    // Handle nested STRUCT with variables: STRUCT<field: STRUCT<:variable>>
    const nestedStructVarPattern = /STRUCT\s*<\s*([^>]*STRUCT\s*<\s*):[\w_]+([^>]*>\s*[^>]*?)>/gis;
    processed = processed.replace(nestedStructVarPattern, (match, before, after) => {
      console.log(
        '[ImportExportService] Replaced nested STRUCT variable:',
        match.substring(0, 100)
      );
      return `STRUCT<${before}STRING${after}>`;
    });

    // 5. Handle variable references in ARRAY type definitions
    // Pattern: ARRAY<:variable> - replace with ARRAY<STRING>
    const arrayVarPattern = /ARRAY\s*<\s*:[\w_]+\s*>/gi;
    processed = processed.replace(arrayVarPattern, (match) => {
      console.log('[ImportExportService] Replaced ARRAY variable:', match, '-> ARRAY<STRING>');
      return 'ARRAY<STRING>'; // Fallback to STRING array
    });

    // Handle ARRAY<STRUCT<:variable>> patterns
    const arrayStructVarPattern = /ARRAY\s*<\s*STRUCT\s*<\s*([^:>]*:\s*):[\w_]+([^>]*)>\s*>/gi;
    processed = processed.replace(arrayStructVarPattern, (match, before, after) => {
      console.log('[ImportExportService] Replaced ARRAY<STRUCT> variable:', match);
      return `ARRAY<STRUCT<${before}STRING${after}>>`;
    });

    // Handle ARRAY<STRUCT<:variable>> where variable is direct type
    const arrayStructDirectVarPattern = /ARRAY\s*<\s*STRUCT\s*<\s*:[\w_]+\s*>\s*>/gi;
    processed = processed.replace(arrayStructDirectVarPattern, (match) => {
      console.log('[ImportExportService] Replaced ARRAY<STRUCT<direct variable>>:', match);
      return 'ARRAY<STRUCT<STRING>>';
    });

    // 6. Handle variable references in column definitions (less common)
    // Pattern: column_name :variable TYPE - remove the variable reference
    // Be very careful here to avoid breaking valid SQL
    const columnVarPattern = /(\w+)\s+:\s*:[\w_]+\s+([A-Z][A-Z0-9_]*)/gi;
    processed = processed.replace(columnVarPattern, (_match, columnName, type) => {
      // Keep column name and type, remove variable reference
      return `${columnName} ${type}`;
    });

    // 7. Handle COMMENT clauses (including multiline and variable references)
    // First, handle variable references in COMMENT clauses
    const commentVarPattern = /COMMENT\s+['"]?:[\w_]+['"]?/gi;
    processed = processed.replace(commentVarPattern, () => {
      return "COMMENT 'Generated from Databricks SQL'";
    });

    // Handle COMMENT clauses that might span multiple lines or have complex content
    // Pattern: COMMENT '...' where ... might contain newlines or special characters
    // This regex handles COMMENT clauses that might be causing parsing issues
    // We'll simplify them to single-line comments
    // Match COMMENT '...' with potential newlines inside the string
    const multilineCommentPattern = /COMMENT\s+['"]([^'"]*(?:\n[^'"]*)*?)['"]/gis;
    processed = processed.replace(multilineCommentPattern, (_match, commentText) => {
      // Replace newlines and multiple spaces with single space
      const simplified = commentText.replace(/\s+/g, ' ').trim();
      // Limit length to avoid very long comments
      const truncated = simplified.length > 200 ? simplified.substring(0, 197) + '...' : simplified;
      return `COMMENT '${truncated}'`;
    });

    // Also handle COMMENT clauses that might not be properly closed (edge case)
    // This is a more aggressive pattern that removes problematic COMMENT clauses entirely
    // Only apply if the above didn't match (to avoid double-processing)
    const problematicCommentPattern = /COMMENT\s+['"][^'"]*$/gm;
    processed = processed.replace(problematicCommentPattern, (match) => {
      console.log(
        '[ImportExportService] Removed problematic COMMENT clause:',
        match.substring(0, 100)
      );
      return ''; // Remove problematic COMMENT clauses
    });

    // 8. Handle variable references in TBLPROPERTIES
    // Pattern: TBLPROPERTIES ('key' = ':variable')
    const tblPropertiesVarPattern = /TBLPROPERTIES\s*\([^)]*:[\w_]+[^)]*\)/gi;
    processed = processed.replace(tblPropertiesVarPattern, () => {
      return "TBLPROPERTIES ('imported_from' = 'databricks')";
    });

    // 9. Handle any remaining variable references in type contexts
    // Pattern: :variable where it appears to be a type (after : or <)
    // This is a catch-all for edge cases - be more aggressive
    const typeContextVarPattern = /(:\s*|<\s*):[\w_]+(\s*[>,)])/g;
    processed = processed.replace(typeContextVarPattern, (match, before, after) => {
      console.log(
        '[ImportExportService] Replaced type context variable:',
        match,
        '->',
        `${before}STRING${after}`
      );
      // Replace with STRING type
      return `${before}STRING${after}`;
    });

    // 10. More aggressive: Find any :variable that appears between < and >
    // This catches cases like STRUCT<:var> or ARRAY<:var> that might have been missed
    const angleBracketVarPattern = /<\s*:[\w_]+\s*>/g;
    processed = processed.replace(angleBracketVarPattern, (match) => {
      console.log('[ImportExportService] Replaced angle bracket variable:', match, '-> <STRING>');
      return '<STRING>';
    });

    // 11. Handle :variable after field names in STRUCT (field: :var)
    // This is a more specific pattern for STRUCT field types - handle multiline
    const structFieldVarPattern = /(\w+\s*:\s*):[\w_]+(\s*[>,,\n])/gs;
    processed = processed.replace(structFieldVarPattern, (match, before, after) => {
      console.log(
        '[ImportExportService] Replaced STRUCT field variable:',
        match,
        '->',
        `${before}STRING${after}`
      );
      return `${before}STRING${after}`;
    });

    // 12. Most aggressive: Find ANY :variable pattern that might be a type
    // This is a catch-all for any remaining variable references
    // Match :variable followed by whitespace and then >, ,, ), or newline
    const anyVarPattern = /:[\w_]+(\s*[>,,\n)])/gs;
    let matchCount = 0;

    // Use a while loop to properly track positions
    let match: RegExpExecArray | null;
    const replacements: Array<{ start: number; end: number; replacement: string }> = [];

    while ((match = anyVarPattern.exec(processed)) !== null) {
      const matchStart = match.index;
      const matchEnd = matchStart + match[0].length;
      const beforeMatch = processed.substring(0, matchStart);

      // Check if we're inside a string (odd number of quotes)
      const singleQuotesBefore = (beforeMatch.match(/'/g) || []).length;
      const doubleQuotesBefore = (beforeMatch.match(/"/g) || []).length;

      // Skip if inside a string or COMMENT/TBLPROPERTIES
      const context = processed.substring(
        Math.max(0, matchStart - 20),
        Math.min(processed.length, matchEnd + 20)
      );
      if (
        singleQuotesBefore % 2 === 1 ||
        doubleQuotesBefore % 2 === 1 ||
        context.match(/COMMENT|TBLPROPERTIES/i)
      ) {
        continue;
      }

      // Replace :variable with STRING
      const after = match[1];
      replacements.push({
        start: matchStart,
        end: matchEnd,
        replacement: `STRING${after}`,
      });

      matchCount++;
      console.log(
        '[ImportExportService] Replaced catch-all variable:',
        match[0],
        'at position',
        matchStart,
        '->',
        `STRING${after}`
      );
    }

    // Apply replacements in reverse order to maintain positions
    replacements.reverse().forEach(({ start, end, replacement }) => {
      processed = processed.substring(0, start) + replacement + processed.substring(end);
    });

    if (matchCount > 0) {
      console.log(
        `[ImportExportService] Catch-all pattern replaced ${matchCount} variable references`
      );
    }

    // Log preprocessing changes for debugging
    if (processed !== sqlContent) {
      console.log('[ImportExportService] Databricks SQL preprocessing applied');
      console.log('[ImportExportService] Original length:', sqlContent.length);
      console.log('[ImportExportService] Processed length:', processed.length);

      // Show all differences, especially around line 5 (common error location)
      const originalLines = sqlContent.split('\n');
      const processedLines = processed.split('\n');
      const differences: number[] = [];

      originalLines.forEach((line, idx) => {
        if (line !== processedLines[idx]) {
          differences.push(idx + 1);
        }
      });

      if (differences.length > 0) {
        console.log(`[ImportExportService] Changes at lines: ${differences.join(', ')}`);

        // Show lines around error location (line 5) if it exists
        const errorLine = 5;
        const contextLines = 2;
        for (
          let i = Math.max(0, errorLine - contextLines - 1);
          i < Math.min(originalLines.length, errorLine + contextLines);
          i++
        ) {
          if (originalLines[i] !== processedLines[i]) {
            console.log(`[ImportExportService] Line ${i + 1} changed:`);
            console.log('[ImportExportService]   Original:', originalLines[i]);
            console.log('[ImportExportService]   Processed:', processedLines[i]);
          } else {
            // Also show unchanged lines around error for context
            console.log(`[ImportExportService] Line ${i + 1} (unchanged):`, originalLines[i]);
          }
        }

        // Check if there are any remaining :variable patterns in the processed SQL
        const remainingVars = processed.match(/:\s*:[\w_]+/g);
        if (remainingVars && remainingVars.length > 0) {
          console.warn(
            '[ImportExportService] WARNING: Remaining variable references found:',
            remainingVars
          );
        }
      }
    }

    return processed;
  }

  /**
   * Map frontend dialect names to SDK dialect names
   * The WASM SDK uses specific dialect names that may differ from frontend conventions
   */
  private mapDialectToSDK(
    dialect: 'postgresql' | 'mysql' | 'sqlite' | 'mssql' | 'databricks'
  ): string {
    const dialectMap: Record<string, string> = {
      postgresql: 'postgresql',
      mysql: 'mysql',
      sqlite: 'sqlite',
      mssql: 'sqlserver', // SDK uses 'sqlserver', not 'mssql'
      databricks: 'databricks', // Databricks is a distinct dialect, not PostgreSQL
    };
    return dialectMap[dialect] || dialect;
  }

  /**
   * Import from SQL format (multiple dialects)
   * Uses API when online, WASM SDK when offline
   *
   * Note: SDK v1.6.1+ has enhanced Databricks support, including:
   * - IDENTIFIER() function with variable references
   * - Variable references in STRUCT/ARRAY type definitions
   * - Databricks-specific syntax (USING DELTA, COMMENT, TBLPROPERTIES, CLUSTER BY)
   *
   * Preprocessing is kept as a fallback but SDK should handle Databricks natively.
   */
  async importFromSQL(
    sqlContent: string,
    dialect: 'postgresql' | 'mysql' | 'sqlite' | 'mssql' | 'databricks' = 'postgresql'
  ): Promise<ODCSWorkspace> {
    const mode = await sdkModeDetector.getMode();

    if (mode === 'online') {
      // Use API endpoint (which uses SDK v1.6.1+)
      // Map dialect name to SDK expected format for consistency
      const sdkDialect = this.mapDialectToSDK(dialect);

      // SDK v1.6.1+ handles Databricks syntax natively
      // Try without preprocessing first, fallback to preprocessing if needed
      try {
        // Try native import first (SDK v1.6.1+ should handle Databricks natively)
        console.log(
          '[ImportExportService] Attempting API import without preprocessing (SDK v1.6.1+ native support)'
        );
        const response = await apiClient.getClient().post<ImportResult>('/api/v1/import/sql/text', {
          sql_text: sqlContent, // Use original SQL - SDK v1.6.1+ should handle it
          dialect: sdkDialect,
        });

        return {
          tables: response.data.tables || [],
          relationships: [],
        } as ODCSWorkspace;
      } catch (error) {
        // If native import fails for Databricks, try with preprocessing as fallback
        if (dialect === 'databricks') {
          console.log(
            '[ImportExportService] Native API import failed, retrying with preprocessing fallback'
          );
          const processedSQL = this.preprocessDatabricksSQL(sqlContent);
          if (processedSQL !== sqlContent) {
            console.log(
              '[ImportExportService] Preprocessed Databricks SQL (fallback - SDK v1.6.0+ should handle natively)'
            );
          }
          try {
            const response = await apiClient
              .getClient()
              .post<ImportResult>('/api/v1/import/sql/text', {
                sql_text: processedSQL,
                dialect: sdkDialect,
              });
            return {
              tables: response.data.tables || [],
              relationships: [],
            } as ODCSWorkspace;
          } catch {
            // If both fail, throw the original error
            throw new Error(
              `Failed to import Databricks SQL: ${error instanceof Error ? error.message : 'Unknown error'}. ` +
                `SDK v1.6.1+ should support Databricks syntax natively. If issues persist, verify SDK version is 1.6.1 or higher.`
            );
          }
        }
        throw new Error(
          `Failed to import SQL via API: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    } else {
      // Use WASM SDK directly for offline mode (SDK v1.6.1+)
      // Map dialect name to SDK expected format (e.g., 'mssql' -> 'sqlserver')
      const sdkDialect = this.mapDialectToSDK(dialect);

      // SDK v1.6.1+ handles Databricks syntax natively
      // Try without preprocessing first (SDK v1.6.1+ native support), fallback to preprocessing if needed
      try {
        const sdk = await sdkLoader.load();
        if (sdk && typeof (sdk as any).import_from_sql === 'function') {
          console.log(
            `[ImportExportService] Importing SQL with dialect: ${dialect} -> SDK: ${sdkDialect}`
          );

          let resultJson: string;
          try {
            // Try without preprocessing first (SDK v1.6.1+ should handle Databricks natively)
            console.log(
              `[ImportExportService] Attempting import without preprocessing (SDK v1.6.1+ native support)`
            );
            console.log(
              `[ImportExportService] SQL content preview (first 500 chars):`,
              sqlContent.substring(0, 500)
            );
            resultJson = (sdk as any).import_from_sql(sqlContent, sdkDialect);
            // Don't log success yet - check for errors in result first
          } catch (sdkError) {
            const errorMessage = sdkError instanceof Error ? sdkError.message : String(sdkError);
            console.warn(`[ImportExportService] Native import failed: ${errorMessage}`);

            // If native import fails for Databricks, try with preprocessing as fallback
            if (dialect === 'databricks') {
              console.log(
                '[ImportExportService] Native import failed, retrying with preprocessing fallback'
              );
              console.log(
                '[ImportExportService] Note: SDK v1.6.1+ should handle Databricks natively. If preprocessing is needed, the SDK version may be < 1.6.1'
              );
              const processedSQL = this.preprocessDatabricksSQL(sqlContent);
              if (processedSQL !== sqlContent) {
                console.log(
                  '[ImportExportService] Preprocessed Databricks SQL (fallback - SDK v1.6.0+ should handle natively)'
                );
                console.log(
                  '[ImportExportService] Processed SQL preview (first 500 chars):',
                  processedSQL.substring(0, 500)
                );
              }
              try {
                resultJson = (sdk as any).import_from_sql(processedSQL, sdkDialect);
                console.log(
                  '[ImportExportService] Successfully imported with preprocessing fallback'
                );
              } catch (retryError) {
                // If both fail, provide detailed error information
                const retryErrorMessage =
                  retryError instanceof Error ? retryError.message : String(retryError);
                console.error(
                  '[ImportExportService] WASM SDK failed with both native and preprocessed SQL'
                );
                console.error('[ImportExportService] Native error:', errorMessage);
                console.error('[ImportExportService] Preprocessed error:', retryErrorMessage);
                console.error('[ImportExportService] This may indicate:');
                console.error(
                  '[ImportExportService]   1. SDK version < 1.6.1 (verify SDK version is 1.6.1+)'
                );
                console.error('[ImportExportService]   2. Unsupported Databricks syntax');
                console.error(
                  '[ImportExportService]   3. SQL parsing error at the reported location'
                );

                // Extract line and column numbers from error messages
                const extractLocation = (msg: string) => {
                  const lineMatch = msg.match(/Line:\s*(\d+)/i);
                  const columnMatch = msg.match(/Column:\s*(\d+)/i);
                  return {
                    line: lineMatch && lineMatch[1] ? parseInt(lineMatch[1], 10) : null,
                    column: columnMatch && columnMatch[1] ? parseInt(columnMatch[1], 10) : null,
                  };
                };

                const nativeLoc = extractLocation(errorMessage);
                const retryLoc = extractLocation(retryErrorMessage);
                const location = nativeLoc.column !== null ? nativeLoc : retryLoc;

                // Show SQL context around error location
                let contextInfo = '';
                if (location.column !== null) {
                  const contextStart = Math.max(0, location.column - 100);
                  const contextEnd = Math.min(sqlContent.length, location.column + 100);
                  const context = sqlContent.substring(contextStart, contextEnd);
                  const pointerPos = location.column - contextStart;
                  const pointer = ' '.repeat(Math.max(0, pointerPos)) + '^';
                  contextInfo = `\n\nSQL context around column ${location.column}:\n${context}\n${pointer}`;

                  if (location.line !== null) {
                    const lines = sqlContent.split('\n');
                    const lineIndex = location.line - 1;
                    if (lineIndex >= 0 && lineIndex < lines.length) {
                      contextInfo += `\n\nLine ${location.line}:\n${lines[lineIndex]}`;
                    }
                  }
                }

                throw new Error(
                  `Failed to parse Databricks SQL. Native error: ${errorMessage}. ` +
                    `Preprocessed error: ${retryErrorMessage}. ` +
                    `SDK v1.6.1+ should support Databricks syntax natively. ` +
                    `If issues persist, verify SDK version is 1.6.1 or higher and check the SQL syntax at the reported location.${contextInfo}`
                );
              }
            } else {
              // SDK threw an exception - this happens when parsing fails
              console.error('[ImportExportService] WASM SDK threw exception:', sdkError);
              throw new Error(
                `WASM SDK failed to parse SQL: ${errorMessage}. ` +
                  `This may indicate unsupported syntax or a parsing error.`
              );
            }
          }

          let result: any;
          try {
            result = JSON.parse(resultJson);
          } catch (parseError) {
            console.error('[ImportExportService] Failed to parse SDK result JSON:', parseError);
            console.error('[ImportExportService] Raw SDK result:', resultJson);
            throw new Error(
              `Failed to parse SDK result: ${parseError instanceof Error ? parseError.message : String(parseError)}`
            );
          }

          // Log full result for debugging
          console.log('[ImportExportService] SQL import result:', {
            frontendDialect: dialect,
            sdkDialect,
            tablesCount: result.tables?.length || 0,
            relationshipsCount: result.relationships?.length || 0,
            errorsCount: result.errors?.length || 0,
            resultKeys: Object.keys(result),
            fullResult: result, // Log full result to see what we're getting
          });

          // Check for errors array (from ImportResult interface)
          // If there are errors and we're using Databricks, try preprocessing as fallback
          if (result.errors && Array.isArray(result.errors) && result.errors.length > 0) {
            // For Databricks, if native import returned errors, try preprocessing fallback
            // Check if we have no tables OR if tables array is empty
            const hasNoTables = !result.tables || result.tables.length === 0;
            if (dialect === 'databricks' && hasNoTables) {
              console.log(
                '[ImportExportService] Native import returned errors with no tables. Attempting preprocessing fallback...'
              );
              console.log('[ImportExportService] Original errors:', result.errors.length);
              try {
                const processedSQL = this.preprocessDatabricksSQL(sqlContent);
                if (processedSQL !== sqlContent) {
                  console.log(
                    '[ImportExportService] Preprocessed Databricks SQL (fallback due to errors in native import)'
                  );
                  console.log(
                    '[ImportExportService] Processed SQL preview (first 500 chars):',
                    processedSQL.substring(0, 500)
                  );
                }
                const retryResultJson = (sdk as any).import_from_sql(processedSQL, sdkDialect);
                const retryResult = JSON.parse(retryResultJson);

                // If preprocessing produced tables, use that result instead
                if (retryResult.tables && retryResult.tables.length > 0) {
                  console.log(
                    '[ImportExportService] Preprocessing fallback succeeded - using preprocessed result'
                  );
                  console.log(
                    '[ImportExportService] Preprocessed result has',
                    retryResult.tables.length,
                    'tables'
                  );
                  result = retryResult; // Replace with preprocessed result (which may still have errors, but has tables)
                  // Don't continue to error processing if we got tables from preprocessing
                  // The errors in retryResult will be handled below if they exist
                } else {
                  console.warn(
                    '[ImportExportService] Preprocessing fallback also failed - will report original errors'
                  );
                  console.warn(
                    '[ImportExportService] Preprocessed result errors:',
                    retryResult.errors?.length || 0
                  );
                }
              } catch (preprocessError) {
                console.warn(
                  '[ImportExportService] Preprocessing fallback failed:',
                  preprocessError
                );
                // Continue with original result and errors
              }
            }
            // Log full error details for debugging
            console.error(
              '[ImportExportService] SDK returned errors:',
              JSON.stringify(result.errors, null, 2)
            );

            // Extract detailed error messages - handle various error object formats
            const errorMessages = result.errors
              .map((e: any, index: number) => {
                // Log each error object individually for debugging
                console.error(
                  `[ImportExportService] Error ${index + 1}:`,
                  JSON.stringify(e, null, 2)
                );

                // Try multiple possible field names for error type
                const errorType = e.error_type || e.type || e.errorType || e.name || 'Error';

                // Try multiple possible field names for error message
                const message =
                  e.message ||
                  e.msg ||
                  e.error ||
                  e.details ||
                  e.description ||
                  (typeof e === 'string' ? e : JSON.stringify(e)) ||
                  'Unknown error';

                // Extract line and column from error message if not in object
                let lineNum: number | null = e.line !== undefined ? e.line : null;
                let columnNum: number | null = e.column !== undefined ? e.column : null;

                // Try to extract from ParseError format: "sql parser error: Expected: X, found: Y at Line: N, Column: M"
                if (!lineNum || !columnNum) {
                  const lineMatch = message.match(/Line:\s*(\d+)/i);
                  const columnMatch = message.match(/Column:\s*(\d+)/i);
                  if (lineMatch) lineNum = parseInt(lineMatch[1], 10);
                  if (columnMatch) columnNum = parseInt(columnMatch[1], 10);
                }

                // Build context information
                let contextInfo = '';
                if (lineNum !== null || columnNum !== null) {
                  // If we have column number, show SQL context around that position
                  if (columnNum !== null) {
                    const contextStart = Math.max(0, columnNum - 100);
                    const contextEnd = Math.min(sqlContent.length, columnNum + 100);
                    const context = sqlContent.substring(contextStart, contextEnd);
                    const pointerPos = columnNum - contextStart;
                    const pointer = ' '.repeat(Math.max(0, pointerPos)) + '^';
                    contextInfo = `\n\nSQL context around column ${columnNum}:\n${context}\n${pointer}`;

                    // Log context to console for debugging
                    console.error(`[ImportExportService] SQL context around column ${columnNum}:`);
                    console.error(`[ImportExportService] ${context}`);
                    console.error(`[ImportExportService] ${pointer}`);

                    // Also show line context if we have line number
                    if (lineNum !== null) {
                      const lines = sqlContent.split('\n');
                      const lineIndex = lineNum - 1; // Line numbers are 1-based
                      if (lineIndex >= 0 && lineIndex < lines.length) {
                        const lineContent = lines[lineIndex];
                        contextInfo += `\n\nLine ${lineNum}:\n${lineContent}`;
                        console.error(`[ImportExportService] Line ${lineNum}:`);
                        console.error(`[ImportExportService] ${lineContent}`);
                      }
                    }
                  }
                }

                const field = e.field ? ` (field: ${e.field})` : '';
                const line = lineNum !== null ? ` (line: ${lineNum})` : '';
                const column = columnNum !== null ? ` (column: ${columnNum})` : '';
                const position = e.position ? ` (position: ${e.position})` : '';

                return `${errorType}: ${message}${field}${line}${column}${position}${contextInfo}`;
              })
              .join('; ');

            throw new Error(`SQL parsing errors: ${errorMessages}`);
          }

          // Only log success if we got here without errors
          console.log(
            '[ImportExportService] Successfully imported without preprocessing (SDK v1.6.1+)'
          );

          // If no tables found, check if result has error or warnings
          if (!result.tables || result.tables.length === 0) {
            const errorMsg =
              result.error || result.message || result.warning || 'No tables found in SQL content';
            console.warn(
              '[ImportExportService] No tables found. Full result:',
              JSON.stringify(result, null, 2)
            );

            // Provide specific guidance for Databricks
            if (dialect === 'databricks') {
              throw new Error(
                `Failed to parse Databricks SQL: ${errorMsg}. ` +
                  `SDK v1.6.1+ includes enhanced Databricks support. ` +
                  `If you're seeing parsing errors, verify that the SDK version is 1.6.1 or higher. ` +
                  `Please check the browser console for detailed error information.`
              );
            }

            throw new Error(
              `Failed to parse SQL: ${errorMsg}. Please check that your SQL contains CREATE TABLE statements.`
            );
          }

          return {
            tables: result.tables || [],
            relationships: result.relationships || [],
          } as ODCSWorkspace;
        }
        throw new Error('WASM SDK import_from_sql method not available');
      } catch (error) {
        // Provide more detailed error message
        let errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;

        // Try to parse JSON error messages (SDK may return stringified JSON)
        try {
          const parsed = JSON.parse(errorMessage);
          if (parsed.ParseError || parsed.error || parsed.message) {
            errorMessage = parsed.ParseError || parsed.error || parsed.message || errorMessage;
          }
        } catch {
          // Not JSON, use as-is
        }

        console.error('[ImportExportService] SQL import error:', {
          frontendDialect: dialect,
          sdkDialect,
          error: errorMessage,
          errorStack,
          sqlPreview: sqlContent.substring(0, 500),
          fullError: error, // Log the full error object
        });

        // Provide specific guidance for Databricks
        if (dialect === 'databricks') {
          // Check if error mentions specific Databricks syntax issues
          const errorLower = errorMessage.toLowerCase();
          const hasIdentifierIssue =
            errorLower.includes('identifier') ||
            errorLower.includes('variable') ||
            errorLower.includes(':risk_catalog');
          const hasStructIssue = errorLower.includes('struct') || errorLower.includes('array');
          const hasCommentIssue = errorLower.includes('comment');

          let guidance = `Failed to import Databricks SQL: ${errorMessage}. `;

          // SDK v1.6.0+ should handle Databricks syntax natively
          guidance += `SDK v1.6.1+ includes enhanced Databricks support. `;

          if (hasIdentifierIssue) {
            guidance += `If you're seeing IDENTIFIER() or variable reference errors, ensure you're using SDK v1.6.1+. `;
          }
          if (hasStructIssue) {
            guidance += `STRUCT/ARRAY type definitions with variables should be supported in SDK v1.6.1+. `;
          }
          if (hasCommentIssue) {
            guidance += `COMMENT clauses should be supported in SDK v1.6.1+. `;
          }

          // Extract line and column from error message
          const extractLocation = (msg: string) => {
            const lineMatch = msg.match(/Line:\s*(\d+)/i);
            const columnMatch = msg.match(/Column:\s*(\d+)/i);
            return {
              line: lineMatch && lineMatch[1] ? parseInt(lineMatch[1], 10) : null,
              column: columnMatch && columnMatch[1] ? parseInt(columnMatch[1], 10) : null,
            };
          };

          const location = extractLocation(errorMessage);

          // Show SQL context around error location
          let contextInfo = '';
          if (location.column !== null) {
            const contextStart = Math.max(0, location.column - 100);
            const contextEnd = Math.min(sqlContent.length, location.column + 100);
            const context = sqlContent.substring(contextStart, contextEnd);
            const pointerPos = location.column - contextStart;
            const pointer = ' '.repeat(Math.max(0, pointerPos)) + '^';
            contextInfo = `\n\nSQL context around column ${location.column}:\n${context}\n${pointer}`;

            if (location.line !== null) {
              const lines = sqlContent.split('\n');
              const lineIndex = location.line - 1;
              if (lineIndex >= 0 && lineIndex < lines.length) {
                contextInfo += `\n\nLine ${location.line}:\n${lines[lineIndex]}`;
              }
            }
          }

          guidance += `Check the browser console for the full error details and SQL context. `;
          guidance += `If issues persist, verify that the SDK version is 1.6.1 or higher.${contextInfo}`;

          throw new Error(guidance);
        }

        // Extract location for non-Databricks errors too
        const extractLocation = (msg: string) => {
          const lineMatch = msg.match(/Line:\s*(\d+)/i);
          const columnMatch = msg.match(/Column:\s*(\d+)/i);
          return {
            line: lineMatch && lineMatch[1] ? parseInt(lineMatch[1], 10) : null,
            column: columnMatch && columnMatch[1] ? parseInt(columnMatch[1], 10) : null,
          };
        };

        const location = extractLocation(errorMessage);
        let contextInfo = '';
        if (location.column !== null) {
          const contextStart = Math.max(0, location.column - 100);
          const contextEnd = Math.min(sqlContent.length, location.column + 100);
          const context = sqlContent.substring(contextStart, contextEnd);
          const pointerPos = location.column - contextStart;
          const pointer = ' '.repeat(Math.max(0, pointerPos)) + '^';
          contextInfo = `\n\nSQL context around column ${location.column}:\n${context}\n${pointer}`;
        }

        throw new Error(
          `Failed to import SQL offline (dialect: ${dialect}): ${errorMessage}${contextInfo}`
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
        const sdk = await sdkLoader.load();
        if (sdk && typeof (sdk as any).import_from_avro === 'function') {
          const resultJson = (sdk as any).import_from_avro(avroContent);
          const result = JSON.parse(resultJson);
          return {
            tables: result.tables || [],
            relationships: result.relationships || [],
          } as ODCSWorkspace;
        }
        throw new Error('WASM SDK import_from_avro method not available');
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
        const response = await apiClient
          .getClient()
          .post<ImportResult>('/api/v1/import/json-schema', {
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
        const sdk = await sdkLoader.load();
        if (sdk && typeof (sdk as any).import_from_json_schema === 'function') {
          const resultJson = (sdk as any).import_from_json_schema(jsonSchemaContent);
          const result = JSON.parse(resultJson);
          return {
            tables: result.tables || [],
            relationships: result.relationships || [],
          } as ODCSWorkspace;
        }
        throw new Error('WASM SDK import_from_json_schema method not available');
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
        const sdk = await sdkLoader.load();
        if (sdk && typeof (sdk as any).import_from_protobuf === 'function') {
          const resultJson = (sdk as any).import_from_protobuf(protobufContent);
          const result = JSON.parse(resultJson);
          return {
            tables: result.tables || [],
            relationships: result.relationships || [],
          } as ODCSWorkspace;
        }
        throw new Error('WASM SDK import_from_protobuf method not available');
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
   *
   * Note: SDK v1.6.1+ includes enhanced Databricks export support with proper syntax.
   */
  async exportToSQL(
    workspace: ODCSWorkspace,
    dialect: 'postgresql' | 'mysql' | 'sqlite' | 'mssql' | 'databricks' = 'postgresql',
    _options?: { includeConstraints?: boolean; includeIndexes?: boolean }
  ): Promise<string> {
    const mode = await sdkModeDetector.getMode();

    if (mode === 'online') {
      // Map dialect name to SDK expected format for consistency
      const sdkDialect = this.mapDialectToSDK(dialect);

      try {
        const workspaceId = (workspace as any).workspace_id || 'default';
        const domainId = (workspace as any).domain_id || 'default';

        const response = await apiClient
          .getClient()
          .get<string>(`/api/v1/workspaces/${workspaceId}/domains/${domainId}/export`, {
            params: {
              format: 'sql',
              dialect: sdkDialect, // Use SDK dialect format
            },
          });

        return response.data;
      } catch (error) {
        throw new Error(
          `Failed to export SQL via API: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    } else {
      // Map dialect name to SDK expected format (e.g., 'mssql' -> 'sqlserver')
      const sdkDialect = this.mapDialectToSDK(dialect);

      try {
        const sdk = await sdkLoader.load();
        if (!sdk) {
          throw new Error('WASM SDK not loaded');
        }

        // Check for export_to_sql method
        const exportMethod = (sdk as any).export_to_sql;
        if (!exportMethod || typeof exportMethod !== 'function') {
          // Log available methods for debugging
          const availableMethods = Object.keys(sdk).filter(
            (key) => typeof (sdk as any)[key] === 'function'
          );
          console.error(
            '[ImportExportService] export_to_sql not available. Available methods:',
            availableMethods
          );
          throw new Error(
            `WASM SDK export_to_sql method not available. Available methods: ${availableMethods.join(', ')}`
          );
        }

        console.log(
          `[ImportExportService] Exporting SQL with dialect: ${dialect} -> SDK: ${sdkDialect}`
        );

        // Prepare clean workspace structure for SDK (same as AVRO/Protobuf exports)
        const exportWorkspace = await this.prepareWorkspaceForExport(workspace);

        // Ensure relationships is always an array (even if empty)
        if (!Array.isArray(exportWorkspace.relationships)) {
          exportWorkspace.relationships = [];
        }

        const workspaceJson = JSON.stringify(exportWorkspace);
        console.log('[ImportExportService] Calling export_to_sql with workspace:', {
          tableCount: exportWorkspace.tables.length,
          relationshipCount: exportWorkspace.relationships.length,
          workspaceKeys: Object.keys(exportWorkspace),
          dialect: sdkDialect,
        });

        const result = exportMethod(workspaceJson, sdkDialect);

        if (!result || typeof result !== 'string') {
          throw new Error(`Invalid SQL export result: expected string, got ${typeof result}`);
        }

        return result;
      } catch (error) {
        console.error('[ImportExportService] SQL export error:', error);
        const errorMessage =
          error instanceof Error
            ? error.message
            : typeof error === 'string'
              ? error
              : 'Unknown error';

        // Provide specific guidance for Databricks
        if (dialect === 'databricks') {
          throw new Error(
            `Failed to export to Databricks SQL: ${errorMessage}. ` +
              `Databricks SQL uses specific syntax (e.g., USING DELTA, COMMENT ON) that may differ from standard SQL.`
          );
        }

        throw new Error(`Failed to export SQL offline (dialect: ${dialect}): ${errorMessage}`);
      }
    }
  }

  /**
   * Export to AVRO Schema
   * Uses API when online, WASM SDK when offline
   *
   * Note: SDK v1.8.1+ includes enhanced AVRO export/import support with improved validation
   */
  async exportToAVRO(
    workspace: ODCSWorkspace,
    _options?: Record<string, unknown>
  ): Promise<string> {
    const mode = await sdkModeDetector.getMode();

    if (mode === 'online') {
      try {
        const workspaceId = (workspace as any).workspace_id || 'default';
        const domainId = (workspace as any).domain_id || 'default';

        const response = await apiClient
          .getClient()
          .get<string>(`/api/v1/workspaces/${workspaceId}/domains/${domainId}/export`, {
            params: {
              format: 'avro',
            },
          });

        return response.data;
      } catch (error) {
        throw new Error(
          `Failed to export AVRO via API: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    } else {
      try {
        const sdk = await sdkLoader.load();
        if (!sdk) {
          throw new Error('WASM SDK not loaded');
        }

        // Check for export_to_avro method (note: method name uses underscore)
        const exportMethod = (sdk as any).export_to_avro;
        if (!exportMethod || typeof exportMethod !== 'function') {
          // Log available methods for debugging
          const availableMethods = Object.keys(sdk).filter(
            (key) => typeof (sdk as any)[key] === 'function'
          );
          console.error(
            '[ImportExportService] export_to_avro not available. Available methods:',
            availableMethods
          );
          throw new Error(
            `WASM SDK export_to_avro method not available. Available methods: ${availableMethods.join(', ')}`
          );
        }

        // Prepare clean workspace structure for SDK
        const exportWorkspace = await this.prepareWorkspaceForExport(workspace);

        // Log the structure being sent for debugging
        console.log('[ImportExportService] Calling export_to_avro with workspace:', {
          tableCount: exportWorkspace.tables.length,
          relationshipCount: exportWorkspace.relationships.length,
          workspaceKeys: Object.keys(exportWorkspace),
          firstTableSample: exportWorkspace.tables[0]
            ? {
                id: exportWorkspace.tables[0].id,
                name: exportWorkspace.tables[0].name,
                columnCount: exportWorkspace.tables[0].columns?.length || 0,
                tableKeys: Object.keys(exportWorkspace.tables[0]).slice(0, 15),
              }
            : null,
        });

        // Ensure relationships is always an array (even if empty)
        if (!Array.isArray(exportWorkspace.relationships)) {
          exportWorkspace.relationships = [];
        }

        const workspaceJson = JSON.stringify(exportWorkspace);
        const jsonLength = workspaceJson.length;
        console.log('[ImportExportService] Workspace JSON length:', jsonLength);
        console.log(
          '[ImportExportService] Relationships count:',
          exportWorkspace.relationships.length
        );
        console.log('[ImportExportService] Workspace structure:', {
          hasTables: Array.isArray(exportWorkspace.tables),
          hasRelationships: Array.isArray(exportWorkspace.relationships),
          workspaceKeys: Object.keys(exportWorkspace),
          lastChars: workspaceJson.substring(Math.max(0, jsonLength - 50)),
        });

        if (exportWorkspace.relationships.length > 0) {
          console.log(
            '[ImportExportService] First relationship:',
            exportWorkspace.relationships[0]
          );
        }

        // Log around position 42046 where the error occurs (or end of JSON if shorter)
        const errorPos = Math.min(42046, jsonLength - 1);
        if (jsonLength > errorPos) {
          const start = Math.max(0, errorPos - 200);
          const end = Math.min(jsonLength, errorPos + 200);
          console.log(
            '[ImportExportService] JSON around position',
            errorPos,
            ':',
            workspaceJson.substring(start, end)
          );
          console.log(
            '[ImportExportService] Character at',
            errorPos,
            ':',
            workspaceJson[errorPos],
            'Context:',
            workspaceJson.substring(Math.max(0, errorPos - 10), Math.min(jsonLength, errorPos + 10))
          );
        }

        const result = exportMethod(workspaceJson);

        if (!result || typeof result !== 'string') {
          throw new Error(`Invalid AVRO export result: expected string, got ${typeof result}`);
        }

        return result;
      } catch (error) {
        console.error('[ImportExportService] AVRO export error:', error);
        const errorMessage =
          error instanceof Error
            ? error.message
            : typeof error === 'string'
              ? error
              : JSON.stringify(error);
        throw new Error(`Failed to export AVRO offline: ${errorMessage}`);
      }
    }
  }

  /**
   * Export to JSON Schema
   * Uses API when online, WASM SDK when offline
   *
   * Note: SDK v1.8.1+ includes enhanced JSON Schema export/import support with improved validation
   */
  async exportToJSONSchema(
    workspace: ODCSWorkspace,
    _options?: Record<string, unknown>
  ): Promise<string> {
    const mode = await sdkModeDetector.getMode();

    if (mode === 'online') {
      try {
        const workspaceId = (workspace as any).workspace_id || 'default';
        const domainId = (workspace as any).domain_id || 'default';

        const response = await apiClient
          .getClient()
          .get<string>(`/api/v1/workspaces/${workspaceId}/domains/${domainId}/export`, {
            params: {
              format: 'json_schema',
            },
          });

        return response.data;
      } catch (error) {
        throw new Error(
          `Failed to export JSON Schema via API: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    } else {
      try {
        const sdk = await sdkLoader.load();
        if (!sdk) {
          throw new Error('WASM SDK not loaded');
        }

        const exportMethod = (sdk as any).export_to_json_schema;
        if (!exportMethod || typeof exportMethod !== 'function') {
          const availableMethods = Object.keys(sdk).filter(
            (key) => typeof (sdk as any)[key] === 'function'
          );
          console.error(
            '[ImportExportService] export_to_json_schema not available. Available methods:',
            availableMethods
          );
          throw new Error(
            `WASM SDK export_to_json_schema method not available. Available methods: ${availableMethods.join(', ')}`
          );
        }

        // Prepare workspace structure for JSON Schema export (SDK 1.8.1+)
        // This preserves validation rules and constraints for JSON Schema export
        const exportWorkspace = await this.prepareWorkspaceForJSONSchemaExport(workspace);
        const workspaceJson = JSON.stringify(exportWorkspace);

        console.log(
          '[ImportExportService] Calling export_to_json_schema with workspace (SDK 1.8.1+):',
          {
            tableCount: exportWorkspace.tables.length,
            relationshipCount: exportWorkspace.relationships.length,
            hasConstraints: exportWorkspace.tables.some((t) =>
              t.columns?.some(
                (c: any) =>
                  c.constraints ||
                  c.minLength ||
                  c.maxLength ||
                  c.pattern ||
                  c.format ||
                  c.minimum ||
                  c.maximum ||
                  c.enum
              )
            ),
          }
        );

        const result = exportMethod(workspaceJson);

        if (!result || typeof result !== 'string') {
          throw new Error(
            `Invalid JSON Schema export result: expected string, got ${typeof result}`
          );
        }

        return result;
      } catch (error) {
        console.error('[ImportExportService] JSON Schema export error:', error);
        const errorMessage =
          error instanceof Error
            ? error.message
            : typeof error === 'string'
              ? error
              : JSON.stringify(error);
        throw new Error(`Failed to export JSON Schema offline: ${errorMessage}`);
      }
    }
  }

  /**
   * Export to Protobuf Schema
   * Uses API when online, WASM SDK when offline
   *
   * Note: SDK v1.8.1+ includes enhanced Protobuf export/import support with improved validation
   */
  async exportToProtobuf(
    workspace: ODCSWorkspace,
    _options?: Record<string, unknown>
  ): Promise<string> {
    const mode = await sdkModeDetector.getMode();

    if (mode === 'online') {
      try {
        const workspaceId = (workspace as any).workspace_id || 'default';
        const domainId = (workspace as any).domain_id || 'default';

        const response = await apiClient
          .getClient()
          .get<string>(`/api/v1/workspaces/${workspaceId}/domains/${domainId}/export`, {
            params: {
              format: 'protobuf',
            },
          });

        return response.data;
      } catch (error) {
        throw new Error(
          `Failed to export Protobuf via API: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    } else {
      try {
        const sdk = await sdkLoader.load();
        if (!sdk) {
          throw new Error('WASM SDK not loaded');
        }

        const exportMethod = (sdk as any).export_to_protobuf;
        if (!exportMethod || typeof exportMethod !== 'function') {
          const availableMethods = Object.keys(sdk).filter(
            (key) => typeof (sdk as any)[key] === 'function'
          );
          console.error(
            '[ImportExportService] export_to_protobuf not available. Available methods:',
            availableMethods
          );
          throw new Error(
            `WASM SDK export_to_protobuf method not available. Available methods: ${availableMethods.join(', ')}`
          );
        }

        // Prepare clean workspace structure for SDK
        const exportWorkspace = await this.prepareWorkspaceForExport(workspace);
        const workspaceJson = JSON.stringify(exportWorkspace);

        console.log('[ImportExportService] Calling export_to_protobuf with workspace:', {
          tableCount: exportWorkspace.tables.length,
          relationshipCount: exportWorkspace.relationships.length,
        });

        const result = exportMethod(workspaceJson);

        if (!result || typeof result !== 'string') {
          throw new Error(`Invalid Protobuf export result: expected string, got ${typeof result}`);
        }

        return result;
      } catch (error) {
        console.error('[ImportExportService] Protobuf export error:', error);
        const errorMessage =
          error instanceof Error
            ? error.message
            : typeof error === 'string'
              ? error
              : JSON.stringify(error);
        throw new Error(`Failed to export Protobuf offline: ${errorMessage}`);
      }
    }
  }
}

// Export singleton instance
export const importExportService = new ImportExportService();
