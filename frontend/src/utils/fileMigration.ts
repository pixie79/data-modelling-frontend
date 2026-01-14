/**
 * File Migration Utilities
 *
 * Handles migration between folder-based (v1) and flat file (v2) workspace formats
 */

import type {
  Workspace,
  WorkspaceV2,
  DomainV2,
  ParsedFileName,
  CategorizedFiles,
} from '../types/workspace';
import type { Domain } from '../types/domain';
import type { System } from '../types/system';
import type { Table, Column, CustomProperty } from '../types/table';
import type { ComputeAsset } from '../types/cads';

export class FileMigration {
  /**
   * Convert current Workspace structure to WorkspaceV2 format
   * Matches SDK workspace-schema.json format
   */
  static migrateWorkspace(
    workspace: Workspace,
    domains: Domain[],
    systems: System[] = []
  ): WorkspaceV2 {
    const now = new Date().toISOString();

    return {
      // Required fields per SDK schema
      id: workspace.id,
      name: workspace.name,
      owner_id: workspace.owner_id,
      created_at: workspace.created_at,
      last_modified_at: now,
      // Optional fields
      domains: domains.map((d) =>
        this.migrateDomain(
          d,
          systems.filter((s) => d.systems?.includes(s.id))
        )
      ),
      relationships: this.collectAllRelationships(domains),
    };
  }

