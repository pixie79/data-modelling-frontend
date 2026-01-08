/**
 * WorkspaceV2 Saver
 * Handles saving flat file format (workspace/v2) workspaces
 */

import { odcsService } from '@/services/sdk/odcsService';
import { odpsService } from '@/services/sdk/odpsService';
import { cadsService } from '@/services/sdk/cadsService';
import { bpmnService } from '@/services/sdk/bpmnService';
import { dmnService } from '@/services/sdk/dmnService';
import * as yaml from 'js-yaml';
import { FileMigration } from '@/utils/fileMigration';
import type { Workspace, WorkspaceV2 } from '@/types/workspace';
import type { Domain } from '@/types/domain';
import type { Table } from '@/types/table';
import type { System } from '@/types/system';
import type { DataProduct } from '@/types/odps';
import type { ComputeAsset } from '@/types/cads';
import type { BPMNProcess } from '@/types/bpmn';
import type { DMNDecision } from '@/types/dmn';

export interface SavedFile {
  name: string;
  content: string;
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
    allProducts: DataProduct[],
    allAssets: ComputeAsset[],
    allBpmnProcesses: BPMNProcess[],
    allDmnDecisions: DMNDecision[]
  ): Promise<SavedFile[]> {
    const files: SavedFile[] = [];

    // Sanitize workspace name for filenames
    const workspaceName = FileMigration.sanitizeFileName(workspace.name);

    // 1. Generate workspace.yaml (v2 format)
    const workspaceV2 = this.convertToWorkspaceV2(workspace, domains, allSystems);
    files.push({
      name: `${workspaceName}.workspace.yaml`,
      content: yaml.dump(workspaceV2, { lineWidth: -1, noRefs: true }),
    });

    console.log(`[WorkspaceV2Saver] Generated workspace.yaml for "${workspace.name}"`);

    // 2. Generate individual resource files
    for (const domain of domains) {
      // Get domain-specific resources
      const domainTables = allTables.filter((t) => t.primary_domain_id === domain.id);
      const domainProducts = allProducts.filter((p) => (p as any).domain_id === domain.id);
      const domainAssets = allAssets.filter((a) => (a as any).domain_id === domain.id);
      const domainProcesses = allBpmnProcesses.filter((p) => (p as any).domain_id === domain.id);
      const domainDecisions = allDmnDecisions.filter((d) => (d as any).domain_id === domain.id);
      const domainSystems = allSystems.filter((s) => (s as any).primary_domain_id === domain.id);

      // Generate ODCS table files
      for (const table of domainTables) {
        const systemName = FileMigration.getSystemName(table, domainSystems);
        const fileName = FileMigration.generateFileName(
          workspaceName,
          domain.name,
          table.name,
          systemName,
          'odcs.yaml'
        );

        try {
          // Wrap single table in workspace format expected by SDK
          const workspace = { tables: [table], relationships: [] };
          const content = await odcsService.toYAML(workspace as any);
          files.push({ name: fileName, content });
        } catch (error) {
          console.error(`[WorkspaceV2Saver] Failed to export table ${table.name}:`, error);
        }
      }

      // Generate ODPS product files
      for (const product of domainProducts) {
        const fileName = FileMigration.generateFileName(
          workspaceName,
          domain.name,
          product.name,
          undefined,
          'odps.yaml'
        );

        try {
          const content = await odpsService.toYAML(product);
          files.push({ name: fileName, content });
        } catch (error) {
          console.error(`[WorkspaceV2Saver] Failed to export product ${product.name}:`, error);
        }
      }

      // Generate CADS asset files
      for (const asset of domainAssets) {
        const systemName = FileMigration.getSystemName(asset, domainSystems);
        const fileName = FileMigration.generateFileName(
          workspaceName,
          domain.name,
          asset.name,
          systemName,
          'cads.yaml'
        );

        try {
          const content = await cadsService.toYAML(asset);
          files.push({ name: fileName, content });
        } catch (error) {
          console.error(`[WorkspaceV2Saver] Failed to export asset ${asset.name}:`, error);
        }
      }

      // Generate BPMN process files
      for (const process of domainProcesses) {
        const fileName = FileMigration.generateFileName(
          workspaceName,
          domain.name,
          process.name,
          undefined,
          'bpmn'
        );

        try {
          const content = await bpmnService.toXML(process);
          files.push({ name: fileName, content });
        } catch (error) {
          console.error(`[WorkspaceV2Saver] Failed to export process ${process.name}:`, error);
        }
      }

      // Generate DMN decision files
      for (const decision of domainDecisions) {
        const fileName = FileMigration.generateFileName(
          workspaceName,
          domain.name,
          decision.name,
          undefined,
          'dmn'
        );

        try {
          const content = await dmnService.toXML(decision);
          files.push({ name: fileName, content });
        } catch (error) {
          console.error(`[WorkspaceV2Saver] Failed to export decision ${decision.name}:`, error);
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
    allSystems: System[]
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
      domains: domains.map((domain) => {
        const domainSystems = allSystems.filter((s) => (s as any).primary_domain_id === domain.id);

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
          })),
        };
      }),
      relationships: [], // TODO: Extract relationships from domains
    };
  }

  /**
   * Save files as ZIP download (browser)
   */
  static async saveAsZip(files: SavedFile[], zipName: string): Promise<void> {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();

    for (const file of files) {
      zip.file(file.name, file.content);
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
   */
  static async saveWithFileSystemAPI(
    files: SavedFile[],
    directoryHandle: FileSystemDirectoryHandle
  ): Promise<void> {
    for (const file of files) {
      try {
        const fileHandle = await directoryHandle.getFileHandle(file.name, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(file.content);
        await writable.close();
      } catch (error) {
        console.error(`[WorkspaceV2Saver] Failed to save ${file.name}:`, error);
        throw error;
      }
    }
  }
}
