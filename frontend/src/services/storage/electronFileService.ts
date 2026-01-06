/**
 * Electron File Service
 * Handles ODCS file I/O operations using Electron native file system
 */

import {
  electronFileService as platformFileService,
  type OpenDialogOptions,
  type SaveDialogOptions,
} from '@/services/platform/electron';
import { odcsService } from '@/services/sdk/odcsService';
import { odpsService } from '@/services/sdk/odpsService';
import { cadsService } from '@/services/sdk/cadsService';
import { bpmnService } from '@/services/sdk/bpmnService';
import { dmnService } from '@/services/sdk/dmnService';
import { getPlatform } from '@/services/platform/platform';
import * as yaml from 'js-yaml';
// Legacy data flow diagrams removed - replaced by BPMN processes
import type { Workspace, WorkspaceMetadata } from '@/types/workspace';
import type { Domain as DomainType } from '@/types/domain';
import type { Table } from '@/types/table';
import type { DataProduct } from '@/types/odps';
import type { ComputeAsset } from '@/types/cads';
import type { BPMNProcess } from '@/types/bpmn';
import type { DMNDecision } from '@/types/dmn';
import type { System } from '@/types/system';
import type { Relationship } from '@/types/relationship';
// Helper function to join paths
// Uses simple string concatenation to avoid bundling Node.js 'path' module for browser
// This file is only used in Electron, but Vite tries to bundle it for browser builds
const joinPath = (...segments: string[]): string => {
  // Filter out empty segments and join with '/'
  const filtered = segments.filter(Boolean);
  if (filtered.length === 0) return '';

  // Join segments and normalize separators
  let result = filtered.join('/');
  // Normalize path separators (handle both / and \)
  result = result.replace(/\\/g, '/');
  // Remove duplicate slashes
  result = result.replace(/\/+/g, '/');
  // Remove leading slash if not absolute path
  if (!segments[0]?.startsWith('/') && !segments[0]?.match(/^[A-Z]:/)) {
    result = result.replace(/^\//, '');
  }
  return result;
};

class ElectronFileService {
  /**
   * Read ODCS file from file path
   */
  async readFile(path: string): Promise<Workspace> {
    if (getPlatform() !== 'electron') {
      throw new Error('Electron file service can only be used in Electron environment');
    }

    const content = await platformFileService.readFile(path);
    const odcsWorkspace = await odcsService.parseYAML(content);

    // Update model store with data flow diagrams if present
    if (odcsWorkspace.data_flow_diagrams && odcsWorkspace.data_flow_diagrams.length > 0) {
      // Legacy data flow diagrams removed - replaced by BPMN processes
      // useModelStore.getState().setDataFlowDiagrams(odcsWorkspace.data_flow_diagrams);
    }

    return odcsWorkspace as unknown as Workspace;
  }

  /**
   * Write workspace to ODCS file
   */
  async writeFile(workspace: Workspace, path: string): Promise<void> {
    if (getPlatform() !== 'electron') {
      throw new Error('Electron file service can only be used in Electron environment');
    }

    // Legacy data flow diagrams removed - replaced by BPMN processes
    const yamlContent = await odcsService.toYAML(workspace as any);
    await platformFileService.writeFile(path, yamlContent);
  }

  /**
   * Show open file dialog and read selected file
   */
  async openFile(options?: OpenDialogOptions): Promise<Workspace | null> {
    if (getPlatform() !== 'electron') {
      throw new Error('Electron file service can only be used in Electron environment');
    }

    const defaultOptions: OpenDialogOptions = {
      title: 'Open Workspace',
      filters: [
        { name: 'ODCS Files', extensions: ['yaml', 'yml'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      properties: ['openFile'],
    };

    const result = await platformFileService.showOpenDialog({ ...defaultOptions, ...options });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const filePath = result.filePaths[0];
    if (!filePath) {
      return null;
    }

    return this.readFile(filePath);
  }

  /**
   * Show save file dialog and write workspace
   */
  async saveFile(workspace: Workspace, options?: SaveDialogOptions): Promise<string | null> {
    if (getPlatform() !== 'electron') {
      throw new Error('Electron file service can only be used in Electron environment');
    }

    const defaultOptions: SaveDialogOptions = {
      title: 'Save Workspace',
      filters: [
        { name: 'ODCS Files', extensions: ['yaml', 'yml'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      defaultPath: 'workspace.yaml',
    };

    const result = await platformFileService.showSaveDialog({ ...defaultOptions, ...options });

    if (result.canceled || !result.filePath) {
      return null;
    }

    const filePath = result.filePath;
    await this.writeFile(workspace, filePath);
    return filePath;
  }

  /**
   * Load workspace from file (alias for openFile)
   */
  async loadWorkspace(options?: OpenDialogOptions): Promise<Workspace | null> {
    return this.openFile(options);
  }

  /**
   * Export workspace to file (alias for saveFile)
   */
  async exportWorkspace(workspace: Workspace, options?: SaveDialogOptions): Promise<string | null> {
    return this.saveFile(workspace, options);
  }

  /**
   * Load domain definition from domain.yaml
   * workspacePath: path to workspace root folder
   * domainName: name of domain folder
   */
  async loadDomain(workspacePath: string, domainName: string): Promise<DomainType> {
    if (getPlatform() !== 'electron') {
      throw new Error('Electron file service can only be used in Electron environment');
    }

    const domainYamlPath = joinPath(workspacePath, domainName, 'domain.yaml');
    const content = await platformFileService.readFile(domainYamlPath);
    const parsed = await odcsService.parseYAML(content);
    return parsed as unknown as DomainType;
  }

  /**
   * Load ODCS tables from domain folder
   * Expected: {domain-name}/*.odcs.yaml files
   */
  async loadODCSTables(_workspacePath: string, _domainName: string): Promise<Table[]> {
    // Note: This requires directory listing which may need Electron API extension
    // For now, return empty array - implementation depends on Electron API capabilities
    return [];
  }

  /**
   * Load ODPS products from domain folder
   * Expected: {domain-name}/*.odps.yaml files
   */
  async loadODPSProducts(_workspacePath: string, _domainName: string): Promise<DataProduct[]> {
    // Note: This requires directory listing which may need Electron API extension
    return [];
  }

  /**
   * Load CADS assets from domain folder
   * Expected: {domain-name}/*.cads.yaml files
   */
  async loadCADSAssets(_workspacePath: string, _domainName: string): Promise<ComputeAsset[]> {
    // Note: This requires directory listing which may need Electron API extension
    return [];
  }

  /**
   * Load BPMN processes from domain folder
   * Expected: {domain-name}/*.bpmn files
   */
  async loadBPMNProcesses(_workspacePath: string, _domainName: string): Promise<BPMNProcess[]> {
    // Note: This requires directory listing which may need Electron API extension
    return [];
  }

  /**
   * Load DMN decisions from domain folder
   * Expected: {domain-name}/*.dmn files
   */
  async loadDMNDecisions(_workspacePath: string, _domainName: string): Promise<DMNDecision[]> {
    // Note: This requires directory listing which may need Electron API extension
    return [];
  }

  /**
   * Save domain definition to domain.yaml
   * @param domainPath - Full path to domain folder (e.g., "/path/to/workspace/domain-name")
   * @param domain - Domain object to save
   * @param systems - Systems belonging to this domain
   * @param relationships - Relationships belonging to this domain
   * @param tables - Tables belonging to this domain
   * @param products - Products belonging to this domain
   * @param assets - Assets belonging to this domain
   * @param bpmnProcesses - BPMN processes belonging to this domain
   * @param dmnDecisions - DMN decisions belonging to this domain
   */
  async saveDomain(
    domainPath: string,
    domain: DomainType,
    systems: System[] = [],
    relationships: Relationship[] = [],
    tables: Table[] = [],
    products: DataProduct[] = [],
    assets: ComputeAsset[] = [],
    bpmnProcesses: BPMNProcess[] = [],
    dmnDecisions: DMNDecision[] = []
  ): Promise<void> {
    if (getPlatform() !== 'electron') {
      throw new Error('Electron file service can only be used in Electron environment');
    }

    const domainYamlPath = joinPath(domainPath, 'domain.yaml');

    // Create a domain definition structure for domain.yaml
    // domain.yaml contains domain metadata, systems, relationships, and references to asset files
    const domainDefinition: any = {
      id: domain.id,
      workspace_id: domain.workspace_id,
      name: domain.name,
      description: domain.description || undefined,
      owner: domain.owner || undefined,
      created_at: domain.created_at || new Date().toISOString(),
      last_modified_at: domain.last_modified_at || new Date().toISOString(),
    };

    // Include full systems array (systems are sub-items of domains)
    if (systems.length > 0) {
      domainDefinition.systems = systems;
    }

    // Include full relationships array (relationships are sub-items of domains)
    if (relationships.length > 0) {
      domainDefinition.relationships = relationships;
    }

    // Add arrays of IDs for other assets (tables, products, etc. are in separate files)
    if (tables.length > 0) {
      domainDefinition.tables = tables.map((t) => t.id);
    }
    if (products.length > 0) {
      domainDefinition.products = products.map((p) => p.id);
    }
    if (assets.length > 0) {
      domainDefinition.assets = assets.map((a) => a.id);
    }
    if (bpmnProcesses.length > 0) {
      domainDefinition.processes = bpmnProcesses.map((p) => p.id);
    }
    if (dmnDecisions.length > 0) {
      domainDefinition.decisions = dmnDecisions.map((d) => d.id);
    }

    // Add view_positions if domain has them
    if ((domain as any).view_positions) {
      domainDefinition.view_positions = (domain as any).view_positions;
    }

    // Remove undefined fields to keep YAML clean
    Object.keys(domainDefinition).forEach((key) => {
      if (domainDefinition[key] === undefined) {
        delete domainDefinition[key];
      }
    });

    const yamlContent = yaml.dump(domainDefinition, {
      indent: 2,
      lineWidth: -1, // No line width limit
      quotingType: '"',
      forceQuotes: false,
    });

    await platformFileService.writeFile(domainYamlPath, yamlContent);
  }

  /**
   * Save ODCS table to {systemName_tableName}.odcs.yaml (or {tableName}.odcs.yaml if no system)
   * @param domainPath - Full path to domain folder (e.g., "/path/to/workspace/domain-name")
   * @param domainName - Domain name (for backward compatibility, not used if domainPath is provided)
   * @param table - Table object to save
   * @param systems - Optional array of systems to determine which system owns this table
   */
  async saveODCSTable(
    domainPath: string,
    _domainName: string,
    table: Table,
    systems: System[] = []
  ): Promise<void> {
    if (getPlatform() !== 'electron') {
      throw new Error('Electron file service can only be used in Electron environment');
    }

    // Find which system owns this table (by checking which system has this table.id in its table_ids)
    const owningSystem = systems.find((s) => s.table_ids?.includes(table.id));

    // Ensure table has metadata object
    if (!table.metadata) {
      table.metadata = {};
    }

    // Build filename with system prefix if table belongs to a system
    let systemPrefix = '';
    if (owningSystem) {
      table.metadata.system_id = owningSystem.id;
      systemPrefix = `${owningSystem.name}_`;
      console.log(
        `[ElectronFileService] Saving table "${table.name}" with system_id="${owningSystem.id}" (system: ${owningSystem.name})`
      );
    } else {
      // Remove system_id if table is not linked to any system
      delete table.metadata.system_id;
      console.log(
        `[ElectronFileService] Saving table "${table.name}" without system_id (unlinked)`
      );
    }

    const filename = `${systemPrefix}${table.name}.odcs.yaml`;
    const tableYamlPath = joinPath(domainPath, filename);
    const yamlContent = await odcsService.toYAML({ tables: [table] } as any);
    await platformFileService.writeFile(tableYamlPath, yamlContent);
  }

  /**
   * Save ODPS product to {product-name}.odps.yaml
   * @param domainPath - Full path to domain folder (e.g., "/path/to/workspace/domain-name")
   * @param domainName - Domain name (for backward compatibility, not used if domainPath is provided)
   * @param product - Product object to save
   */
  async saveODPSProduct(
    domainPath: string,
    domainName: string,
    product: DataProduct
  ): Promise<void> {
    if (getPlatform() !== 'electron') {
      throw new Error('Electron file service can only be used in Electron environment');
    }

    // Extract domain name from path if not provided
    const finalDomainName = domainName || domainPath.split('/').pop() || 'unknown';

    const productYamlPath = joinPath(domainPath, `${product.name}.odps.yaml`);
    const yamlContent = await odpsService.toYAML(product, finalDomainName);
    await platformFileService.writeFile(productYamlPath, yamlContent);
  }

  /**
   * Save CADS asset to {systemName_assetName}.cads.yaml (or {assetName}.cads.yaml if no system)
   * @param domainPath - Full path to domain folder (e.g., "/path/to/workspace/domain-name")
   * @param domainName - Domain name (for backward compatibility, not used if domainPath is provided)
   * @param asset - Asset object to save
   * @param systems - Optional array of systems to determine which system owns this asset
   */
  async saveCADSAsset(
    domainPath: string,
    _domainName: string,
    asset: ComputeAsset,
    systems: System[] = []
  ): Promise<void> {
    if (getPlatform() !== 'electron') {
      throw new Error('Electron file service can only be used in Electron environment');
    }

    // Find which system owns this asset (by checking which system has this asset.id in its asset_ids)
    const owningSystem = systems.find((s) => s.asset_ids?.includes(asset.id));

    // Build filename with system prefix if asset belongs to a system
    let systemPrefix = '';
    if (owningSystem) {
      systemPrefix = `${owningSystem.name}_`;
      console.log(
        `[ElectronFileService] Saving asset "${asset.name}" with system: ${owningSystem.name}`
      );
    } else {
      console.log(`[ElectronFileService] Saving asset "${asset.name}" without system (unlinked)`);
    }

    const filename = `${systemPrefix}${asset.name}.cads.yaml`;
    const assetYamlPath = joinPath(domainPath, filename);
    const yamlContent = await cadsService.toYAML(asset);
    await platformFileService.writeFile(assetYamlPath, yamlContent);
  }

  /**
   * Save BPMN process to {process-name}.bpmn
   * @param domainPath - Full path to domain folder (e.g., "/path/to/workspace/domain-name")
   * @param domainName - Domain name (for backward compatibility, not used if domainPath is provided)
   * @param process - BPMN process object to save
   */
  async saveBPMNProcess(
    domainPath: string,
    _domainName: string,
    process: BPMNProcess
  ): Promise<void> {
    if (getPlatform() !== 'electron') {
      throw new Error('Electron file service can only be used in Electron environment');
    }

    // Use process name if available, otherwise fallback to ID-based filename
    const fileName = process.name ? `${process.name}.bpmn` : `process_${process.id}.bpmn`;
    const bpmnPath = joinPath(domainPath, fileName);
    const xmlContent = await bpmnService.toXML(process);
    await platformFileService.writeFile(bpmnPath, xmlContent);
  }

  /**
   * Save DMN decision to {decision-name}.dmn
   * @param domainPath - Full path to domain folder (e.g., "/path/to/workspace/domain-name")
   * @param domainName - Domain name (for backward compatibility, not used if domainPath is provided)
   * @param decision - DMN decision object to save
   */
  async saveDMNDecision(
    domainPath: string,
    _domainName: string,
    decision: DMNDecision
  ): Promise<void> {
    if (getPlatform() !== 'electron') {
      throw new Error('Electron file service can only be used in Electron environment');
    }

    // Use decision name if available, otherwise fallback to ID-based filename
    const fileName = decision.name ? `${decision.name}.dmn` : `decision_${decision.id}.dmn`;
    const dmnPath = joinPath(domainPath, fileName);
    const xmlContent = await dmnService.toXML(decision);
    await platformFileService.writeFile(dmnPath, xmlContent);
  }

  /**
   * Load domain folder structure
   * Loads all files from a domain directory
   */
  async loadDomainFolder(domainPath: string): Promise<{
    domain: DomainType;
    tables: Table[];
    products: DataProduct[];
    assets: ComputeAsset[];
    bpmnProcesses: BPMNProcess[];
    dmnDecisions: DMNDecision[];
    systems: System[];
    relationships: Relationship[];
  }> {
    if (getPlatform() !== 'electron') {
      throw new Error('Electron file service can only be used in Electron environment');
    }

    // Extract workspace path from domain path (parent directory)
    const pathParts = domainPath.split(/[/\\]/).filter(Boolean);
    const domainName = pathParts[pathParts.length - 1];
    const workspacePath = pathParts.slice(0, -1).join('/');

    // Try to load workspace.yaml to get domain ID
    let workspaceMetadata: WorkspaceMetadata | null = null;
    if (workspacePath) {
      try {
        workspaceMetadata = await this.loadWorkspaceMetadata(workspacePath);
      } catch (error) {
        console.log(
          `[ElectronFileService] Could not load workspace.yaml from ${workspacePath}:`,
          error
        );
      }
    }

    // Get domain ID from workspace.yaml if available
    const domainIdFromWorkspace = workspaceMetadata?.domains?.find(
      (d) => d.name === domainName
    )?.id;

    // Load domain.yaml - parse as simple YAML, not ODCS
    // domain.yaml now contains domain metadata, systems, and relationships (merged structure)
    const domainYamlPath = joinPath(domainPath, 'domain.yaml');
    let domain: DomainType;
    let systems: System[] = [];
    let relationships: Relationship[] = [];

    try {
      const domainContent = await platformFileService.readFile(domainYamlPath);
      // Parse domain.yaml as simple YAML, not ODCS format
      const parsed = yaml.load(domainContent) as any;

      // Extract domain metadata - use ID from workspace.yaml if available, then domain.yaml, otherwise generate
      // Preserve domain ID from files even if not a valid UUID (for backward compatibility with old files)
      // Only generate a new UUID if no ID is present at all
      const { generateUUID, isValidUUID } = await import('@/utils/validation');
      const domainId = domainIdFromWorkspace
        ? domainIdFromWorkspace // Use ID from workspace.yaml as-is, even if not a valid UUID
        : parsed?.id
          ? parsed.id // Use ID from domain.yaml as-is, even if not a valid UUID
          : generateUUID(); // Only generate if no ID present
      const source = domainIdFromWorkspace
        ? 'workspace.yaml'
        : parsed?.id
          ? 'domain.yaml'
          : 'generated UUID';
      console.log(
        `[ElectronFileService] Using domain ID for ${domainName}: ${domainId} (from ${source}, isValidUUID: ${isValidUUID(domainId)})`
      );

      domain = {
        id: domainId,
        workspace_id: parsed?.workspace_id || '',
        name: parsed?.name || domainName,
        description: parsed?.description,
        owner: parsed?.owner,
        created_at: parsed?.created_at || new Date().toISOString(),
        last_modified_at: parsed?.last_modified_at || new Date().toISOString(),
        view_positions: parsed?.view_positions || undefined, // Load view-specific positions
      } as DomainType;

      // Extract systems from domain.yaml (merged structure)
      if (parsed?.systems && Array.isArray(parsed.systems)) {
        // Check if it's an array of full system objects or just IDs (backward compatibility)
        if (
          parsed.systems.length > 0 &&
          typeof parsed.systems[0] === 'object' &&
          parsed.systems[0].id
        ) {
          // Full system objects
          systems = parsed.systems;
          console.log(`[ElectronFileService] Loaded ${systems.length} system(s) from domain.yaml`);
        } else {
          // Just IDs - fall back to separate systems.yaml file (backward compatibility)
          console.log(
            `[ElectronFileService] Found system IDs in domain.yaml, checking for systems.yaml (backward compatibility)`
          );
          systems = await this.loadSystems(domainPath);
        }
      } else {
        // No systems in domain.yaml - check for separate systems.yaml (backward compatibility)
        console.log(
          `[ElectronFileService] No systems in domain.yaml, checking for systems.yaml (backward compatibility)`
        );
        systems = await this.loadSystems(domainPath);
      }

      // Extract relationships from domain.yaml (merged structure)
      if (parsed?.relationships && Array.isArray(parsed.relationships)) {
        // Check if it's an array of full relationship objects or just IDs (backward compatibility)
        if (
          parsed.relationships.length > 0 &&
          typeof parsed.relationships[0] === 'object' &&
          parsed.relationships[0].id
        ) {
          // Full relationship objects
          relationships = parsed.relationships;
          console.log(
            `[ElectronFileService] Loaded ${relationships.length} relationship(s) from domain.yaml`
          );
        } else {
          // Just IDs - fall back to separate relationships.yaml file (backward compatibility)
          console.log(
            `[ElectronFileService] Found relationship IDs in domain.yaml, checking for relationships.yaml (backward compatibility)`
          );
          relationships = await this.loadRelationships(domainPath);
        }
      } else {
        // No relationships in domain.yaml - check for separate relationships.yaml (backward compatibility)
        console.log(
          `[ElectronFileService] No relationships in domain.yaml, checking for relationships.yaml (backward compatibility)`
        );
        relationships = await this.loadRelationships(domainPath);
      }
    } catch {
      // If domain.yaml doesn't exist, create a basic domain from folder name
      const pathParts = domainPath.split(/[/\\]/).filter(Boolean);
      const domainName = pathParts[pathParts.length - 1] || 'Unknown Domain';
      domain = {
        id: '',
        workspace_id: '',
        name: domainName,
        created_at: new Date().toISOString(),
        last_modified_at: new Date().toISOString(),
      } as DomainType;

      // Try to load from separate files (backward compatibility)
      systems = await this.loadSystems(domainPath);
      relationships = await this.loadRelationships(domainPath);
    }

    // Load individual files from domain folder
    const tables: Table[] = [];
    const products: DataProduct[] = [];
    const assets: ComputeAsset[] = [];
    const bpmnProcesses: BPMNProcess[] = [];
    const dmnDecisions: DMNDecision[] = [];

    try {
      // List all files in the domain directory
      const files = await platformFileService.readDirectory(domainPath);

      // Load each file based on its extension
      for (const file of files) {
        const fileName = file.name.toLowerCase();

        try {
          if (fileName.endsWith('.odcs.yaml') || fileName.endsWith('.odcs.yml')) {
            // Load ODCS table file
            const content = await platformFileService.readFile(file.path);
            console.log(`[ElectronFileService] Loading ODCS file: ${file.name}`);
            const parsed = await odcsService.parseYAML(content);
            if (parsed.tables && Array.isArray(parsed.tables)) {
              console.log(
                `[ElectronFileService] Loaded ${parsed.tables.length} table(s) from ${file.name}`
              );

              // Try to link tables to systems based on filename or metadata
              const fileNameLower = file.name.toLowerCase();
              console.log(
                `[ElectronFileService] Attempting to link tables from ${file.name} to systems. Available systems:`,
                systems.map((s) => ({ id: s.id, name: s.name }))
              );

              for (const table of parsed.tables) {
                let linked = false;

                // PRIORITY 1: Check table metadata for system_id first (most reliable)
                if (table.metadata?.system_id) {
                  const systemId = table.metadata.system_id;
                  const system = systems.find((s) => s.id === systemId);
                  if (system) {
                    if (!system.table_ids) {
                      system.table_ids = [];
                    }
                    if (!system.table_ids.includes(table.id)) {
                      system.table_ids.push(table.id);
                      console.log(
                        `[ElectronFileService] ✓ Linked table "${table.name || table.id}" to system "${system.name}" (${system.id}) based on metadata.system_id (PRIORITY)`
                      );
                      linked = true;
                    } else {
                      console.log(
                        `[ElectronFileService] Table "${table.name || table.id}" already linked to system "${system.name}" (${system.id})`
                      );
                      linked = true;
                    }
                  } else {
                    console.warn(
                      `[ElectronFileService] Table "${table.name || table.id}" has metadata.system_id="${systemId}" but no matching system found`
                    );
                  }
                }

                // PRIORITY 2: Try to find matching system by name in filename (fallback)
                if (!linked) {
                  for (const system of systems) {
                    const systemNameLower = system.name.toLowerCase().replace(/\s+/g, '');
                    const tableNameLower = (table.name || '').toLowerCase().replace(/\s+/g, '');
                    // Check if system name appears in filename or table name matches system name
                    if (
                      fileNameLower.includes(systemNameLower) ||
                      fileNameLower.includes(system.name.toLowerCase()) ||
                      tableNameLower === systemNameLower ||
                      tableNameLower.includes(systemNameLower) ||
                      systemNameLower.includes(tableNameLower)
                    ) {
                      if (!system.table_ids) {
                        system.table_ids = [];
                      }
                      if (!system.table_ids.includes(table.id)) {
                        system.table_ids.push(table.id);
                        console.log(
                          `[ElectronFileService] ✓ Linked table "${table.name || table.id}" to system "${system.name}" (${system.id}) based on filename/name matching (fallback)`
                        );
                        linked = true;
                        break; // Only link to one system
                      }
                    }
                  }
                }

                // Fallback: If no match found and there are systems, link to the first system
                if (!linked && systems.length > 0) {
                  const fallbackSystem = systems[0];
                  if (fallbackSystem) {
                    if (!fallbackSystem.table_ids) {
                      fallbackSystem.table_ids = [];
                    }
                    if (!fallbackSystem.table_ids.includes(table.id)) {
                      fallbackSystem.table_ids.push(table.id);
                      console.log(
                        `[ElectronFileService] ⚠ Linked table "${table.name || table.id}" to first system "${fallbackSystem.name}" (${fallbackSystem.id}) as fallback (no name match found)`
                      );
                      linked = true;
                    }
                  }
                }

                if (!linked) {
                  console.warn(
                    `[ElectronFileService] ⚠ Could not link table "${table.name || table.id}" to any system. Filename: ${file.name}, Domain has ${systems.length} system(s)`
                  );
                }
              }

              // Log system table_ids after linking
              console.log(
                `[ElectronFileService] System table_ids after linking ${file.name}:`,
                systems.map((s) => ({
                  id: s.id,
                  name: s.name,
                  table_ids: s.table_ids || [],
                  table_count: (s.table_ids || []).length,
                }))
              );

              tables.push(...parsed.tables);
            } else {
              console.warn(`[ElectronFileService] No tables found in ${file.name}`);
            }
          } else if (fileName.endsWith('.odps.yaml') || fileName.endsWith('.odps.yml')) {
            // Load ODPS product file
            const content = await platformFileService.readFile(file.path);
            console.log(`[ElectronFileService] Loading ODPS file: ${file.name}`);
            const parsed = await odpsService.parseYAML(content);
            if (parsed) {
              console.log(
                `[ElectronFileService] Loaded product: ${(parsed as DataProduct).name || 'unnamed'}`
              );
              products.push(parsed as DataProduct);
            }
          } else if (fileName.endsWith('.cads.yaml') || fileName.endsWith('.cads.yml')) {
            // Load CADS asset file
            const content = await platformFileService.readFile(file.path);
            console.log(`[ElectronFileService] Loading CADS file: ${file.name}`);
            const parsed = await cadsService.parseYAML(content);
            if (parsed) {
              console.log(
                `[ElectronFileService] Loaded asset: ${(parsed as ComputeAsset).name || 'unnamed'}`
              );
              assets.push(parsed as ComputeAsset);
            }
          } else if (fileName.endsWith('.bpmn')) {
            // Load BPMN process file
            const content = await platformFileService.readFile(file.path);
            console.log(`[ElectronFileService] Loading BPMN file: ${file.name}`);
            const parsed = await bpmnService.parseXML(content);
            if (parsed) {
              console.log(
                `[ElectronFileService] Loaded BPMN process: ${(parsed as BPMNProcess).name || 'unnamed'}`
              );
              bpmnProcesses.push(parsed as BPMNProcess);
            }
          } else if (fileName.endsWith('.dmn')) {
            // Load DMN decision file
            const content = await platformFileService.readFile(file.path);
            console.log(`[ElectronFileService] Loading DMN file: ${file.name}`);
            const parsed = await dmnService.parseXML(content);
            if (parsed) {
              console.log(
                `[ElectronFileService] Loaded DMN decision: ${(parsed as DMNDecision).name || 'unnamed'}`
              );
              dmnDecisions.push(parsed as DMNDecision);
            }
          }
          // Skip domain.yaml, systems.yaml, relationships.yaml (already loaded)
        } catch (fileError) {
          console.error(`[ElectronFileService] Failed to load file ${file.name}:`, fileError);
          // Continue loading other files even if one fails
        }
      }

      console.log(`[ElectronFileService] Loaded domain folder summary:`, {
        tables: tables.length,
        products: products.length,
        assets: assets.length,
        bpmnProcesses: bpmnProcesses.length,
        dmnDecisions: dmnDecisions.length,
        systems: systems.length,
        relationships: relationships.length,
      });
    } catch (dirError) {
      console.warn(`[ElectronFileService] Failed to list directory ${domainPath}:`, dirError);
      // Continue with empty arrays if directory listing fails
    }

    return {
      domain,
      tables,
      products,
      assets,
      bpmnProcesses,
      dmnDecisions,
      systems,
      relationships,
    };
  }

  /**
   * Save domain folder structure
   * Saves all domain-related files to a folder
   */
  async saveDomainFolder(
    domainPath: string,
    domain: DomainType,
    tables: Table[],
    products: DataProduct[],
    assets: ComputeAsset[],
    bpmnProcesses: BPMNProcess[],
    dmnDecisions: DMNDecision[],
    systems: System[] = [],
    relationships: Relationship[] = []
  ): Promise<void> {
    if (getPlatform() !== 'electron') {
      throw new Error('Electron file service can only be used in Electron environment');
    }

    // Ensure domain directory exists before saving any files
    // The write-file handler will create directories recursively, so we just need to ensure
    // the directory creation is attempted. If ensureDirectory is available, use it;
    // otherwise, rely on the write-file handler to create directories when we write files.
    try {
      // Try to use the dedicated ensureDirectory method if available (requires Electron rebuild)
      if (window.electronAPI && typeof window.electronAPI.ensureDirectory === 'function') {
        await platformFileService.ensureDirectory(domainPath);
        console.log(`[ElectronFileService] Domain directory ensured: ${domainPath}`);
      } else {
        // Fallback: The write-file handler will create directories recursively when we write files
        // So we don't need to do anything here - just log that we're relying on write-file handler
        console.log(
          `[ElectronFileService] Relying on write-file handler to create directory: ${domainPath}`
        );
      }
    } catch (error) {
      // Log the error but don't throw - the write-file handler will attempt to create
      // the directory when we write the first file, and will throw a proper error if it fails
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.warn(
        `[ElectronFileService] Could not pre-create directory (will rely on write-file handler): ${domainPath}`,
        errorMessage
      );
    }

    // Get list of expected file names for current assets
    const expectedFiles = new Set<string>();

    // domain.yaml is always saved
    expectedFiles.add('domain.yaml');

    // Expected table files
    tables.forEach((table) => {
      expectedFiles.add(`${table.name}.odcs.yaml`);
    });

    // Expected product files
    products.forEach((product) => {
      expectedFiles.add(`${product.name}.odps.yaml`);
    });

    // Expected asset files
    assets.forEach((asset) => {
      expectedFiles.add(`${asset.name}.cads.yaml`);
    });

    // Expected BPMN files
    bpmnProcesses.forEach((process) => {
      const fileName = process.name ? `${process.name}.bpmn` : `process_${process.id}.bpmn`;
      expectedFiles.add(fileName);
    });

    // Expected DMN files
    dmnDecisions.forEach((decision) => {
      const fileName = decision.name ? `${decision.name}.dmn` : `decision_${decision.id}.dmn`;
      expectedFiles.add(fileName);
    });

    // List existing files in domain folder and delete orphaned files
    try {
      const existingFiles = await platformFileService.readDirectory(domainPath);
      const filesToDelete: string[] = [];

      for (const file of existingFiles) {
        // Skip domain.yaml, systems.yaml, relationships.yaml (we'll overwrite domain.yaml)
        if (file.name === 'systems.yaml' || file.name === 'relationships.yaml') {
          // Delete old separate files (now merged into domain.yaml)
          filesToDelete.push(file.path);
          console.log(
            `[ElectronFileService] Marking old file for deletion: ${file.name} (now merged into domain.yaml)`
          );
        } else if (!expectedFiles.has(file.name)) {
          // File doesn't correspond to any current asset - mark for deletion
          filesToDelete.push(file.path);
          console.log(`[ElectronFileService] Marking orphaned file for deletion: ${file.name}`);
        }
      }

      // Delete orphaned files
      for (const filePath of filesToDelete) {
        try {
          await platformFileService.deleteFile(filePath);
          console.log(`[ElectronFileService] Deleted orphaned file: ${filePath}`);
        } catch (error) {
          console.warn(`[ElectronFileService] Failed to delete file ${filePath}:`, error);
          // Continue with other files even if one deletion fails
        }
      }
    } catch (error) {
      // If directory listing fails, log warning but continue with save
      console.warn(
        `[ElectronFileService] Could not list directory for cleanup: ${domainPath}`,
        error
      );
    }

    // Save domain.yaml (with systems and relationships - overwrites existing)
    console.log(`[ElectronFileService] Saving domain.yaml (overwriting existing)`);
    await this.saveDomain(
      domainPath,
      domain,
      systems,
      relationships,
      tables,
      products,
      assets,
      bpmnProcesses,
      dmnDecisions
    );

    // Save all tables (overwrites existing files, pass systems so we can save system_id in table metadata)
    console.log(`[ElectronFileService] Saving ${tables.length} table(s) (overwriting existing)`);
    for (const table of tables) {
      await this.saveODCSTable(domainPath, domain.name, table, systems);
    }

    // Save all products (overwrites existing files)
    console.log(
      `[ElectronFileService] Saving ${products.length} product(s) (overwriting existing)`
    );
    for (const product of products) {
      await this.saveODPSProduct(domainPath, domain.name, product);
    }

    // Save all assets (overwrites existing files)
    console.log(`[ElectronFileService] Saving ${assets.length} asset(s) (overwriting existing)`);
    for (const asset of assets) {
      await this.saveCADSAsset(domainPath, domain.name, asset, systems);
    }

    // Save all BPMN processes (overwrites existing files)
    console.log(
      `[ElectronFileService] Saving ${bpmnProcesses.length} BPMN process(es) (overwriting existing)`
    );
    for (const process of bpmnProcesses) {
      await this.saveBPMNProcess(domainPath, domain.name, process);
    }

    // Save all DMN decisions (overwrites existing files)
    console.log(
      `[ElectronFileService] Saving ${dmnDecisions.length} DMN decision(s) (overwriting existing)`
    );
    for (const decision of dmnDecisions) {
      await this.saveDMNDecision(domainPath, domain.name, decision);
    }

    console.log(
      `[ElectronFileService] Successfully saved all domain files (overwritten existing, cleaned orphaned files)`
    );

    // Note: systems and relationships are now saved in domain.yaml (merged structure)
    // We no longer save separate systems.yaml and relationships.yaml files
    // This simplifies domain management as systems and relationships are sub-items of domains
  }

  /**
   * Save workspace.yaml file at workspace root
   * Contains domain IDs to avoid regenerating them on each load
   */
  async saveWorkspaceMetadata(workspacePath: string, workspace: WorkspaceMetadata): Promise<void> {
    if (getPlatform() !== 'electron') {
      throw new Error('Electron file service can only be used in Electron environment');
    }

    const workspaceYamlPath = joinPath(workspacePath, 'workspace.yaml');
    const yamlContent = yaml.dump(workspace, { indent: 2 });

    await platformFileService.writeFile(workspaceYamlPath, yamlContent);
    console.log(`[ElectronFileService] Saved workspace.yaml to ${workspaceYamlPath}`);
  }

  /**
   * Load workspace.yaml file from workspace root
   * Returns null if file doesn't exist (backward compatibility)
   */
  async loadWorkspaceMetadata(workspacePath: string): Promise<WorkspaceMetadata | null> {
    if (getPlatform() !== 'electron') {
      throw new Error('Electron file service can only be used in Electron environment');
    }

    const workspaceYamlPath = joinPath(workspacePath, 'workspace.yaml');

    try {
      const content = await platformFileService.readFile(workspaceYamlPath);
      const parsed = yaml.load(content) as WorkspaceMetadata;
      console.log(`[ElectronFileService] Loaded workspace.yaml from ${workspaceYamlPath}`);
      return parsed;
    } catch {
      // File doesn't exist - backward compatibility
      console.log(
        `[ElectronFileService] workspace.yaml not found at ${workspaceYamlPath} - will generate domain IDs`
      );
      return null;
    }
  }

  /**
   * Save systems to systems.yaml
   * @param domainPath - Full path to domain folder
   * @param systems - Systems to save
   */
  async saveSystems(domainPath: string, systems: System[]): Promise<void> {
    if (getPlatform() !== 'electron') {
      throw new Error('Electron file service can only be used in Electron environment');
    }

    const systemsYamlPath = joinPath(domainPath, 'systems.yaml');
    const systemsData = { systems };
    const yamlContent = yaml.dump(systemsData, {
      indent: 2,
      lineWidth: -1,
      quotingType: '"',
      forceQuotes: false,
    });
    await platformFileService.writeFile(systemsYamlPath, yamlContent);
  }

  /**
   * Save relationships to relationships.yaml
   * @param domainPath - Full path to domain folder
   * @param relationships - Relationships to save (can include table-to-table, system-to-system, etc.)
   */
  async saveRelationships(domainPath: string, relationships: Relationship[]): Promise<void> {
    if (getPlatform() !== 'electron') {
      throw new Error('Electron file service can only be used in Electron environment');
    }

    const relationshipsYamlPath = joinPath(domainPath, 'relationships.yaml');

    console.log(
      `[ElectronFileService] Saving ${relationships.length} relationship(s) to relationships.yaml`
    );
    console.log(
      `[ElectronFileService] Relationship types:`,
      relationships.map((r) => ({
        id: r.id,
        source_type: r.source_type,
        target_type: r.target_type,
        source_id: r.source_id,
        target_id: r.target_id,
      }))
    );

    // Save relationships directly as YAML (not using ODCS service which filters for table-to-table only)
    // Include all relationship types: table-to-table, system-to-system, system-to-table, etc.
    const relationshipsData = { relationships };
    const yamlContent = yaml.dump(relationshipsData, {
      indent: 2,
      lineWidth: -1,
      quotingType: '"',
      forceQuotes: false,
    });

    console.log(`[ElectronFileService] Generated YAML content length: ${yamlContent.length}`);
    await platformFileService.writeFile(relationshipsYamlPath, yamlContent);
  }

  /**
   * Load systems from systems.yaml
   * @param domainPath - Full path to domain folder
   */
  async loadSystems(domainPath: string): Promise<System[]> {
    if (getPlatform() !== 'electron') {
      throw new Error('Electron file service can only be used in Electron environment');
    }

    try {
      const systemsYamlPath = joinPath(domainPath, 'systems.yaml');
      const content = await platformFileService.readFile(systemsYamlPath);
      const parsed = yaml.load(content) as any;
      return Array.isArray(parsed?.systems) ? parsed.systems : [];
    } catch {
      // File doesn't exist or can't be read - return empty array
      return [];
    }
  }

  /**
   * Load relationships from relationships.yaml
   * @param domainPath - Full path to domain folder
   */
  async loadRelationships(domainPath: string): Promise<Relationship[]> {
    if (getPlatform() !== 'electron') {
      throw new Error('Electron file service can only be used in Electron environment');
    }

    try {
      const relationshipsYamlPath = joinPath(domainPath, 'relationships.yaml');
      const content = await platformFileService.readFile(relationshipsYamlPath);

      // Try parsing as simple YAML first (for system-to-system relationships)
      try {
        const parsed = yaml.load(content) as any;
        if (parsed?.relationships && Array.isArray(parsed.relationships)) {
          console.log(
            `[ElectronFileService] Loaded ${parsed.relationships.length} relationship(s) from relationships.yaml`
          );
          return parsed.relationships;
        }
      } catch (yamlError) {
        // If simple YAML parsing fails, try ODCS parser (for table-to-table relationships)
        console.log(
          `[ElectronFileService] Simple YAML parse failed, trying ODCS parser:`,
          yamlError
        );
        const parsed = await odcsService.parseYAML(content);
        if (parsed?.relationships && Array.isArray(parsed.relationships)) {
          console.log(
            `[ElectronFileService] Loaded ${parsed.relationships.length} relationship(s) via ODCS parser`
          );
          return parsed.relationships;
        }
      }

      return [];
    } catch (error) {
      // File doesn't exist or can't be read - return empty array
      console.warn(`[ElectronFileService] Failed to load relationships.yaml:`, error);
      return [];
    }
  }
}

// Export singleton instance
export const electronFileService = new ElectronFileService();
