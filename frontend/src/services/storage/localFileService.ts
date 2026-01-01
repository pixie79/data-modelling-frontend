/**
 * Local File Service (Browser)
 * Handles ODCS file I/O operations using browser File API
 */

import { browserFileService } from '@/services/platform/browser';
import { odcsService, type ODCSWorkspace } from '@/services/sdk/odcsService';
import type { Workspace, Domain } from '@/types/workspace';
import type { Table } from '@/types/table';
import type { Relationship } from '@/types/relationship';

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
   *     domain-folder-1/
   *       tables.yaml
   *       relationships.yaml
   *     domain-folder-2/
   *       tables.yaml
   *       relationships.yaml
   */
  private parseFolderStructure(files: FileList): {
    domains: Map<string, { name: string; files: { tables?: File; relationships?: File } }>;
    workspaceName: string;
  } {
    const domains = new Map<string, { name: string; files: { tables?: File; relationships?: File } }>();
    let workspaceName = 'Untitled Workspace';

    // Group files by directory (domain)
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file) {
        continue;
      }

      const pathParts = file.webkitRelativePath.split('/');
      
      if (pathParts.length === 1) {
        // Root level file - skip or use as workspace metadata
        continue;
      }

      // First part is workspace name, second part is domain name
      if (pathParts.length >= 2) {
        const wsName = pathParts[0];
        const domainName = pathParts[1];
        const fileName = pathParts[pathParts.length - 1]?.toLowerCase();

        if (!wsName || !domainName || !fileName) {
          continue;
        }

        workspaceName = wsName;

        if (!domains.has(domainName)) {
          domains.set(domainName, { name: domainName, files: {} });
        }

        const domain = domains.get(domainName);
        if (!domain) {
          continue;
        }
        
        if (fileName === 'tables.yaml' || fileName === 'tables.yml') {
          domain.files.tables = file;
        } else if (fileName === 'relationships.yaml' || fileName === 'relationships.yml') {
          domain.files.relationships = file;
        }
      }
    }

    return { domains, workspaceName };
  }

  /**
   * Load workspace from folder structure
   * Reads domain folders containing tables.yaml and relationships.yaml
   */
  async loadWorkspaceFromFolder(files: FileList): Promise<Workspace> {
    const { domains: domainMap, workspaceName } = this.parseFolderStructure(files);
    
    if (domainMap.size === 0) {
      throw new Error('No domain folders found. Expected structure: workspace-folder/domain-folder/tables.yaml and relationships.yaml');
    }

    const workspaceId = `workspace-${Date.now()}`;
    const domains: Domain[] = [];
    const allTables: Table[] = [];
    const allRelationships: Relationship[] = [];

    // Process each domain folder
    let domainIndex = 0;
    for (const [domainName, domainData] of domainMap.entries()) {
      const domainId = `domain-${workspaceId}-${domainIndex++}`;
      
      // Determine model type from domain name (conceptual, logical, physical)
      let modelType: 'conceptual' | 'logical' | 'physical' = 'conceptual';
      const lowerName = domainName.toLowerCase();
      if (lowerName.includes('logical')) {
        modelType = 'logical';
      } else if (lowerName.includes('physical')) {
        modelType = 'physical';
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

      // Load relationships.yaml if present
      if (domainData.files.relationships) {
        try {
          const relationshipsContent = await browserFileService.readFile(domainData.files.relationships);
          const odcsData = await odcsService.parseYAML(relationshipsContent);
          
          if (odcsData.relationships && Array.isArray(odcsData.relationships)) {
            // Update relationships with workspace and domain IDs
            const domainRelationships = odcsData.relationships.map((rel: any) => ({
              ...rel,
              workspace_id: workspaceId,
              domain_id: domainId,
            }));
            allRelationships.push(...domainRelationships);
          }
        } catch (error) {
          console.warn(`Failed to load relationships.yaml from ${domainName}:`, error);
        }
      }

      // Create domain object
      domains.push({
        id: domainId,
        workspace_id: workspaceId,
        name: domainName,
        model_type: modelType,
        is_primary: domainIndex === 1, // First domain is primary
        created_at: new Date().toISOString(),
        last_modified_at: new Date().toISOString(),
      });
    }

    // Build workspace object
    const workspace: Workspace & { tables?: Table[]; relationships?: Relationship[] } = {
      id: workspaceId,
      name: workspaceName,
      type: 'personal',
      owner_id: 'offline-user',
      created_at: new Date().toISOString(),
      last_modified_at: new Date().toISOString(),
      domains,
    };

    // Store tables and relationships for offline access
    if (allTables.length > 0) {
      (workspace as any).tables = allTables;
    }
    if (allRelationships.length > 0) {
      (workspace as any).relationships = allRelationships;
    }

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
        model_type: 'conceptual',
        is_primary: true,
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
    
    return workspace as Workspace;
  }

  /**
   * Export workspace to file
   */
  async exportWorkspace(workspace: Workspace, filename?: string): Promise<void> {
    return this.saveFile(workspace, filename);
  }
}

// Export singleton instance
export const localFileService = new LocalFileService();

