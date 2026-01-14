/**
 * WorkspaceV2 Saver
 * Handles saving flat file format (workspace/v2) workspaces
 */

import { odcsService } from '@/services/sdk/odcsService';
import { odpsService } from '@/services/sdk/odpsService';
import { cadsService } from '@/services/sdk/cadsService';
import { bpmnService } from '@/services/sdk/bpmnService';
import { dmnService } from '@/services/sdk/dmnService';
import { knowledgeService } from '@/services/sdk/knowledgeService';
import { decisionService } from '@/services/sdk/decisionService';
import * as yaml from 'js-yaml';
import { FileMigration } from '@/utils/fileMigration';
import type { Workspace, WorkspaceV2 } from '@/types/workspace';
import type { Domain } from '@/types/domain';
import type { Table } from '@/types/table';
import type { System } from '@/types/system';
import type { Relationship } from '@/types/relationship';
import type { DataProduct } from '@/types/odps';
import type { ComputeAsset } from '@/types/cads';
import type { BPMNProcess } from '@/types/bpmn';
import type { DMNDecision } from '@/types/dmn';
import type { KnowledgeArticle } from '@/types/knowledge';
import type { Decision } from '@/types/decision';

export interface SavedFile {
  name: string;
  content: string;
  directory?: string; // Subdirectory for organizing files by type
}