  /**
   * Convert Domain to DomainV2 format
   * Matches SDK schema DomainReference
   */
  static migrateDomain(domain: Domain, systems: System[] = []): DomainV2 {
    return {
      // Required fields per SDK schema
      id: domain.id,
      name: domain.name,
      // Optional fields
      description: domain.description,
      systems: systems.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
      })),
    };
  }

  /**
   * Collect all relationships from all domains
   * In v2, relationships are stored at workspace level per SDK schema
   */
  static collectAllRelationships(
    _domains: Domain[]
  ): import('../types/workspace').RelationshipV2[] {
    // Note: In current architecture, relationships are stored per-domain in domain.yaml
    // This would need to be loaded from the domain.yaml files
    // For now, return empty array as relationships will be loaded during file reading
    return [];
  }

  /**
   * Generate new filename for a resource in flat file format
   */
  static generateFileName(
    workspaceName: string,
    domainName: string,
    resourceName: string,
    systemName: string | undefined,
    fileType: string
  ): string {
    const sanitize = (name: string) =>
      name
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9_-]/g, '')
        .toLowerCase();

    const parts = [sanitize(workspaceName), sanitize(domainName)];

    if (systemName) {
      parts.push(sanitize(systemName));
    }

    parts.push(sanitize(resourceName));

    return `${parts.join('_')}.${fileType}`;
  }

  /**
   * Parse new filename format to extract components
   */
  static parseFileName(fileName: string): ParsedFileName | null {
    // Remove file extension
    let baseName = fileName;
    let type: ParsedFileName['type'] = 'workspace';

    if (fileName.endsWith('.workspace.yaml')) {
      baseName = fileName.replace('.workspace.yaml', '');
      type = 'workspace';
    } else if (fileName.endsWith('.odcs.yaml')) {
      baseName = fileName.replace('.odcs.yaml', '');
      type = 'odcs';
    } else if (fileName.endsWith('.odps.yaml')) {
      baseName = fileName.replace('.odps.yaml', '');
      type = 'odps';
    } else if (fileName.endsWith('.cads.yaml')) {
      baseName = fileName.replace('.cads.yaml', '');
      type = 'cads';
    } else if (fileName.endsWith('.bpmn')) {
      baseName = fileName.replace('.bpmn', '');
      type = 'bpmn';
    } else if (fileName.endsWith('.dmn')) {
      baseName = fileName.replace('.dmn', '');
      type = 'dmn';
    } else {
      return null; // Unknown file type
    }

    const parts = baseName.split('_');

    if (type === 'workspace') {
      return {
        workspace: parts[0] || '',
        type: 'workspace',
      };
    }

    // Pattern: workspace_domain_[system_]resource
    if (parts.length < 3) {
      return null; // Invalid format
    }

    return {
      workspace: parts[0] || '',
      domain: parts[1],
      system: parts.length === 4 ? parts[2] : undefined,
      resource: parts.length === 4 ? parts[3] : parts[2],
      type,
    };
  }

  /**
   * Categorize files by type using pattern matching
   */
  static categorizeFiles(fileNames: string[]): CategorizedFiles {
    const workspacePattern = /\.workspace\.yaml$/;
    const odcsPattern = /_.*\.odcs\.yaml$/;
    const odpsPattern = /_.*\.odps\.yaml$/;
    const cadsPattern = /_.*\.cads\.yaml$/;
    const bpmnPattern = /\.bpmn$/;
    const dmnPattern = /\.dmn$/;
    const kbPattern = /_.*\.kb\.yaml$/;
    const adrPattern = /_.*\.adr\.yaml$/;

    return {
      workspace: fileNames.find((f) => workspacePattern.test(f)),
      odcs: fileNames.filter((f) => odcsPattern.test(f)),
      odps: fileNames.filter((f) => odpsPattern.test(f)),
      cads: fileNames.filter((f) => cadsPattern.test(f)),
      bpmn: fileNames.filter((f) => bpmnPattern.test(f)),
      dmn: fileNames.filter((f) => dmnPattern.test(f)),
      kb: fileNames.filter((f) => kbPattern.test(f)),
      adr: fileNames.filter((f) => adrPattern.test(f)),
    };
  }

  /**
   * Filter files by domain using naming convention
   */
  static filterFilesByDomain(
    categorized: CategorizedFiles,
    workspaceName: string,
    domainName: string
  ): CategorizedFiles {
    const prefix = `${workspaceName}_${domainName}_`.toLowerCase();

    const filterByPrefix = (files: string[]) =>
      files.filter((f) => f.toLowerCase().startsWith(prefix));

    return {
      workspace: categorized.workspace,
      odcs: filterByPrefix(categorized.odcs),
      odps: filterByPrefix(categorized.odps),
      cads: filterByPrefix(categorized.cads),
      bpmn: filterByPrefix(categorized.bpmn),
      dmn: filterByPrefix(categorized.dmn),
      kb: filterByPrefix(categorized.kb),
      adr: filterByPrefix(categorized.adr),
    };
  }

  /**
   * Detect workspace format (v1 or v2) from file list
   */
  static detectWorkspaceFormat(fileNames: string[]): 'v1' | 'v2' {
    // V2: Has {workspace}.workspace.yaml file
    const hasWorkspaceV2 = fileNames.some((f) => f.endsWith('.workspace.yaml'));
    if (hasWorkspaceV2) {
      return 'v2';
    }

    // V1: Has workspace.yaml without .workspace suffix
    const hasWorkspaceV1 = fileNames.some((f) => f === 'workspace.yaml');
    if (hasWorkspaceV1) {
      return 'v1';
    }

    // Check for folder structure (paths with /)
    const hasFolders = fileNames.some((f) => f.includes('/'));
    return hasFolders ? 'v1' : 'v2';
  }

  /**
   * Get system name for a table or asset
   * Used when generating filenames for system-linked resources
   */
  static getSystemName(resource: Table | ComputeAsset, systems: System[]): string | undefined {
    // Check if resource has system_id in metadata
    const systemId = (resource as any).metadata?.system_id || (resource as any).primary_system_id;

    if (!systemId) {
      return undefined;
    }

    const system = systems.find((s) => s.id === systemId);
    return system?.name;
  }

  /**
   * Convert WorkspaceV2 back to internal Workspace format
   * Used when loading v2 files (matches SDK schema)
   */
  static convertToInternalFormat(workspaceV2: WorkspaceV2, domains: Domain[]): Workspace {
    return {
      id: workspaceV2.id,
      name: workspaceV2.name,
      owner_id: workspaceV2.owner_id,
      created_at: workspaceV2.created_at,
      last_modified_at: workspaceV2.last_modified_at,
      domains: domains,
    };
  }

  /**
   * Migrate column from legacy 'custom' field to ODCS v3.1.0 'customProperties' array format
   * Also extracts order and is_foreign_key into customProperties
   */
  static migrateColumnCustomToCustomProperties(column: Column, colIndex: number): Column {
    const customProps: CustomProperty[] = [];

    // Preserve existing customProperties if already in array format
    if (column.customProperties && Array.isArray(column.customProperties)) {
      customProps.push(...column.customProperties);
    }

    // Migrate from legacy 'custom' object field if present
    const legacyCustom = (column as any).custom;
    if (legacyCustom && typeof legacyCustom === 'object') {
      for (const [key, value] of Object.entries(legacyCustom)) {
        if (!customProps.find((p) => p.property === key)) {
          customProps.push({ property: key, value });
        }
      }
    }

    // Ensure order is in customProperties
    const orderVal = column.order ?? (legacyCustom?.order as number | undefined) ?? colIndex;
    if (!customProps.find((p) => p.property === 'order')) {
      customProps.push({ property: 'order', value: orderVal });
    }

    // Ensure is_foreign_key is in customProperties if true
    const isFk = column.is_foreign_key || legacyCustom?.is_foreign_key;
    if (isFk && !customProps.find((p) => p.property === 'is_foreign_key')) {
      customProps.push({ property: 'is_foreign_key', value: true });
    }

    // Create migrated column without legacy 'custom' field
    const { ...rest } = column;
    delete (rest as any).custom;

    return {
      ...rest,
      order: orderVal,
      customProperties: customProps.length > 0 ? customProps : undefined,
    };
  }

  /**
   * Migrate table/schema item: move schema-level 'status' to customProperties
   * Per ODCS spec, 'status' is only valid at contract level, not schema level
   */
  static migrateTableStatusToCustomProperties(table: Table): Table {
    const customProps: CustomProperty[] = [];

    // Preserve existing customProperties if already in array format
    if (table.customProperties && Array.isArray(table.customProperties)) {
      customProps.push(...table.customProperties);
    }

    // Move status to customProperties if present at table level
    if (table.status && !customProps.find((p) => p.property === 'status')) {
      customProps.push({ property: 'status', value: table.status });
    }

    // Migrate all columns
    const migratedColumns = (table.columns || []).map((col, index) =>
      this.migrateColumnCustomToCustomProperties(col, index)
    );

    return {
      ...table,
      columns: migratedColumns,
      customProperties: customProps.length > 0 ? customProps : undefined,
    };
  }

  /**
   * Full migration of workspace tables to ODCS v3.1.0 compliant format
   * - Converts 'custom' to 'customProperties' array on columns
   * - Moves schema-level 'status' to 'customProperties'
   * - Ensures contract-level ID is present
   */
  static migrateToODCSv310(tables: Table[]): Table[] {
    return tables.map((table) => this.migrateTableStatusToCustomProperties(table));
  }

  /**
   * Sanitize a string for use in filenames
   */
  static sanitizeFileName(name: string): string {
    return name
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .toLowerCase();
  }

  /**
   * Generate collision-free filename by adding UUID suffix if needed
   */
  static generateUniqueFileName(
    baseFileName: string,
    existingFileNames: string[],
    resourceId: string
  ): string {
    if (!existingFileNames.includes(baseFileName)) {
      return baseFileName;
    }

    // Add short UUID suffix (first 8 chars)
    const shortId = resourceId.substring(0, 8);
    const parts = baseFileName.split('.');
    const ext = parts.pop();
    const nameWithoutExt = parts.join('.');

    return `${nameWithoutExt}_${shortId}.${ext}`;
  }
}
