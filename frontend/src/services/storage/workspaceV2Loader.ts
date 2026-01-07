/**
 * WorkspaceV2 Loader
 * Handles loading flat file format (workspace/v2) workspaces
 */

import { browserFileService } from '@/services/platform/browser';
import { odcsService } from '@/services/sdk/odcsService';
import { odpsService } from '@/services/sdk/odpsService';
import { cadsService } from '@/services/sdk/cadsService';
import { bpmnService } from '@/services/sdk/bpmnService';
import { dmnService } from '@/services/sdk/dmnService';
import * as yaml from 'js-yaml';
import { FileMigration } from '@/utils/fileMigration';
import type {
  Workspace,
  WorkspaceV2,
  DomainV2,
  CategorizedFiles,
  DomainFiles,
} from '@/types/workspace';
import type { Domain } from '@/types/domain';
import type { Table } from '@/types/table';
import type { DataProduct } from '@/types/odps';
import type { ComputeAsset } from '@/types/cads';
import type { BPMNProcess } from '@/types/bpmn';
import type { DMNDecision } from '@/types/dmn';

export class WorkspaceV2Loader {
  /**
   * Load workspace from flat file format (v2)
   */
  static async loadFromFiles(files: FileList): Promise<Workspace> {
    const fileArray = Array.from(files);

    // 1. Find and parse workspace.yaml
    const workspaceFile = fileArray.find((f) => f.name.endsWith('.workspace.yaml'));

    if (!workspaceFile) {
      throw new Error('No workspace.yaml found in v2 format');
    }

    const workspaceContent = await browserFileService.readFile(workspaceFile);
    const workspaceV2 = yaml.load(workspaceContent) as WorkspaceV2;

    console.log('[WorkspaceV2Loader] Loaded workspace.yaml:', workspaceV2.metadata.name);

    // 2. Categorize remaining files by pattern
    const fileNames = fileArray.map((f) => f.name);
    const categorized = FileMigration.categorizeFiles(fileNames);

    console.log('[WorkspaceV2Loader] Categorized files:', {
      odcs: categorized.odcs.length,
      odps: categorized.odps.length,
      cads: categorized.cads.length,
      bpmn: categorized.bpmn.length,
      dmn: categorized.dmn.length,
    });

    // 3. Load each domain's resources
    const domains: Domain[] = await Promise.all(
      workspaceV2.spec.domains.map(async (domainSpec) => {
        return await this.loadDomain(domainSpec, workspaceV2.metadata.name, fileArray, categorized);
      })
    );

    // 4. Convert WorkspaceV2 to internal Workspace format
    const workspace = FileMigration.convertToInternalFormat(workspaceV2, domains);

    console.log('[WorkspaceV2Loader] Loaded workspace with', domains.length, 'domains');

    return workspace;
  }

  /**
   * Load a single domain's resources from flat files
   */
  private static async loadDomain(
    domainSpec: DomainV2,
    workspaceName: string,
    fileArray: File[],
    categorized: CategorizedFiles
  ): Promise<Domain> {
    // Filter files for this domain
    const domainFiles = this.filterFilesByDomain(
      fileArray,
      categorized,
      workspaceName,
      domainSpec.name
    );

    console.log(`[WorkspaceV2Loader] Loading domain "${domainSpec.name}" with:`, {
      odcs: domainFiles.odcs.length,
      odps: domainFiles.odps.length,
      cads: domainFiles.cads.length,
      bpmn: domainFiles.bpmn.length,
      dmn: domainFiles.dmn.length,
    });

    // Load tables
    const tables = await this.loadTables(domainFiles.odcs, domainSpec);

    // Load products
    const products = await this.loadProducts(domainFiles.odps, domainSpec);

    // Load assets
    const assets = await this.loadAssets(domainFiles.cads, domainSpec);

    // Load processes
    const processes = await this.loadProcesses(domainFiles.bpmn, domainSpec);

    // Load decisions
    const decisions = await this.loadDecisions(domainFiles.dmn, domainSpec);

    // Construct Domain object
    const domain: Domain = {
      id: domainSpec.id,
      workspace_id: '', // Will be set by parent
      name: domainSpec.name,
      description: domainSpec.description,
      owner: domainSpec.owner,
      created_at: domainSpec.created_at || new Date().toISOString(),
      last_modified_at: domainSpec.last_modified_at || new Date().toISOString(),
      systems: domainSpec.systems?.map((s) => s.id),
      tables: tables.map((t) => t.id),
      products: products.map((p) => p.id),
      assets: assets.map((a) => a.id),
      processes: processes.map((p) => p.id),
      decisions: decisions.map((d) => d.id),
      view_positions: domainSpec.view_positions,
    };

    return domain;
  }