export class WorkspaceV2Saver {
  /**
   * Convert workspace to v2 format and generate all files
   */
  static async generateFiles(
    workspace: Workspace,
    domains: Domain[],
    allTables: Table[],
    allSystems: System[],
    allRelationships: Relationship[],
    allProducts: DataProduct[],
    allAssets: ComputeAsset[],
    allBpmnProcesses: BPMNProcess[],
    allDmnDecisions: DMNDecision[],
    allKnowledgeArticles: KnowledgeArticle[] = [],
    allDecisionRecords: Decision[] = []
  ): Promise<SavedFile[]> {
    const files: SavedFile[] = [];

    // Sanitize workspace name for filenames
    const workspaceName = FileMigration.sanitizeFileName(workspace.name);

    // 1. Generate workspace.yaml (v2 format) - at root level
    const workspaceV2 = this.convertToWorkspaceV2(workspace, domains, allSystems, allRelationships);
    files.push({
      name: `${workspaceName}.workspace.yaml`,
      content: yaml.dump(workspaceV2, { lineWidth: -1, noRefs: true }),
      directory: '', // Root directory
    });

    // 2. Generate README.md with workspace description
    const readmeContent = this.generateReadme(workspace, workspaceV2);
    files.push({
      name: 'README.md',
      content: readmeContent,
      directory: '', // Root directory
    });

    console.log(
      `[WorkspaceV2Saver] Generated workspace.yaml and README.md for "${workspace.name}"`
    );

    // 3. Generate individual resource files in type-specific subdirectories
    for (const domain of domains) {
      const domainName = FileMigration.sanitizeFileName(domain.name);

      // Get domain-specific resources
      const domainTables = allTables.filter((t) => t.primary_domain_id === domain.id);
      const domainProducts = allProducts.filter((p) => (p as any).domain_id === domain.id);
      const domainAssets = allAssets.filter((a) => (a as any).domain_id === domain.id);
      const domainProcesses = allBpmnProcesses.filter((p) => (p as any).domain_id === domain.id);
      const domainDecisions = allDmnDecisions.filter((d) => (d as any).domain_id === domain.id);
      const domainSystems = allSystems.filter((s) => (s as any).domain_id === domain.id);
      const domainKnowledge = allKnowledgeArticles.filter((k) => k.domain_id === domain.id);
      const domainADRs = allDecisionRecords.filter((d) => d.domain_id === domain.id);

      // Generate ODCS files grouped by system in odcs/ directory
      // Group tables by their system (lookup via system.table_ids)
      const tablesBySystem = new Map<string, Table[]>();
      const tablesWithoutSystem: Table[] = [];

      // Build a reverse lookup: table_id -> system_id
      const tableToSystemMap = new Map<string, string>();
      for (const system of domainSystems) {
        if (system.table_ids) {
          for (const tableId of system.table_ids) {
            tableToSystemMap.set(tableId, system.id);
          }
        }
      }

      for (const table of domainTables) {
        const systemId = tableToSystemMap.get(table.id);
        if (systemId) {
          const existing = tablesBySystem.get(systemId) || [];
          existing.push(table);
          tablesBySystem.set(systemId, existing);
        } else {
          tablesWithoutSystem.push(table);
        }
      }

      // Generate one ODCS file per system (containing all tables for that system)
      for (const [systemId, systemTables] of tablesBySystem) {
        const system = domainSystems.find((s) => s.id === systemId);
        const systemName = system?.name || systemId;
        const fileName = FileMigration.generateFileName(
          workspaceName,
          domainName,
          systemName, // Use system name as the resource name
          undefined, // No need for separate system prefix since it's grouped by system
          'odcs.yaml'
        );

        try {
          // Wrap all system tables in workspace format expected by SDK
          // Include system_id so it becomes the contract.id in the ODCS file
          const tableWorkspace = { tables: systemTables, relationships: [], system_id: systemId };
          const content = await odcsService.toYAML(tableWorkspace as any);
          files.push({ name: fileName, content, directory: 'odcs' });
          console.log(
            `[WorkspaceV2Saver] Generated ODCS file for system "${systemName}" with ${systemTables.length} table(s)`
          );
        } catch (error) {
          console.error(
            `[WorkspaceV2Saver] Failed to export tables for system ${systemName}:`,
            error
          );
        }
      }

      // Generate individual ODCS files for tables without a system
      for (const table of tablesWithoutSystem) {
        const fileName = FileMigration.generateFileName(
          workspaceName,
          domainName,
          table.name,
          undefined,
          'odcs.yaml'
        );

        try {
          const tableWorkspace = { tables: [table], relationships: [] };
          const content = await odcsService.toYAML(tableWorkspace as any);
          files.push({ name: fileName, content, directory: 'odcs' });
        } catch (error) {
          console.error(`[WorkspaceV2Saver] Failed to export table ${table.name}:`, error);
        }
      }

      // Generate ODPS product files in odps/ directory
      for (const product of domainProducts) {
        const fileName = FileMigration.generateFileName(
          workspaceName,
          domainName,
          product.name,
          undefined,
          'odps.yaml'
        );

        try {
          const content = await odpsService.toYAML(product);
          files.push({ name: fileName, content, directory: 'odps' });
        } catch (error) {
          console.error(`[WorkspaceV2Saver] Failed to export product ${product.name}:`, error);
        }
      }

      // Generate CADS asset files in cads/ directory
      for (const asset of domainAssets) {
        const systemName = FileMigration.getSystemName(asset, domainSystems);
        const fileName = FileMigration.generateFileName(
          workspaceName,
          domainName,
          asset.name,
          systemName,
          'cads.yaml'
        );

        try {
          const content = await cadsService.toYAML(asset);
          files.push({ name: fileName, content, directory: 'cads' });
        } catch (error) {
          console.error(`[WorkspaceV2Saver] Failed to export asset ${asset.name}:`, error);
        }
      }

      // Generate BPMN process files in bpmn/ directory
      for (const process of domainProcesses) {
        const fileName = FileMigration.generateFileName(
          workspaceName,
          domainName,
          process.name,
          undefined,
          'bpmn'
        );

        try {
          const content = await bpmnService.toXML(process);
          files.push({ name: fileName, content, directory: 'bpmn' });
        } catch (error) {
          console.error(`[WorkspaceV2Saver] Failed to export process ${process.name}:`, error);
        }
      }

      // Generate DMN decision files in dmn/ directory
      for (const decision of domainDecisions) {
        const fileName = FileMigration.generateFileName(
          workspaceName,
          domainName,
          decision.name,
          undefined,
          'dmn'
        );

        try {
          const content = await dmnService.toXML(decision);
          files.push({ name: fileName, content, directory: 'dmn' });
        } catch (error) {
          console.error(`[WorkspaceV2Saver] Failed to export decision ${decision.name}:`, error);
        }
      }

      // Generate KB article files (.kb.yaml) in kb/ directory
      for (const article of domainKnowledge) {
        const articleName = FileMigration.sanitizeFileName(article.title || `kb_${article.id}`);
        const fileName = FileMigration.generateFileName(
          workspaceName,
          domainName,
          articleName,
          undefined,
          'kb.yaml'
        );

        try {
          // Try SDK export first, fallback to js-yaml
          let content = await knowledgeService.exportKnowledgeToYaml(article);
          if (!content) {
            content = yaml.dump(article, { lineWidth: -1, noRefs: true });
          }
          files.push({ name: fileName, content, directory: 'kb' });
        } catch (error) {
          console.error(`[WorkspaceV2Saver] Failed to export KB article ${article.title}:`, error);
          // Fallback to js-yaml
          try {
            const content = yaml.dump(article, { lineWidth: -1, noRefs: true });
            files.push({ name: fileName, content, directory: 'kb' });
          } catch (fallbackError) {
            console.error(`[WorkspaceV2Saver] Fallback also failed for KB article:`, fallbackError);
          }
        }
      }

      // Generate ADR decision record files (.adr.yaml) in adr/ directory
      for (const adr of domainADRs) {
        const adrName = FileMigration.sanitizeFileName(adr.title || `adr_${adr.id}`);
        const fileName = FileMigration.generateFileName(
          workspaceName,
          domainName,
          adrName,
          undefined,
          'adr.yaml'
        );

        try {
          // Try SDK export first, fallback to js-yaml
          let content = await decisionService.exportDecisionToYaml(adr);
          if (!content) {
            content = yaml.dump(adr, { lineWidth: -1, noRefs: true });
          }
          files.push({ name: fileName, content, directory: 'adr' });
        } catch (error) {
          console.error(`[WorkspaceV2Saver] Failed to export ADR ${adr.title}:`, error);
          // Fallback to js-yaml
          try {
            const content = yaml.dump(adr, { lineWidth: -1, noRefs: true });
            files.push({ name: fileName, content, directory: 'adr' });
          } catch (fallbackError) {
            console.error(`[WorkspaceV2Saver] Fallback also failed for ADR:`, fallbackError);
          }
        }
      }
    }

    // 4. Generate global KB articles (no domain_id) - save with workspace prefix only
    const globalKnowledge = allKnowledgeArticles.filter((k) => !k.domain_id);
    for (const article of globalKnowledge) {
      const articleName = FileMigration.sanitizeFileName(article.title || `kb_${article.id}`);
      const fileName = `${workspaceName}_global_${articleName}.kb.yaml`;

      try {
        let content = await knowledgeService.exportKnowledgeToYaml(article);
        if (!content) {
          content = yaml.dump(article, { lineWidth: -1, noRefs: true });
        }
        files.push({ name: fileName, content, directory: 'kb' });
        console.log(`[WorkspaceV2Saver] Generated global KB article: ${article.title}`);
      } catch (error) {
        console.error(
          `[WorkspaceV2Saver] Failed to export global KB article ${article.title}:`,
          error
        );
        try {
          const content = yaml.dump(article, { lineWidth: -1, noRefs: true });
          files.push({ name: fileName, content, directory: 'kb' });
        } catch (fallbackError) {
          console.error(`[WorkspaceV2Saver] Fallback also failed for global KB:`, fallbackError);
        }
      }
    }

    // 5. Generate global ADRs (no domain_id) - save with workspace prefix only
    const globalADRs = allDecisionRecords.filter((d) => !d.domain_id);
    for (const adr of globalADRs) {
      const adrName = FileMigration.sanitizeFileName(adr.title || `adr_${adr.id}`);
      const fileName = `${workspaceName}_global_${adrName}.adr.yaml`;

      try {
        let content = await decisionService.exportDecisionToYaml(adr);
        if (!content) {
          content = yaml.dump(adr, { lineWidth: -1, noRefs: true });
        }
        files.push({ name: fileName, content, directory: 'adr' });
        console.log(`[WorkspaceV2Saver] Generated global ADR: ${adr.title}`);
      } catch (error) {
        console.error(`[WorkspaceV2Saver] Failed to export global ADR ${adr.title}:`, error);
        try {
          const content = yaml.dump(adr, { lineWidth: -1, noRefs: true });
          files.push({ name: fileName, content, directory: 'adr' });
        } catch (fallbackError) {
          console.error(`[WorkspaceV2Saver] Fallback also failed for global ADR:`, fallbackError);
        }
      }
    }

    console.log(`[WorkspaceV2Saver] Generated ${files.length} files total`);

    return files;
  }

