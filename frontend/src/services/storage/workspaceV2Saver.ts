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

    // 1. Generate workspace.yaml (v2 format)
    const workspaceV2 = this.convertToWorkspaceV2(workspace, domains, allSystems, allRelationships);
    files.push({
      name: `${workspaceName}.workspace.yaml`,
      content: yaml.dump(workspaceV2, { lineWidth: -1, noRefs: true }),
    });

    console.log(`[WorkspaceV2Saver] Generated workspace.yaml for "${workspace.name}"`);

    // 2. Generate individual resource files
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

      // Generate ODCS table files
      for (const table of domainTables) {
        const systemName = FileMigration.getSystemName(table, domainSystems);
        const fileName = FileMigration.generateFileName(
          workspaceName,
          domainName,
          table.name,
          systemName,
          'odcs.yaml'
        );

        try {
          // Wrap single table in workspace format expected by SDK
          const tableWorkspace = { tables: [table], relationships: [] };
          const content = await odcsService.toYAML(tableWorkspace as any);
          files.push({ name: fileName, content });
        } catch (error) {
          console.error(`[WorkspaceV2Saver] Failed to export table ${table.name}:`, error);
        }
      }

      // Generate ODPS product files
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
          domainName,
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
          domainName,
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
          domainName,
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

      // Generate KB article files (.kb.yaml)
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
          files.push({ name: fileName, content });
        } catch (error) {
          console.error(`[WorkspaceV2Saver] Failed to export KB article ${article.title}:`, error);
          // Fallback to js-yaml
          try {
            const content = yaml.dump(article, { lineWidth: -1, noRefs: true });
            files.push({ name: fileName, content });
          } catch (fallbackError) {
            console.error(`[WorkspaceV2Saver] Fallback also failed for KB article:`, fallbackError);
          }
        }
      }

      // Generate ADR decision record files (.adr.yaml)
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
          files.push({ name: fileName, content });
        } catch (error) {
          console.error(`[WorkspaceV2Saver] Failed to export ADR ${adr.title}:`, error);
          // Fallback to js-yaml
          try {
            const content = yaml.dump(adr, { lineWidth: -1, noRefs: true });
            files.push({ name: fileName, content });
          } catch (fallbackError) {
            console.error(`[WorkspaceV2Saver] Fallback also failed for ADR:`, fallbackError);
          }
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
          })),
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
      })),
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