  /**
   * Filter files by domain using naming convention
   */
  private static filterFilesByDomain(
    fileArray: File[],
    categorized: CategorizedFiles,
    workspaceName: string,
    domainName: string
  ): DomainFiles {
    const prefix = `${workspaceName}_${domainName}_`.toLowerCase();

    const filterByPrefix = (fileNames: string[]): File[] => {
      return fileArray.filter(
        (f) => fileNames.includes(f.name) && f.name.toLowerCase().startsWith(prefix)
      );
    };

    return {
      odcs: filterByPrefix(categorized.odcs),
      odps: filterByPrefix(categorized.odps),
      cads: filterByPrefix(categorized.cads),
      bpmn: filterByPrefix(categorized.bpmn),
      dmn: filterByPrefix(categorized.dmn),
    };
  }

  /**
   * Load ODCS tables from files
   */
  private static async loadTables(files: File[], domainSpec: DomainV2): Promise<Table[]> {
    const tables: Table[] = [];

    for (const file of files) {
      try {
        const content = await browserFileService.readFile(file);
        const parsed = await odcsService.parseYAML(content);

        // SDK returns ODCSWorkspace with tables array, extract first table
        if (parsed && typeof parsed === 'object' && 'tables' in parsed) {
          const workspace = parsed as any;
          if (workspace.tables && Array.isArray(workspace.tables) && workspace.tables.length > 0) {
            const table = workspace.tables[0];
            table.primary_domain_id = domainSpec.id;
            tables.push(table);
          }
        }
      } catch (error) {
        console.error(`[WorkspaceV2Loader] Failed to load table from ${file.name}:`, error);
      }
    }

    return tables;
  }

  /**
   * Load ODPS products from files
   */
  private static async loadProducts(files: File[], domainSpec: DomainV2): Promise<DataProduct[]> {
    const products: DataProduct[] = [];

    for (const file of files) {
      try {
        const content = await browserFileService.readFile(file);
        const product = await odpsService.parseYAML(content);

        if (product && typeof product === 'object' && 'id' in product) {
          (product as any).domain_id = domainSpec.id;
          products.push(product as DataProduct);
        }
      } catch (error) {
        console.error(`[WorkspaceV2Loader] Failed to load product from ${file.name}:`, error);
      }
    }

    return products;
  }

  /**
   * Load CADS assets from files
   */
  private static async loadAssets(files: File[], domainSpec: DomainV2): Promise<ComputeAsset[]> {
    const assets: ComputeAsset[] = [];

    for (const file of files) {
      try {
        const content = await browserFileService.readFile(file);
        const asset = await cadsService.parseYAML(content);

        if (asset && typeof asset === 'object' && 'id' in asset) {
          (asset as any).domain_id = domainSpec.id;
          assets.push(asset as ComputeAsset);
        }
      } catch (error) {
        console.error(`[WorkspaceV2Loader] Failed to load asset from ${file.name}:`, error);
      }
    }

    return assets;
  }

  /**
   * Load BPMN processes from files
   */
  private static async loadProcesses(files: File[], domainSpec: DomainV2): Promise<BPMNProcess[]> {
    const processes: BPMNProcess[] = [];

    for (const file of files) {
      try {
        const content = await browserFileService.readFile(file);
        const process = await bpmnService.parseXML(content);

        if (process && typeof process === 'object' && 'id' in process) {
          (process as any).domain_id = domainSpec.id;
          processes.push(process as BPMNProcess);
        }
      } catch (error) {
        console.error(`[WorkspaceV2Loader] Failed to load process from ${file.name}:`, error);
      }
    }

    return processes;
  }

  /**
   * Load DMN decisions from files
   */
  private static async loadDecisions(files: File[], domainSpec: DomainV2): Promise<DMNDecision[]> {
    const decisions: DMNDecision[] = [];

    for (const file of files) {
      try {
        const content = await browserFileService.readFile(file);
        const decision = await dmnService.parseXML(content);

        if (decision && typeof decision === 'object' && 'id' in decision) {
          (decision as any).domain_id = domainSpec.id;
          decisions.push(decision as DMNDecision);
        }
      } catch (error) {
        console.error(`[WorkspaceV2Loader] Failed to load decision from ${file.name}:`, error);
      }
    }

    return decisions;
  }
}
