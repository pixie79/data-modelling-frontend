/**
 * ODCS Service
 * Handles ODCS 3.1.0 format operations
 * Supports both online (via API) and offline (via WASM SDK) modes
 */

import { apiClient } from '../api/apiClient';
import { sdkModeDetector } from './sdkMode';
import { sdkLoader } from './sdkLoader';
import * as yaml from 'js-yaml';
import type { Table } from '@/types/table';
import type { Relationship } from '@/types/relationship';
import type { DataFlowDiagram } from '@/types/workspace';

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
   * Parse ODCS YAML content to workspace object
   * Uses API when online, WASM SDK when offline
   */
  async parseYAML(yamlContent: string): Promise<ODCSWorkspace> {
    const mode = await sdkModeDetector.getMode();

    if (mode === 'online') {
      // Use API endpoint (which uses SDK)
      try {
        const response = await apiClient.getClient().post<ImportResult>('/api/v1/import/odcl/text', {
          odcl_text: yamlContent,
        });

        return {
          tables: response.data.tables || [],
          relationships: [],
        };
      } catch (error) {
        throw new Error(
          `Failed to parse ODCS YAML via API: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    } else {
      // Use WASM SDK directly for offline mode, with fallback to basic YAML parser
      try {
        await sdkLoader.load();
        const sdk = sdkLoader.getModule();
        
        // Check if SDK actually has parseYAML method (when WASM bindings are available)
        if (sdk && 'parseODCSYAML' in sdk && typeof (sdk as any).parseODCSYAML === 'function') {
          const result = await (sdk as any).parseODCSYAML(yamlContent);
          return result;
        }
        
        // Fallback: Use basic YAML parser for offline mode
        return this.parseYAMLFallback(yamlContent);
      } catch (error) {
        // If SDK loading fails, try fallback parser
        try {
          return this.parseYAMLFallback(yamlContent);
        } catch (fallbackError) {
          throw new Error(
            `Failed to parse ODCS YAML offline: ${error instanceof Error ? error.message : 'Unknown error'}. Fallback parser also failed: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown error'}`
          );
        }
      }
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
        
        const response = await apiClient.getClient().get<string>(
          `/api/v1/workspaces/${workspaceId}/domains/${domainId}/export`,
          {
            params: {
              format: 'odcl',
            },
          }
        );

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
        if (sdk && 'toODCSYAML' in sdk && typeof (sdk as any).toODCSYAML === 'function') {
          return await (sdk as any).toODCSYAML(workspace);
        }
        
        // Fallback: Use basic YAML conversion for offline mode
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
   * Parses basic ODCS YAML structure
   */
  private parseYAMLFallback(yamlContent: string): ODCSWorkspace {
    try {
      const parsed = yaml.load(yamlContent) as any;
      
      // Extract tables and relationships from parsed YAML
      // ODCS format may vary, so we try common structures
      let tables: Table[] = [];
      let relationships: Relationship[] = [];
      
      // Handle different YAML structures
      if (Array.isArray(parsed)) {
        // If it's an array, assume it's an array of tables
        tables = parsed.map((item: any, index: number) => this.normalizeTable(item, index));
      } else if (parsed && typeof parsed === 'object') {
        // If it's an object, look for tables and relationships properties
        if (parsed.tables && Array.isArray(parsed.tables)) {
          tables = parsed.tables.map((item: any, index: number) => this.normalizeTable(item, index));
        } else if (parsed.entities && Array.isArray(parsed.entities)) {
          // Alternative: entities property
          tables = parsed.entities.map((item: any, index: number) => this.normalizeTable(item, index));
        } else {
          // Try to parse as a single table
          tables = [this.normalizeTable(parsed, 0)];
        }
        
        if (parsed.relationships && Array.isArray(parsed.relationships)) {
          relationships = parsed.relationships.map((item: any, index: number) => this.normalizeRelationship(item, index));
        }
        
        // Parse data flow diagrams if present
        if (parsed.data_flow_diagrams && Array.isArray(parsed.data_flow_diagrams)) {
          return {
            workspace_id: parsed.workspace_id,
            domain_id: parsed.domain_id,
            tables,
            relationships: relationships.length > 0 ? relationships : undefined,
            data_flow_diagrams: parsed.data_flow_diagrams,
          };
        }
      }
      
      return {
        workspace_id: parsed.workspace_id,
        domain_id: parsed.domain_id,
        tables,
        relationships: relationships.length > 0 ? relationships : undefined,
        data_flow_diagrams: [],
      };
    } catch (error) {
      throw new Error(`Failed to parse YAML: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Normalize a table object from YAML to Table type
   */
  private normalizeTable(item: any, index: number): Table {
    const now = new Date().toISOString();
    return {
      id: item.id || `table-${Date.now()}-${index}`,
      workspace_id: item.workspace_id || '',
      primary_domain_id: item.primary_domain_id || item.domain_id || '',
      name: item.name || `Table ${index + 1}`,
      alias: item.alias,
      description: item.description,
      tags: item.tags,
      model_type: item.model_type || 'conceptual',
      columns: Array.isArray(item.columns) 
        ? item.columns.map((col: any, colIndex: number) => ({
            id: col.id || `col-${Date.now()}-${index}-${colIndex}`,
            table_id: item.id || `table-${Date.now()}-${index}`,
            name: col.name || `column_${colIndex + 1}`,
            data_type: col.data_type || col.type || 'VARCHAR',
            nullable: col.nullable ?? false,
            is_primary_key: col.is_primary_key ?? false,
            is_foreign_key: col.is_foreign_key ?? false,
            foreign_key_reference: col.foreign_key_reference,
            default_value: col.default_value,
            constraints: col.constraints,
            order: col.order ?? colIndex,
            created_at: col.created_at || now,
          }))
        : [],
      position_x: item.position_x ?? item.x ?? 0,
      position_y: item.position_y ?? item.y ?? 0,
      width: item.width ?? 200,
      height: item.height ?? 150,
      visible_domains: item.visible_domains || [item.primary_domain_id || item.domain_id || ''],
      created_at: item.created_at || now,
      last_modified_at: item.last_modified_at || now,
    };
  }

  /**
   * Normalize a relationship object from YAML to Relationship type
   */
  private normalizeRelationship(item: any, index: number): Relationship {
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
    
    const relationship: Relationship = {
      id: item.id || `rel-${Date.now()}-${index}`,
      workspace_id: item.workspace_id || '',
      domain_id: item.domain_id || '',
      source_table_id: item.source_table_id || item.from_table_id || item.source || '',
      target_table_id: item.target_table_id || item.to_table_id || item.target || '',
      type: relationshipType,
      source_cardinality: convertCardinality(item.source_cardinality || item.from_cardinality || item.source_optional === false ? '1' : '0'),
      target_cardinality: convertCardinality(item.target_cardinality || item.to_cardinality || item.target_optional === false ? '1' : 'N'),
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
   * Converts workspace to basic ODCS YAML format
   */
  private toYAMLFallback(workspace: ODCSWorkspace): string {
    try {
      const yamlData: any = {
        workspace_id: workspace.workspace_id,
        domain_id: workspace.domain_id,
        tables: workspace.tables || [],
      };
      
      if (workspace.relationships && workspace.relationships.length > 0) {
        yamlData.relationships = workspace.relationships;
      }
      
      if (workspace.data_flow_diagrams && workspace.data_flow_diagrams.length > 0) {
        yamlData.data_flow_diagrams = workspace.data_flow_diagrams.map((diagram) => ({
          id: diagram.id,
          name: diagram.name,
          nodes: diagram.nodes.map((node) => ({
            id: node.id,
            type: node.type,
            label: node.label,
            position_x: node.position_x,
            position_y: node.position_y,
            width: node.width,
            height: node.height,
            metadata: node.metadata,
          })),
          connections: diagram.connections.map((conn) => ({
            id: conn.id,
            source_node_id: conn.source_node_id,
            target_node_id: conn.target_node_id,
            label: conn.label,
            metadata: conn.metadata,
          })),
          linked_tables: diagram.linked_tables,
        }));
      }
      
      return yaml.dump(yamlData, {
        indent: 2,
        lineWidth: 120,
        noRefs: true,
        sortKeys: false,
      });
    } catch (error) {
      throw new Error(`Failed to convert to YAML: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate ODCS format
   * Uses API when online, WASM SDK when offline
   */
  async validate(odcsContent: string | ODCSWorkspace): Promise<{ valid: boolean; errors: string[] }> {
    try {
      // Try parsing to validate
      const content = typeof odcsContent === 'string' ? odcsContent : await this.toYAML(odcsContent);
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
}

// Export singleton instance
export const odcsService = new ODCSService();
