/**
 * Local File Service (Browser)
 * Handles ODCS file I/O operations using browser File API
 */

import { browserFileService } from '@/services/platform/browser';
import { odcsService, type ODCSWorkspace } from '@/services/sdk/odcsService';
import { odpsService } from '@/services/sdk/odpsService';
import { cadsService } from '@/services/sdk/cadsService';
import { bpmnService } from '@/services/sdk/bpmnService';
import { dmnService } from '@/services/sdk/dmnService';
import * as yaml from 'js-yaml';
import type { Workspace } from '@/types/workspace';
import type { Domain as DomainType } from '@/types/domain';
import type { Table } from '@/types/table';
import type { Relationship } from '@/types/relationship';
import type { System } from '@/types/system';
import type { DataProduct } from '@/types/odps';
import type { ComputeAsset } from '@/types/cads';
import type { BPMNProcess } from '@/types/bpmn';
import type { DMNDecision } from '@/types/dmn';

class LocalFileService {
  /**
   * Read ODCS file from File object
   * Returns ODCSWorkspace (not Workspace)
   */
  async readFile(file: File): Promise<ODCSWorkspace> {
    const content = await browserFileService.readFile(file);
    return await odcsService.parseYAML(content);
  }

  /**
   * Save workspace to ODCS file (triggers download)
   */
  async saveFile(workspace: Workspace, filename: string = 'workspace.yaml'): Promise<void> {
    // Legacy data flow diagrams removed - replaced by BPMN processes
    const yamlContent = await odcsService.toYAML(workspace as any);
    browserFileService.downloadFile(yamlContent, filename, 'text/yaml');
  }

  /**
   * Pick a file from the file system
   */
  async pickFile(accept: string = '.yaml,.yml,.json'): Promise<File | null> {
    return browserFileService.pickFile(accept);
  }

  /**
   * Pick a folder (workspace directory) from the file system
   */
  async pickFolder(): Promise<FileList | null> {
    return browserFileService.pickFolder();
  }

  /**
   * Parse folder structure to extract workspace data
   * Expected structure:
   *   workspace-folder/
   *     domain-folder-1/        # Domain canvas (e.g., "conceptual", "logical", "physical")
   *       tables.yaml            # ODCS tables specification
   *       relationships.yaml     # ODCS relationships specification
   *     domain-folder-2/
   *       tables.yaml
   *       relationships.yaml
   * 
   * Only YAML files are loaded - all other file types are ignored.
   */
  private parseFolderStructure(files: FileList): {
    domains: Map<string, { 
      name: string; 
      files: { 
        domain?: File;
        tables?: File; 
        relationships?: File; 
        systems?: File;
        odcsFiles?: File[];
        odpsFiles?: File[];
        cadsFiles?: File[];
        bpmnFiles?: File[];
        dmnFiles?: File[];
      } 
    }>;
    workspaceName: string;
  } {
    const domains = new Map<string, { 
      name: string; 
      files: { 
        domain?: File;
        tables?: File; 
        relationships?: File; 
        systems?: File;
        odcsFiles?: File[];
        odpsFiles?: File[];
        cadsFiles?: File[];
        bpmnFiles?: File[];
        dmnFiles?: File[];
      } 
    }>();
    let workspaceName = 'Untitled Workspace';

    // Group files by directory (domain)
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file) {
        continue;
      }

      // Process YAML, BPMN, and DMN files
      const fileName = file.name.toLowerCase();
      const isYAML = fileName.endsWith('.yaml') || fileName.endsWith('.yml');
      const isBPMN = fileName.endsWith('.bpmn');
      const isDMN = fileName.endsWith('.dmn');
      if (!isYAML && !isBPMN && !isDMN) {
        continue; // Skip unsupported file types
      }

      const pathParts = file.webkitRelativePath.split('/');
      
      // Skip root level files - we only want files in domain subfolders
      // A file must be in a subfolder to belong to a domain
      if (pathParts.length < 2) {
        continue;
      }

      // Expected structure: workspace-folder/domain-folder/file.yaml
      // First part is workspace name, second part is domain name (folder), rest is file path
        const wsName = pathParts[0];
        const domainName = pathParts[1];
        const fileBaseName = pathParts[pathParts.length - 1]?.toLowerCase();

        if (!wsName || !domainName || !fileBaseName) {
          continue;
        }