  /**
   * Convert internal Workspace format to WorkspaceV2
   * Matches SDK workspace-schema.json format
   */
  private static convertToWorkspaceV2(
    workspace: Workspace,
    domains: Domain[],
    allSystems: System[],
    allRelationships: Relationship[]
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
      description: workspace.description,
      domains: domains.map((domain) => {
        const domainSystems = allSystems.filter((s) => (s as any).domain_id === domain.id);

        return {
          // Required fields per SDK schema DomainReference
          id: domain.id,
          name: domain.name,
          // Optional fields
          description: domain.description,
          systems: domainSystems.map((s) => ({
            id: s.id,
            name: s.name,
            description: s.description,
            // Include table and asset IDs for system-resource linkage
            ...(s.table_ids && s.table_ids.length > 0 && { table_ids: s.table_ids }),
            ...(s.asset_ids && s.asset_ids.length > 0 && { asset_ids: s.asset_ids }),
          })),
          // Include view-specific positions for nodes (tables, systems, assets) per canvas view
          ...(domain.view_positions &&
            Object.keys(domain.view_positions).length > 0 && {
              view_positions: domain.view_positions,
            }),
        };
      }),
      // Include all relationships at workspace level
      relationships: allRelationships.map((rel) => ({
        id: rel.id,
        // Use source_table_id/target_table_id if available (deprecated fields), otherwise use source_id/target_id
        source_table_id: rel.source_table_id || rel.source_id,
        target_table_id: rel.target_table_id || rel.target_id,
        // Convert internal type format to V2 cardinality format
        cardinality:
          rel.type === 'one-to-one'
            ? 'one_to_one'
            : rel.type === 'one-to-many'
              ? 'one_to_many'
              : 'many_to_many',
        notes: rel.description,
        color: rel.color,
        // Connection point handles for edge positioning on canvas
        ...(rel.source_handle && { source_handle: rel.source_handle }),
        ...(rel.target_handle && { target_handle: rel.target_handle }),
      })),
    };
  }

  /**
   * Generate README.md content for the workspace
   */
  private static generateReadme(workspace: Workspace, workspaceV2: WorkspaceV2): string {
    const description = workspaceV2.description || '';
    const domainCount = workspaceV2.domains?.length || 0;
    const relationshipCount = workspaceV2.relationships?.length || 0;

    return `# ${workspace.name}

${description || '_No description provided._'}

## Overview

This workspace was created with the Data Modelling tool.

- **Domains**: ${domainCount}
- **Relationships**: ${relationshipCount}
- **Created**: ${workspace.created_at}
- **Last Modified**: ${workspaceV2.last_modified_at}

## Directory Structure

\`\`\`
.
├── ${FileMigration.sanitizeFileName(workspace.name)}.workspace.yaml  # Workspace definition
├── README.md                    # This file
├── odcs/                        # Data contracts (ODCS)
├── odps/                        # Data products (ODPS)
├── cads/                        # Compute assets (CADS)
├── bpmn/                        # Business processes (BPMN)
├── dmn/                         # Decision models (DMN)
├── kb/                          # Knowledge base articles
└── adr/                         # Architecture decision records
\`\`\`

## Usage

To load this workspace:
1. Open the Data Modelling application
2. Click "Open" and select this directory
3. All files will be loaded automatically

## Editing

The \`description\` field in this README can be edited directly. The first paragraph
after the title (before "## Overview") is treated as the workspace description and
will be synchronized with the workspace settings.
`;
  }

  /**
   * Save files as ZIP download (browser)
   */
  static async saveAsZip(files: SavedFile[], zipName: string): Promise<void> {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();

    for (const file of files) {
      // Handle directory structure
      const filePath = file.directory ? `${file.directory}/${file.name}` : file.name;
      zip.file(filePath, file.content);
    }

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = zipName;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Save files using File System Access API (if available)
   * Also removes files that no longer exist in the current workspace
   */
  static async saveWithFileSystemAPI(
    files: SavedFile[],
    directoryHandle: FileSystemDirectoryHandle
  ): Promise<void> {
    // Build set of expected file paths (directory/filename or just filename for root)
    const expectedFilePaths = new Set(
      files.map((f) => (f.directory ? `${f.directory}/${f.name}` : f.name))
    );

    // Subdirectories we manage
    const managedDirectories = ['odcs', 'odps', 'cads', 'bpmn', 'dmn', 'kb', 'adr'];

    // Workspace-related file extensions
    const workspaceFileExtensions = [
      '.odcs.yaml',
      '.cads.yaml',
      '.odps.yaml',
      '.bpmn',
      '.dmn',
      '.kb.yaml',
      '.adr.yaml',
      '.workspace.yaml',
    ];

    // Clean up stale files in root directory
    try {
      const filesToDelete: string[] = [];
      const entries = (directoryHandle as any).entries() as AsyncIterableIterator<
        [string, FileSystemHandle]
      >;

      for await (const [name, handle] of entries) {
        if (handle.kind === 'file') {
          // Check if this is a workspace-managed file type in root
          const isWorkspaceFile = workspaceFileExtensions.some((ext) =>
            name.toLowerCase().endsWith(ext)
          );

          // If it's a workspace file but not in our expected files, mark for deletion
          if (isWorkspaceFile && !expectedFilePaths.has(name)) {
            filesToDelete.push(name);
          }
        }
      }

      // Delete stale files from root
      for (const fileName of filesToDelete) {
        try {
          await directoryHandle.removeEntry(fileName);
          console.log(`[WorkspaceV2Saver] Deleted stale file: ${fileName}`);
        } catch (deleteError) {
          console.warn(`[WorkspaceV2Saver] Failed to delete stale file ${fileName}:`, deleteError);
        }
      }

      if (filesToDelete.length > 0) {
        console.log(
          `[WorkspaceV2Saver] Cleaned up ${filesToDelete.length} stale file(s) from root`
        );
      }
    } catch (listError) {
      console.warn('[WorkspaceV2Saver] Could not list root directory for cleanup:', listError);
    }

    // Clean up stale files in subdirectories
    for (const dir of managedDirectories) {
      try {
        const subDirHandle = await directoryHandle.getDirectoryHandle(dir, { create: false });
        const subEntries = (subDirHandle as any).entries() as AsyncIterableIterator<
          [string, FileSystemHandle]
        >;
        const filesToDelete: string[] = [];

        for await (const [name, handle] of subEntries) {
          if (handle.kind === 'file') {
            const fullPath = `${dir}/${name}`;
            if (!expectedFilePaths.has(fullPath)) {
              filesToDelete.push(name);
            }
          }
        }

        for (const fileName of filesToDelete) {
          try {
            await subDirHandle.removeEntry(fileName);
            console.log(`[WorkspaceV2Saver] Deleted stale file: ${dir}/${fileName}`);
          } catch (deleteError) {
            console.warn(
              `[WorkspaceV2Saver] Failed to delete stale file ${dir}/${fileName}:`,
              deleteError
            );
          }
        }
      } catch {
        // Directory doesn't exist yet, that's fine
      }
    }

    // Now write all current files
    for (const file of files) {
      try {
        let targetHandle: FileSystemDirectoryHandle = directoryHandle;

        // If file has a directory, get or create the subdirectory
        if (file.directory) {
          targetHandle = await directoryHandle.getDirectoryHandle(file.directory, { create: true });
        }

        const fileHandle = await targetHandle.getFileHandle(file.name, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(file.content);
        await writable.close();
      } catch (error) {
        const filePath = file.directory ? `${file.directory}/${file.name}` : file.name;
        console.error(`[WorkspaceV2Saver] Failed to save ${filePath}:`, error);
        throw error;
      }
    }

    console.log(`[WorkspaceV2Saver] Saved ${files.length} files with directory structure`);
  }
}
