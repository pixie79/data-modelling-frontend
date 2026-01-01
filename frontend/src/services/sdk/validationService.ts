/**
 * Validation Service
 * Uses SDK for validating data models and relationships
 */

import { sdkLoader } from './sdkLoader';
import type { Table } from '@/types/table';
import type { Relationship } from '@/types/relationship';

export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ModelIntegrityResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  orphanedRelationships: string[];
  invalidDataTypes: string[];
  duplicateNames: string[];
}

class ValidationService {
  /**
   * Validate a table
   */
  async validateTable(table: Table): Promise<ValidationResult> {
    await sdkLoader.load();
    
    // TODO: Implement actual SDK validation when available
    // const sdk = await sdkLoader.load();
    // return sdk.validateTable(table);
    
    // Placeholder implementation with basic validation
    const errors: ValidationError[] = [];
    
    if (!table.name || table.name.trim().length === 0) {
      errors.push({
        field: 'name',
        message: 'Table name is required',
        code: 'REQUIRED',
      });
    }
    
    if (table.columns.length === 0 && table.model_type === 'physical') {
      errors.push({
        field: 'columns',
        message: 'Physical tables must have at least one column',
        code: 'MIN_COLUMNS',
      });
    }
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate a relationship
   */
  async validateRelationship(relationship: Relationship): Promise<ValidationResult> {
    await sdkLoader.load();
    
    // TODO: Implement actual SDK validation when available
    // const sdk = await sdkLoader.load();
    // return sdk.validateRelationship(relationship);
    
    // Placeholder implementation with basic validation
    const errors: ValidationError[] = [];
    
    if (relationship.source_table_id === relationship.target_table_id) {
      errors.push({
        field: 'target_table_id',
        message: 'Source and target tables must be different',
        code: 'SELF_REFERENCE',
      });
    }
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate circular relationships
   */
  async detectCircularRelationships(
    relationships: Relationship[]
  ): Promise<{ isCircular: boolean; cycle?: string[] }> {
    await sdkLoader.load();
    
    // TODO: Implement actual SDK circular detection when available
    // const sdk = await sdkLoader.load();
    // return sdk.detectCircularRelationships(relationships);
    
    // Placeholder implementation - basic cycle detection
    // This is a simplified version - full implementation will use SDK
    const graph = new Map<string, string[]>();
    
    // Build adjacency list
    for (const rel of relationships) {
      if (!graph.has(rel.source_table_id)) {
        graph.set(rel.source_table_id, []);
      }
      graph.get(rel.source_table_id)!.push(rel.target_table_id);
    }
    
    // Simple cycle detection using DFS
    const visited = new Set<string>();
    const recStack = new Set<string>();
    
    const hasCycle = (node: string): boolean => {
      if (recStack.has(node)) {
        return true;
      }
      if (visited.has(node)) {
        return false;
      }
      
      visited.add(node);
      recStack.add(node);
      
      const neighbors = graph.get(node) || [];
      for (const neighbor of neighbors) {
        if (hasCycle(neighbor)) {
          return true;
        }
      }
      
      recStack.delete(node);
      return false;
    };
    
    for (const node of graph.keys()) {
      if (!visited.has(node) && hasCycle(node)) {
        return { isCircular: true };
      }
    }
    
    return { isCircular: false };
  }

  /**
   * Validate model integrity (orphaned relationships, invalid data types, duplicates)
   */
  async validateModelIntegrity(
    tables: Table[],
    relationships: Relationship[]
  ): Promise<ModelIntegrityResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const orphanedRelationships: string[] = [];
    const invalidDataTypes: string[] = [];
    const duplicateNames: string[] = [];

    // Check for orphaned relationships
    const tableIds = new Set(tables.map((t) => t.id));
    for (const rel of relationships) {
      if (!tableIds.has(rel.source_table_id)) {
        const errorMsg = `orphaned relationship: ${rel.id} (source table ${rel.source_table_id} not found)`;
        orphanedRelationships.push(`Relationship ${rel.id} references non-existent source table ${rel.source_table_id}`);
        errors.push(errorMsg);
      }
      if (!tableIds.has(rel.target_table_id)) {
        const errorMsg = `orphaned relationship: ${rel.id} (target table ${rel.target_table_id} not found)`;
        orphanedRelationships.push(`Relationship ${rel.id} references non-existent target table ${rel.target_table_id}`);
        errors.push(errorMsg);
      }
    }

    // Check for duplicate table names
    const tableNames = new Map<string, string>();
    for (const table of tables) {
      if (tableNames.has(table.name)) {
        duplicateNames.push(table.name);
        errors.push(`Duplicate table name: ${table.name} (tables ${tableNames.get(table.name)} and ${table.id})`);
      } else {
        tableNames.set(table.name, table.id);
      }
    }

    // Check for invalid data types (basic validation)
    const validDataTypes = [
      'UUID',
      'VARCHAR',
      'TEXT',
      'INTEGER',
      'BIGINT',
      'DECIMAL',
      'NUMERIC',
      'BOOLEAN',
      'DATE',
      'TIMESTAMP',
      'JSON',
      'JSONB',
    ];
    for (const table of tables) {
      for (const column of table.columns) {
        if (!validDataTypes.includes(column.data_type.toUpperCase())) {
          invalidDataTypes.push(`${table.name}.${column.name}: ${column.data_type}`);
          warnings.push(`Potentially invalid data type: ${column.data_type} in ${table.name}.${column.name}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      orphanedRelationships,
      invalidDataTypes,
      duplicateNames,
    };
  }
}

// Export singleton instance
export const validationService = new ValidationService();