      // Don't treat files as domains - only treat folder names as domains
      // If the "domain name" is actually a file (has extension), skip it
      const domainNameLower = domainName.toLowerCase();
      const isDomainNameAFile = domainNameLower.endsWith('.yaml') || 
                                 domainNameLower.endsWith('.yml') || 
                                 domainNameLower.endsWith('.bpmn') || 
                                 domainNameLower.endsWith('.dmn');
      
      if (isDomainNameAFile) {
        // This is a file at root level, not a domain folder - skip it
          continue;
        }

        workspaceName = wsName;

        // Create domain entry if it doesn't exist
        if (!domains.has(domainName)) {
        domains.set(domainName, { 
          name: domainName, 
          files: {
            odcsFiles: [],
            odpsFiles: [],
            cadsFiles: [],
            bpmnFiles: [],
            dmnFiles: [],
          } 
        });
        }

        const domain = domains.get(domainName);
        if (!domain) {
          continue;
        }
        
      // Load domain.yaml, tables.yaml, relationships.yaml, systems.yaml, and individual asset files
      if (fileBaseName === 'domain.yaml' || fileBaseName === 'domain.yml') {
        domain.files.domain = file;
      } else if (fileBaseName === 'tables.yaml' || fileBaseName === 'tables.yml') {
          domain.files.tables = file;
        } else if (fileBaseName === 'relationships.yaml' || fileBaseName === 'relationships.yml') {
          domain.files.relationships = file;
      } else if (fileBaseName === 'systems.yaml' || fileBaseName === 'systems.yml') {
        domain.files.systems = file;
      } else if (fileBaseName.endsWith('.odcs.yaml') || fileBaseName.endsWith('.odcs.yml')) {
        // Individual ODCS table files
        if (!domain.files.odcsFiles) domain.files.odcsFiles = [];
        domain.files.odcsFiles.push(file);
      } else if (fileBaseName.endsWith('.odps.yaml') || fileBaseName.endsWith('.odps.yml')) {
        // Individual ODPS product files
        if (!domain.files.odpsFiles) domain.files.odpsFiles = [];
        domain.files.odpsFiles.push(file);
      } else if (fileBaseName.endsWith('.cads.yaml') || fileBaseName.endsWith('.cads.yml')) {
        // Individual CADS asset files
        if (!domain.files.cadsFiles) domain.files.cadsFiles = [];
        domain.files.cadsFiles.push(file);
      } else if (fileBaseName.endsWith('.bpmn')) {
        // BPMN process files
        if (!domain.files.bpmnFiles) domain.files.bpmnFiles = [];
        domain.files.bpmnFiles.push(file);
      } else if (fileBaseName.endsWith('.dmn')) {
        // DMN decision files
        if (!domain.files.dmnFiles) domain.files.dmnFiles = [];
        domain.files.dmnFiles.push(file);
      }
      // All other files in domain folders are ignored
    }

    return { domains, workspaceName };
  }

  /**
   * Load workspace from folder structure
   * In offline mode, only loads folders and YAML files into the session.
   * Subfolders represent different domain canvases.
   * YAML files contain resources (ODCS specs, relationships, data-flow diagrams, etc.)
   * 
   * Expected structure:
   *   workspace-folder/
   *     domain-canvas-1/        # Domain canvas (e.g., "conceptual", "logical", "physical")
   *       tables.yaml            # ODCS tables specification
   *       relationships.yaml     # ODCS relationships specification
   *       data-flow.yaml         # Data flow diagrams for this domain (optional)
   *     domain-canvas-2/
   *       tables.yaml
   *       relationships.yaml
   *       data-flow.yaml
   */
  async loadWorkspaceFromFolder(files: FileList): Promise<Workspace> {
    // Parse folder structure - only YAML files are processed
    const { domains: domainMap, workspaceName } = this.parseFolderStructure(files);
    
    if (domainMap.size === 0) {
      throw new Error('No domain folders found. Expected structure: workspace-folder/domain-folder/tables.yaml and relationships.yaml. Only YAML files are loaded.');
    }

    const workspaceId = `workspace-${Date.now()}`;
    const domains: DomainType[] = [];
    const allTables: Table[] = [];
    const allRelationships: Relationship[] = [];
    const allSystems: System[] = [];
    const allProducts: DataProduct[] = [];
    const allAssets: ComputeAsset[] = [];
    const allBpmnProcesses: BPMNProcess[] = [];
    const allDmnDecisions: DMNDecision[] = [];

    // Process each domain folder
    let domainIndex = 0;
    for (const [domainName, domainData] of domainMap.entries()) {
      // Load domain.yaml if present to get the actual domain ID, systems, and relationships
      // domain.yaml now contains domain metadata, systems, and relationships (merged structure)
      let domainMetadata: Partial<DomainType> = {};
      let domainSystems: System[] = [];
      let domainRelationships: Relationship[] = [];
      
      if (domainData.files.domain) {
        try {
          const domainContent = await browserFileService.readFile(domainData.files.domain);
          const parsed = yaml.load(domainContent) as any;
          console.log(`[LocalFileService] Loaded domain.yaml for ${domainName}:`, parsed);
          
          // Extract domain metadata
          domainMetadata = {
            id: parsed?.id,
            name: parsed?.name,
            description: parsed?.description,
            owner: parsed?.owner,
            created_at: parsed?.created_at,
            last_modified_at: parsed?.last_modified_at,
            view_positions: parsed?.view_positions,
          };
          
          // Extract systems from domain.yaml (merged structure)
          if (parsed?.systems && Array.isArray(parsed.systems)) {
            // Check if it's an array of full system objects or just IDs (backward compatibility)
            if (parsed.systems.length > 0 && typeof parsed.systems[0] === 'object' && parsed.systems[0].id) {
              // Full system objects
              domainSystems = parsed.systems.map((system: any) => ({
                ...system,
                workspace_id: workspaceId,
                domain_id: parsed?.id || domainId, // Use domain ID from domain.yaml
              }));
              console.log(`[LocalFileService] Loaded ${domainSystems.length} system(s) from domain.yaml`);
            } else {
              // Just IDs - fall back to separate systems.yaml file (backward compatibility)
              console.log(`[LocalFileService] Found system IDs in domain.yaml, checking for systems.yaml (backward compatibility)`);
            }
          }
          
          // Extract relationships from domain.yaml (merged structure)
          if (parsed?.relationships && Array.isArray(parsed.relationships)) {
            // Check if it's an array of full relationship objects or just IDs (backward compatibility)
            if (parsed.relationships.length > 0 && typeof parsed.relationships[0] === 'object' && parsed.relationships[0].id) {
              // Full relationship objects
              domainRelationships = parsed.relationships.map((rel: any) => ({
                ...rel,
                workspace_id: workspaceId,
                domain_id: parsed?.id || domainId, // Use domain ID from domain.yaml
              }));
              console.log(`[LocalFileService] Loaded ${domainRelationships.length} relationship(s) from domain.yaml`);
            } else {
              // Just IDs - fall back to separate relationships.yaml file (backward compatibility)
              console.log(`[LocalFileService] Found relationship IDs in domain.yaml, checking for relationships.yaml (backward compatibility)`);
            }
          }
        } catch (error) {
          console.warn(`Failed to load domain.yaml from ${domainName}:`, error);
        }
      }

      // Use domain ID from domain.yaml if available, otherwise generate one
      const domainId = domainMetadata.id || `domain-${workspaceId}-${domainIndex++}`;
      console.log(`[LocalFileService] Using domain ID for ${domainName}: ${domainId} (from domain.yaml: ${domainMetadata.id || 'generated'})`);

      // If systems weren't loaded from domain.yaml, try loading from systems.yaml (backward compatibility)
      if (domainSystems.length === 0 && domainData.files.systems) {
        try {
          console.log(`[LocalFileService] Loading systems.yaml from domain: ${domainName} (backward compatibility)`);
          const systemsContent = await browserFileService.readFile(domainData.files.systems);
          const parsed = yaml.load(systemsContent) as any;
          console.log(`[LocalFileService] Parsed systems.yaml:`, parsed);
          if (parsed?.systems && Array.isArray(parsed.systems)) {
            domainSystems = parsed.systems.map((system: any) => ({
              ...system,
              workspace_id: workspaceId,
              domain_id: domainId,
            }));
            console.log(`[LocalFileService] Loaded ${domainSystems.length} system(s) from systems.yaml`);
          } else {
            console.warn(`[LocalFileService] No systems array found in systems.yaml for ${domainName}, parsed:`, parsed);
          }
        } catch (error) {
          console.error(`[LocalFileService] Failed to load systems.yaml from ${domainName}:`, error);
        }
      }
      
      // Add systems to allSystems
      if (domainSystems.length > 0) {
        allSystems.push(...domainSystems);
      }

      // Load tables.yaml if present
      if (domainData.files.tables) {
        try {
          const tablesContent = await browserFileService.readFile(domainData.files.tables);
          const odcsData = await odcsService.parseYAML(tablesContent);
          
          if (odcsData.tables && Array.isArray(odcsData.tables)) {
            // Update tables with workspace and domain IDs
            const domainTables = odcsData.tables.map((table: any) => ({
              ...table,
              workspace_id: workspaceId,
              primary_domain_id: domainId,
              visible_domains: [domainId],
            }));
            allTables.push(...domainTables);
          }
        } catch (error) {
          console.warn(`Failed to load tables.yaml from ${domainName}:`, error);
        }
      }

      // If relationships weren't loaded from domain.yaml, try loading from relationships.yaml (backward compatibility)
      if (domainRelationships.length === 0 && domainData.files.relationships) {
        try {
          console.log(`[LocalFileService] Loading relationships.yaml from domain: ${domainName} (backward compatibility)`);
          console.log(`[LocalFileService] File object:`, {
            name: domainData.files.relationships.name,
            size: domainData.files.relationships.size,
            type: domainData.files.relationships.type,
            lastModified: domainData.files.relationships.lastModified,
          });
          
          // Check if file is empty
          if (domainData.files.relationships.size === 0) {
            console.warn(`[LocalFileService] relationships.yaml is empty (0 bytes) for domain: ${domainName}`);
            // Try to read anyway to see what happens
          }
          
          const relationshipsContent = await browserFileService.readFile(domainData.files.relationships);
          console.log(`[LocalFileService] relationships.yaml content length: ${relationshipsContent.length}`);
          
          if (relationshipsContent.trim().length === 0) {
            console.warn(`[LocalFileService] relationships.yaml is empty (no content) for domain: ${domainName}`);
            // Skip empty files
          } else {
            // Try parsing as simple YAML first (for system-to-system relationships)
            let parsed: any;
            try {
              parsed = yaml.load(relationshipsContent) as any;
              console.log(`[LocalFileService] Parsed relationships.yaml as YAML:`, parsed);
            } catch (yamlError) {
              // If YAML parsing fails, try ODCS parser
              console.log(`[LocalFileService] YAML parse failed, trying ODCS parser:`, yamlError);
              parsed = await odcsService.parseYAML(relationshipsContent);
              console.log(`[LocalFileService] Parsed relationships.yaml via ODCS:`, parsed);
            }
            
            if (parsed?.relationships && Array.isArray(parsed.relationships)) {
            // Update relationships with workspace and domain IDs
              domainRelationships = parsed.relationships.map((rel: any) => ({
              ...rel,
              workspace_id: workspaceId,
              domain_id: domainId,
            }));
              console.log(`[LocalFileService] Loaded ${domainRelationships.length} relationship(s) from relationships.yaml`);
            } else {
              console.warn(`[LocalFileService] No relationships array found in relationships.yaml for ${domainName}, parsed:`, parsed);
            }
          }
        } catch (error) {
          console.error(`[LocalFileService] Failed to load relationships.yaml from ${domainName}:`, error);
          console.error(`[LocalFileService] Error details:`, error instanceof Error ? error.message : String(error));
          console.error(`[LocalFileService] Error stack:`, error instanceof Error ? error.stack : 'No stack');
        }
      }
      
      // Add relationships to allRelationships
      if (domainRelationships.length > 0) {
        allRelationships.push(...domainRelationships);
      }

      // Load individual ODCS table files
      if (domainData.files.odcsFiles && domainData.files.odcsFiles.length > 0) {
        console.log(`[LocalFileService] Loading ${domainData.files.odcsFiles.length} ODCS file(s) from domain: ${domainName}`);
        for (const file of domainData.files.odcsFiles) {
          try {
            console.log(`[LocalFileService] Loading ODCS file: ${file.name}`);
            const content = await browserFileService.readFile(file);
            const parsed = await odcsService.parseYAML(content);
            console.log(`[LocalFileService] Parsed ODCS file ${file.name}:`, parsed);
            if (parsed.tables && Array.isArray(parsed.tables)) {
              const domainTables = parsed.tables.map((table: any) => ({
                ...table,
                workspace_id: workspaceId,
                primary_domain_id: domainId,
                visible_domains: [domainId],
              }));
              console.log(`[LocalFileService] Loaded ${domainTables.length} table(s) from ${file.name}`);
              
              // Try to link tables to systems based on filename or metadata
              // Check if filename contains a system name
              const fileNameLower = file.name.toLowerCase();
              const domainSystems = allSystems.filter(s => s.domain_id === domainId);
              console.log(`[LocalFileService] Attempting to link tables from ${file.name} to systems. Available systems in domain:`, domainSystems.map(s => ({ id: s.id, name: s.name })));
              
              for (const table of domainTables) {
                let linked = false;
                
                // Debug: Log table metadata to see if system_id is present
                console.log(`[LocalFileService] Table "${table.name}" metadata:`, {
                  hasMetadata: !!table.metadata,
                  metadataKeys: table.metadata ? Object.keys(table.metadata) : [],
                  system_id: table.metadata?.system_id,
                  fullMetadata: table.metadata,
                });
                
                // PRIORITY 1: Check table metadata for system_id first (most reliable)
                if (table.metadata?.system_id) {
                  const systemId = table.metadata.system_id;
                  const system = domainSystems.find(s => s.id === systemId);
                  if (system) {
                    if (!system.table_ids) {
                      system.table_ids = [];
                    }
                    if (!system.table_ids.includes(table.id)) {
                      system.table_ids.push(table.id);
                      console.log(`[LocalFileService] ✓ Linked table "${table.name || table.id}" to system "${system.name}" (${system.id}) based on metadata.system_id (PRIORITY)`);
                      linked = true;
                    } else {
                      console.log(`[LocalFileService] Table "${table.name || table.id}" already linked to system "${system.name}" (${system.id})`);
                      linked = true;
                    }
                  } else {
                    console.warn(`[LocalFileService] Table "${table.name || table.id}" has metadata.system_id="${systemId}" but no matching system found in domain`);
                  }
                }
                
                // PRIORITY 2: Try to find matching system by name in filename (fallback)
                if (!linked) {
                  for (const system of domainSystems) {
                    const systemNameLower = system.name.toLowerCase().replace(/\s+/g, '');
                    // Check if system name appears in filename (e.g., "GlobalBetSystem.odcs.yaml" contains "GlobalBetSystem")
                    // Also try matching table name to system name
                    const tableNameLower = (table.name || '').toLowerCase().replace(/\s+/g, '');
                    if (fileNameLower.includes(systemNameLower) || 
                        fileNameLower.includes(system.name.toLowerCase()) ||
                        tableNameLower === systemNameLower ||
                        tableNameLower.includes(systemNameLower) ||
                        systemNameLower.includes(tableNameLower)) {
                      if (!system.table_ids) {
                        system.table_ids = [];
                      }
                      if (!system.table_ids.includes(table.id)) {
                        system.table_ids.push(table.id);
                        console.log(`[LocalFileService] ✓ Linked table "${table.name || table.id}" to system "${system.name}" (${system.id}) based on filename/name matching (fallback)`);
                        linked = true;
                        break; // Only link to one system
                      }
                    }
                  }
                }
                
                // Fallback: If no match found and there are systems in the domain, link to the first system
                if (!linked && domainSystems.length > 0) {
                  const fallbackSystem = domainSystems[0];
                  if (!fallbackSystem.table_ids) {
                    fallbackSystem.table_ids = [];
                  }
                  if (!fallbackSystem.table_ids.includes(table.id)) {
                    fallbackSystem.table_ids.push(table.id);
                    console.log(`[LocalFileService] ⚠ Linked table "${table.name || table.id}" to first system "${fallbackSystem.name}" (${fallbackSystem.id}) as fallback (no name match found)`);
                    linked = true;
                  }
                }
                
                if (!linked) {
                  console.warn(`[LocalFileService] ⚠ Could not link table "${table.name || table.id}" to any system. Filename: ${file.name}, Domain has ${domainSystems.length} system(s)`);
                }
              }
              
              // Log system table_ids after linking
              console.log(`[LocalFileService] System table_ids after linking ${file.name}:`, domainSystems.map(s => ({ 
                id: s.id, 
                name: s.name, 
                table_ids: s.table_ids || [],
                table_count: (s.table_ids || []).length
              })));
              
              allTables.push(...domainTables);
            } else {
              console.warn(`[LocalFileService] No tables found in ODCS file ${file.name}`);
            }
          } catch (error) {
            console.error(`[LocalFileService] Failed to load ODCS file ${file.name}:`, error);
          }
        }
      } else {
        console.log(`[LocalFileService] No ODCS files found for domain: ${domainName}`);
      }

      // Load individual ODPS product files
      if (domainData.files.odpsFiles && domainData.files.odpsFiles.length > 0) {
        console.log(`[LocalFileService] Loading ${domainData.files.odpsFiles.length} ODPS file(s) from domain: ${domainName}`);
        for (const file of domainData.files.odpsFiles) {
          try {
            console.log(`[LocalFileService] Loading ODPS file: ${file.name}`);
            const content = await browserFileService.readFile(file);
            const parsed = await odpsService.parseYAML(content);
            if (parsed) {
              console.log(`[LocalFileService] Loaded ODPS product: ${(parsed as DataProduct).name || 'unnamed'}`);
              allProducts.push({
                ...parsed,
                workspace_id: workspaceId,
                domain_id: domainId,
              } as DataProduct);
            }
          } catch (error) {
            console.error(`[LocalFileService] Failed to load ODPS file ${file.name}:`, error);
          }
        }
      } else {
        console.log(`[LocalFileService] No ODPS files found for domain: ${domainName}`);
      }

      // Load individual CADS asset files
      if (domainData.files.cadsFiles && domainData.files.cadsFiles.length > 0) {
        for (const file of domainData.files.cadsFiles) {
          try {
            const content = await browserFileService.readFile(file);
            const parsed = await cadsService.parseYAML(content);
            if (parsed) {
              allAssets.push({
                ...parsed,
                workspace_id: workspaceId,
                domain_id: domainId,
              } as ComputeAsset);
            }
          } catch (error) {
            console.warn(`Failed to load CADS file ${file.name}:`, error);
          }
        }
      }

      // Load BPMN process files
      if (domainData.files.bpmnFiles && domainData.files.bpmnFiles.length > 0) {
        console.log(`[LocalFileService] Loading ${domainData.files.bpmnFiles.length} BPMN file(s) from domain: ${domainName}`);
        for (const file of domainData.files.bpmnFiles) {
          try {
            console.log(`[LocalFileService] Loading BPMN file: ${file.name}`);
            const content = await browserFileService.readFile(file);
            const parsed = await bpmnService.parseXML(content);
            if (parsed) {
              console.log(`[LocalFileService] Loaded BPMN process: ${(parsed as BPMNProcess).name || 'unnamed'}`);
              allBpmnProcesses.push({
                ...parsed,
                workspace_id: workspaceId,
                domain_id: domainId,
              } as BPMNProcess);
            }
          } catch (error) {
            console.error(`[LocalFileService] Failed to load BPMN file ${file.name}:`, error);
          }
        }
      } else {
        console.log(`[LocalFileService] No BPMN files found for domain: ${domainName}`);
      }

      // Load DMN decision files
      if (domainData.files.dmnFiles && domainData.files.dmnFiles.length > 0) {
        console.log(`[LocalFileService] Loading ${domainData.files.dmnFiles.length} DMN file(s) from domain: ${domainName}`);
        for (const file of domainData.files.dmnFiles) {
          try {
            console.log(`[LocalFileService] Loading DMN file: ${file.name}`);
            const content = await browserFileService.readFile(file);
            const parsed = await dmnService.parseXML(content);
            if (parsed) {
              console.log(`[LocalFileService] Loaded DMN decision: ${(parsed as DMNDecision).name || 'unnamed'}`);
              allDmnDecisions.push({
                ...parsed,
                workspace_id: workspaceId,
                domain_id: domainId,
              } as DMNDecision);
            }
          } catch (error) {
            console.error(`[LocalFileService] Failed to load DMN file ${file.name}:`, error);
          }
        }
      } else {
        console.log(`[LocalFileService] No DMN files found for domain: ${domainName}`);
      }

      // Create domain object (use metadata from domain.yaml if available)
      // IMPORTANT: Use the same domainId that was used for systems/relationships/assets
      const finalDomainId = domainMetadata.id || domainId;
      const domainObject = {
        id: finalDomainId,
        view_positions: domainMetadata.view_positions || undefined, // Load view-specific positions
        workspace_id: workspaceId,
        name: domainMetadata.name || domainName,
        description: domainMetadata.description,
        owner: domainMetadata.owner,
        created_at: domainMetadata.created_at || new Date().toISOString(),
        last_modified_at: domainMetadata.last_modified_at || new Date().toISOString(),
      };
      console.log(`[LocalFileService] Created domain object for ${domainName}:`, domainObject);
      domains.push(domainObject);
    }

    // Build workspace object
    const workspace: Workspace & { 
      tables?: Table[]; 
      relationships?: Relationship[]; 
      systems?: System[];
      products?: DataProduct[];
      assets?: ComputeAsset[];
      bpmnProcesses?: BPMNProcess[];
      dmnDecisions?: DMNDecision[];
    } = {
      id: workspaceId,
      name: workspaceName,
      type: 'personal',
      owner_id: 'offline-user',
      created_at: new Date().toISOString(),
      last_modified_at: new Date().toISOString(),
      domains,
    };

    // Store all loaded assets for offline access
    if (allTables.length > 0) {
      (workspace as any).tables = allTables;
      console.log(`[LocalFileService] Added ${allTables.length} table(s) to workspace`);
    }
    if (allRelationships.length > 0) {
      (workspace as any).relationships = allRelationships;
      console.log(`[LocalFileService] Added ${allRelationships.length} relationship(s) to workspace`);
    }
    if (allSystems.length > 0) {
      (workspace as any).systems = allSystems;
      console.log(`[LocalFileService] Added ${allSystems.length} system(s) to workspace:`, allSystems.map(s => ({ 
        id: s.id, 
        name: s.name, 
        table_ids: s.table_ids || [],
        table_count: (s.table_ids || []).length 
      })));
    } else {
      console.log(`[LocalFileService] No systems to add to workspace (allSystems.length = ${allSystems.length})`);
    }
    if (allProducts.length > 0) {
      (workspace as any).products = allProducts;
      console.log(`[LocalFileService] Added ${allProducts.length} product(s) to workspace`);
    }
    if (allAssets.length > 0) {
      (workspace as any).assets = allAssets;
      console.log(`[LocalFileService] Added ${allAssets.length} asset(s) to workspace`);
    }
    if (allBpmnProcesses.length > 0) {
      (workspace as any).bpmnProcesses = allBpmnProcesses;
      console.log(`[LocalFileService] Added ${allBpmnProcesses.length} BPMN process(es) to workspace`);
    }
    if (allDmnDecisions.length > 0) {
      (workspace as any).dmnDecisions = allDmnDecisions;
      console.log(`[LocalFileService] Added ${allDmnDecisions.length} DMN decision(s) to workspace`);
    }
    
    console.log(`[LocalFileService] Loaded workspace summary:`, {
      domains: domains.length,
      tables: allTables.length,
      relationships: allRelationships.length,
      systems: allSystems.length,
      products: allProducts.length,
      assets: allAssets.length,
      bpmnProcesses: allBpmnProcesses.length,
      dmnDecisions: allDmnDecisions.length,
    });
    
    console.log(`[LocalFileService] Workspace object before return:`, {
      hasTables: !!(workspace as any).tables,
      hasRelationships: !!(workspace as any).relationships,
      hasSystems: !!(workspace as any).systems,
      systemsCount: (workspace as any).systems?.length || 0,
      relationshipsCount: (workspace as any).relationships?.length || 0,
    });

    return workspace as Workspace;
  }

  /**
   * Load workspace from file
   * Converts ODCSWorkspace to Workspace format
   */
  async loadWorkspace(file: File): Promise<Workspace> {
    const odcsWorkspace = await this.readFile(file);
    
    // Convert ODCSWorkspace to Workspace format
    // ODCS files contain tables and relationships, but Workspace needs id, name, etc.
    const workspaceId = odcsWorkspace.workspace_id || `workspace-${Date.now()}`;
    const domainId = odcsWorkspace.domain_id || `domain-${workspaceId}`;
    
    const workspace: Workspace & { tables?: any[]; relationships?: any[] } = {
      id: workspaceId,
      name: file.name.replace(/\.(yaml|yml)$/i, '') || 'Untitled Workspace',
      type: 'personal',
      owner_id: 'offline-user',
      created_at: new Date().toISOString(),
      last_modified_at: new Date().toISOString(),
      domains: [{
        id: domainId,
        workspace_id: workspaceId,
        name: 'Default',
        created_at: new Date().toISOString(),
        last_modified_at: new Date().toISOString(),
      }],
    };
    
    // Store tables and relationships as additional properties for offline access
    if (odcsWorkspace.tables) {
      (workspace as any).tables = odcsWorkspace.tables;
    }
    if (odcsWorkspace.relationships) {
      (workspace as any).relationships = odcsWorkspace.relationships;
    }
    
    // Legacy data flow diagrams removed - replaced by BPMN processes
    
    return workspace as Workspace;
  }

  /**
   * Export workspace to file
   */
  async exportWorkspace(workspace: Workspace, filename?: string): Promise<void> {
    return this.saveFile(workspace, filename);
  }

  /**
   * Load domain definition from domain.yaml
   * Note: In browser mode, this requires the domain folder to be selected via pickFolder
   */
  async loadDomain(_workspaceId: string, _domainId: string): Promise<DomainType> {
    // In browser mode, domains are loaded as part of workspace folder structure
    // This method is primarily for Electron mode where we can access file system directly
    throw new Error('loadDomain not supported in browser mode - use loadWorkspaceFromFolder');
  }

  /**
   * Load ODCS tables from domain folder
   * Expected: {domain-name}/*.odcs.yaml files
   */
  async loadODCSTables(_workspaceId: string, _domainId: string): Promise<Table[]> {
    // In browser mode, tables are loaded as part of workspace folder structure
    throw new Error('loadODCSTables not supported in browser mode - use loadWorkspaceFromFolder');
  }

  /**
   * Load ODPS products from domain folder
   * Expected: {domain-name}/*.odps.yaml files
   */
  async loadODPSProducts(_workspaceId: string, _domainId: string): Promise<DataProduct[]> {
    // In browser mode, products are loaded as part of workspace folder structure
    throw new Error('loadODPSProducts not supported in browser mode - use loadWorkspaceFromFolder');
  }

  /**
   * Load CADS assets from domain folder
   * Expected: {domain-name}/*.cads.yaml files
   */
  async loadCADSAssets(_workspaceId: string, _domainId: string): Promise<ComputeAsset[]> {
    // In browser mode, assets are loaded as part of workspace folder structure
    throw new Error('loadCADSAssets not supported in browser mode - use loadWorkspaceFromFolder');
  }

  /**
   * Load BPMN processes from domain folder
   * Expected: {domain-name}/*.bpmn files
   */
  async loadBPMNProcesses(_workspaceId: string, _domainId: string): Promise<BPMNProcess[]> {
    // In browser mode, processes are loaded as part of workspace folder structure
    throw new Error('loadBPMNProcesses not supported in browser mode - use loadWorkspaceFromFolder');
  }

  /**
   * Load DMN decisions from domain folder
   * Expected: {domain-name}/*.dmn files
   */
  async loadDMNDecisions(_workspaceId: string, _domainId: string): Promise<DMNDecision[]> {
    // In browser mode, decisions are loaded as part of workspace folder structure
    throw new Error('loadDMNDecisions not supported in browser mode - use loadWorkspaceFromFolder');
  }


  /**
   * Save domain definition to domain.yaml
   */
  async saveDomain(_workspaceId: string, domain: DomainType): Promise<void> {
    // In browser mode, saving triggers download
    const yamlContent = await odcsService.toYAML(domain as any);
    browserFileService.downloadFile(yamlContent, `${domain.name}/domain.yaml`, 'text/yaml');
  }

  /**
   * Save ODCS table to {table-name}.odcs.yaml
   */
  async saveODCSTable(_workspaceId: string, _domainId: string, table: Table): Promise<void> {
    const yamlContent = await odcsService.toYAML({ tables: [table] } as any);
    browserFileService.downloadFile(yamlContent, `${table.name}.odcs.yaml`, 'text/yaml');
  }

  /**
   * Save ODPS product to {product-name}.odps.yaml
   */
  async saveODPSProduct(_workspaceId: string, _domainId: string, product: DataProduct): Promise<void> {
    const yamlContent = await odpsService.toYAML(product);
    browserFileService.downloadFile(yamlContent, `${product.name}.odps.yaml`, 'text/yaml');
  }

  /**
   * Save CADS asset to {asset-name}.cads.yaml
   */
  async saveCADSAsset(_workspaceId: string, _domainId: string, asset: ComputeAsset): Promise<void> {
    const yamlContent = await cadsService.toYAML(asset);
    browserFileService.downloadFile(yamlContent, `${asset.name}.cads.yaml`, 'text/yaml');
  }

  /**
   * Save BPMN process to {process-name}.bpmn
   */
  async saveBPMNProcess(_workspaceId: string, _domainId: string, process: BPMNProcess): Promise<void> {
    const xmlContent = await bpmnService.toXML(process);
    browserFileService.downloadFile(xmlContent, `${process.name}.bpmn`, 'application/xml');
  }

  /**
   * Save DMN decision to {decision-name}.dmn
   */
  async saveDMNDecision(_workspaceId: string, _domainId: string, decision: DMNDecision): Promise<void> {
    const xmlContent = await dmnService.toXML(decision);
    browserFileService.downloadFile(xmlContent, `${decision.name}.dmn`, 'application/xml');
  }
}

// Export singleton instance
export const localFileService = new LocalFileService();

