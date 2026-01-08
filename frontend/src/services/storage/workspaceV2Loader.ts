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
import { knowledgeService } from '@/services/sdk/knowledgeService';
import { decisionService } from '@/services/sdk/decisionService';
import * as yaml from 'js-yaml';
import { FileMigration } from '@/utils/fileMigration';
import type {
  Workspace,
  WorkspaceV2,
  DomainV2,
  SystemV2,
  RelationshipV2,
  CategorizedFiles,
  DomainFiles,
} from '@/types/workspace';
import type { Domain } from '@/types/domain';
import type { System } from '@/types/system';
import type { Table } from '@/types/table';
import type { Relationship } from '@/types/relationship';
import type { DataProduct } from '@/types/odps';
import type { ComputeAsset } from '@/types/cads';
import type { BPMNProcess } from '@/types/bpmn';
import type { DMNDecision } from '@/types/dmn';
import type { KnowledgeArticle } from '@/types/knowledge';
import type { Decision } from '@/types/decision';

/**
 * Result of loading a domain with all its resources
 */
interface DomainLoadResult {
  domain: Domain;
  tables: Table[];
  products: DataProduct[];
  assets: ComputeAsset[];
  processes: BPMNProcess[];
  decisions: DMNDecision[];
  systems: System[];
  knowledgeArticles: KnowledgeArticle[];
  decisionRecords: Decision[];
}

export class WorkspaceV2Loader {
  /**
   * Load workspace from flat file format (v2)
   * Matches SDK workspace-schema.json format
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

    // SDK schema uses flat structure with 'name' at root level
    const workspaceName = workspaceV2.name;
    const workspaceId = workspaceV2.id;
    console.log('[WorkspaceV2Loader] Loaded workspace.yaml:', workspaceName);

    // 2. Categorize remaining files by pattern
    const fileNames = fileArray.map((f) => f.name);
    const categorized = FileMigration.categorizeFiles(fileNames);

    console.log('[WorkspaceV2Loader] Categorized files:', {
      odcs: categorized.odcs.length,
      odps: categorized.odps.length,
      cads: categorized.cads.length,
      bpmn: categorized.bpmn.length,
      dmn: categorized.dmn.length,
      kb: categorized.kb.length,
      adr: categorized.adr.length,
    });

    // 3. Load each domain's resources - collect all resources
    const domainsSpec = workspaceV2.domains || [];
    const domainResults: DomainLoadResult[] = await Promise.all(
      domainsSpec.map(async (domainSpec) => {
        return await this.loadDomain(
          domainSpec,
          workspaceName,
          workspaceId,
          fileArray,
          categorized
        );
      })
    );

    // 4. Aggregate all resources from all domains
    const domains: Domain[] = [];
    const allTables: Table[] = [];
    const allProducts: DataProduct[] = [];
    const allAssets: ComputeAsset[] = [];
    const allProcesses: BPMNProcess[] = [];
    const allDecisions: DMNDecision[] = [];
    const allSystems: System[] = [];
    const allKnowledgeArticles: KnowledgeArticle[] = [];
    const allDecisionRecords: Decision[] = [];

    for (const result of domainResults) {
      domains.push(result.domain);
      allTables.push(...result.tables);
      allProducts.push(...result.products);
      allAssets.push(...result.assets);
      allProcesses.push(...result.processes);
      allDecisions.push(...result.decisions);
      allSystems.push(...result.systems);
      allKnowledgeArticles.push(...result.knowledgeArticles);
      allDecisionRecords.push(...result.decisionRecords);
    }

    // 5. Load relationships from workspace.yaml (SDK schema stores them at workspace level)
    const allRelationships: Relationship[] = this.loadRelationships(
      workspaceV2.relationships || [],
      workspaceId
    );

    // 5.5 Set domain_id on relationships based on source table's domain
    // Create a map of table ID to domain ID for quick lookup
    const tableIdToDomainId = new Map<string, string>();
    for (const table of allTables) {
      if (table.id && table.primary_domain_id) {
        tableIdToDomainId.set(table.id, table.primary_domain_id);
      }
    }

    // Update each relationship's domain_id based on its source table
    for (const rel of allRelationships) {
      const sourceTableId = rel.source_table_id || rel.source_id;
      if (sourceTableId) {
        const domainId = tableIdToDomainId.get(sourceTableId);
        if (domainId) {
          rel.domain_id = domainId;
        } else {
          // Fallback: try target table
          const targetTableId = rel.target_table_id || rel.target_id;
          if (targetTableId) {
            const targetDomainId = tableIdToDomainId.get(targetTableId);
            if (targetDomainId) {
              rel.domain_id = targetDomainId;
            }
          }
        }
      }
    }

    console.log(
      `[WorkspaceV2Loader] Set domain_id on ${allRelationships.filter((r) => r.domain_id).length}/${allRelationships.length} relationship(s)`
    );

    // 6. Build workspace object with all resources attached (like V1 loader does)
    const workspace: Workspace & {
      tables?: Table[];
      relationships?: Relationship[];
      systems?: System[];
      products?: DataProduct[];
      assets?: ComputeAsset[];
      bpmnProcesses?: BPMNProcess[];
      dmnDecisions?: DMNDecision[];
      knowledgeArticles?: KnowledgeArticle[];
      decisionRecords?: Decision[];
    } = {
      id: workspaceId,
      name: workspaceName,
      owner_id: workspaceV2.owner_id || 'offline-user',
      created_at: workspaceV2.created_at || new Date().toISOString(),
      last_modified_at: workspaceV2.last_modified_at || new Date().toISOString(),
      domains,
    };

    // Attach all loaded resources to workspace
    if (allTables.length > 0) {
      workspace.tables = allTables;
      console.log(`[WorkspaceV2Loader] Added ${allTables.length} table(s) to workspace`);
    }
    if (allRelationships.length > 0) {
      workspace.relationships = allRelationships;
      console.log(
        `[WorkspaceV2Loader] Added ${allRelationships.length} relationship(s) to workspace`
      );
    }
    if (allSystems.length > 0) {
      workspace.systems = allSystems;
      console.log(`[WorkspaceV2Loader] Added ${allSystems.length} system(s) to workspace`);
    }
    if (allProducts.length > 0) {
      workspace.products = allProducts;
      console.log(`[WorkspaceV2Loader] Added ${allProducts.length} product(s) to workspace`);
    }
    if (allAssets.length > 0) {
      workspace.assets = allAssets;
      console.log(`[WorkspaceV2Loader] Added ${allAssets.length} asset(s) to workspace`);
    }
    if (allProcesses.length > 0) {
      workspace.bpmnProcesses = allProcesses;
      console.log(`[WorkspaceV2Loader] Added ${allProcesses.length} BPMN process(es) to workspace`);
    }
    if (allDecisions.length > 0) {
      workspace.dmnDecisions = allDecisions;
      console.log(`[WorkspaceV2Loader] Added ${allDecisions.length} DMN decision(s) to workspace`);
    }
    if (allKnowledgeArticles.length > 0) {
      workspace.knowledgeArticles = allKnowledgeArticles;
      console.log(
        `[WorkspaceV2Loader] Added ${allKnowledgeArticles.length} knowledge article(s) to workspace`
      );
    }
    if (allDecisionRecords.length > 0) {
      workspace.decisionRecords = allDecisionRecords;
      console.log(
        `[WorkspaceV2Loader] Added ${allDecisionRecords.length} decision record(s) to workspace`
      );
    }

    console.log('[WorkspaceV2Loader] Loaded workspace with', domains.length, 'domains');
    console.log('[WorkspaceV2Loader] Workspace summary:', {
      domains: domains.length,
      tables: allTables.length,
      relationships: allRelationships.length,
      systems: allSystems.length,
      products: allProducts.length,
      assets: allAssets.length,
      bpmnProcesses: allProcesses.length,
      dmnDecisions: allDecisions.length,
      knowledgeArticles: allKnowledgeArticles.length,
      decisionRecords: allDecisionRecords.length,
    });

    return workspace;
  }

  /**
   * Load workspace from pre-loaded file contents (for bundled examples)
   * Accepts an array of {name, content} objects instead of File objects
   */
  static async loadFromStringFiles(
    files: Array<{ name: string; content: string }>
  ): Promise<Workspace> {
    // 1. Find and parse workspace.yaml
    const workspaceFile = files.find((f) => f.name.endsWith('.workspace.yaml'));

    if (!workspaceFile) {
      throw new Error('No workspace.yaml found in v2 format');
    }

    const workspaceV2 = yaml.load(workspaceFile.content) as WorkspaceV2;

    const workspaceName = workspaceV2.name;
    const workspaceId = workspaceV2.id;
    console.log('[WorkspaceV2Loader] Loaded workspace from strings:', workspaceName);

    // 2. Categorize files by pattern
    const fileNames = files.map((f) => f.name);
    const categorized = FileMigration.categorizeFiles(fileNames);

    console.log('[WorkspaceV2Loader] Categorized string files:', {
      odcs: categorized.odcs.length,
      odps: categorized.odps.length,
      cads: categorized.cads.length,
      bpmn: categorized.bpmn.length,
      dmn: categorized.dmn.length,
      kb: categorized.kb.length,
      adr: categorized.adr.length,
    });

    // 3. Load each domain's resources
    const domainsSpec = workspaceV2.domains || [];
    const domainResults: DomainLoadResult[] = await Promise.all(
      domainsSpec.map(async (domainSpec) => {
        return await this.loadDomainFromStrings(
          domainSpec,
          workspaceName,
          workspaceId,
          files,
          categorized
        );
      })
    );

    // 4. Aggregate all resources from all domains
    const domains: Domain[] = [];
    const allTables: Table[] = [];
    const allProducts: DataProduct[] = [];
    const allAssets: ComputeAsset[] = [];
    const allProcesses: BPMNProcess[] = [];
    const allDecisions: DMNDecision[] = [];
    const allSystems: System[] = [];
    const allKnowledgeArticles: KnowledgeArticle[] = [];
    const allDecisionRecords: Decision[] = [];

    for (const result of domainResults) {
      domains.push(result.domain);
      allTables.push(...result.tables);
      allProducts.push(...result.products);
      allAssets.push(...result.assets);
      allProcesses.push(...result.processes);
      allDecisions.push(...result.decisions);
      allSystems.push(...result.systems);
      allKnowledgeArticles.push(...result.knowledgeArticles);
      allDecisionRecords.push(...result.decisionRecords);
    }

    // 5. Load relationships
    const allRelationships: Relationship[] = this.loadRelationships(
      workspaceV2.relationships || [],
      workspaceId
    );

    // Set domain_id on relationships
    const tableIdToDomainId = new Map<string, string>();
    for (const table of allTables) {
      if (table.id && table.primary_domain_id) {
        tableIdToDomainId.set(table.id, table.primary_domain_id);
      }
    }

    for (const rel of allRelationships) {
      const sourceTableId = rel.source_table_id || rel.source_id;
      if (sourceTableId) {
        const domainId = tableIdToDomainId.get(sourceTableId);
        if (domainId) {
          rel.domain_id = domainId;
        }
      }
    }

    // 6. Build workspace object
    const workspace: Workspace & {
      tables?: Table[];
      relationships?: Relationship[];
      systems?: System[];
      products?: DataProduct[];
      assets?: ComputeAsset[];
      bpmnProcesses?: BPMNProcess[];
      dmnDecisions?: DMNDecision[];
      knowledgeArticles?: KnowledgeArticle[];
      decisionRecords?: Decision[];
    } = {
      id: workspaceId,
      name: workspaceName,
      owner_id: workspaceV2.owner_id || 'example-user',
      created_at: workspaceV2.created_at || new Date().toISOString(),
      last_modified_at: workspaceV2.last_modified_at || new Date().toISOString(),
      domains,
    };

    // Attach all loaded resources
    if (allTables.length > 0) workspace.tables = allTables;
    if (allRelationships.length > 0) workspace.relationships = allRelationships;
    if (allSystems.length > 0) workspace.systems = allSystems;
    if (allProducts.length > 0) workspace.products = allProducts;
    if (allAssets.length > 0) workspace.assets = allAssets;
    if (allProcesses.length > 0) workspace.bpmnProcesses = allProcesses;
    if (allDecisions.length > 0) workspace.dmnDecisions = allDecisions;
    if (allKnowledgeArticles.length > 0) workspace.knowledgeArticles = allKnowledgeArticles;
    if (allDecisionRecords.length > 0) workspace.decisionRecords = allDecisionRecords;

    console.log('[WorkspaceV2Loader] Loaded workspace from strings:', {
      domains: domains.length,
      tables: allTables.length,
      relationships: allRelationships.length,
      systems: allSystems.length,
    });

    return workspace;
  }

  /**
   * Load a single domain's resources from flat files
   */
  private static async loadDomain(
    domainSpec: DomainV2,
    workspaceName: string,
    workspaceId: string,
    fileArray: File[],
    categorized: CategorizedFiles
  ): Promise<DomainLoadResult> {
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
      kb: domainFiles.kb.length,
      adr: domainFiles.adr.length,
    });

    // Load tables
    const tables = await this.loadTables(domainFiles.odcs, domainSpec, workspaceId);

    // Load products
    const products = await this.loadProducts(domainFiles.odps, domainSpec);

    // Load assets
    const assets = await this.loadAssets(domainFiles.cads, domainSpec);

    // Load processes
    const processes = await this.loadProcesses(domainFiles.bpmn, domainSpec);

    // Load DMN decisions
    const decisions = await this.loadDecisions(domainFiles.dmn, domainSpec);

    // Load knowledge articles
    const knowledgeArticles = await this.loadKnowledgeArticles(domainFiles.kb, domainSpec);

    // Load decision records (ADRs)
    const decisionRecords = await this.loadDecisionRecords(domainFiles.adr, domainSpec);

    // Convert systems from DomainV2 format to System format
    const systems = this.loadSystems(domainSpec.systems || [], domainSpec.id, workspaceId, tables);

    // Construct Domain object (SDK schema has simpler DomainV2 structure)
    const domain: Domain = {
      id: domainSpec.id,
      workspace_id: workspaceId,
      name: domainSpec.name,
      description: domainSpec.description,
      created_at: new Date().toISOString(),
      last_modified_at: new Date().toISOString(),
      systems: systems.map((s) => s.id),
      tables: tables.map((t) => t.id),
      products: products.map((p) => p.id),
      assets: assets.map((a) => a.id),
      processes: processes.map((p) => p.id),
      decisions: decisions.map((d) => d.id),
      // Load view-specific positions for canvas nodes (tables, systems, assets)
      view_positions: (domainSpec as any).view_positions,
    };

    return {
      domain,
      tables,
      products,
      assets,
      processes,
      decisions,
      systems,
      knowledgeArticles,
      decisionRecords,
    };
  }

  /**
   * Load a single domain's resources from string files (for bundled examples)
   */
  private static async loadDomainFromStrings(
    domainSpec: DomainV2,
    workspaceName: string,
    workspaceId: string,
    files: Array<{ name: string; content: string }>,
    categorized: CategorizedFiles
  ): Promise<DomainLoadResult> {
    // Filter files for this domain
    const domainFiles = this.filterStringFilesByDomain(
      files,
      categorized,
      workspaceName,
      domainSpec.name
    );

    console.log(`[WorkspaceV2Loader] Loading domain "${domainSpec.name}" from strings with:`, {
      odcs: domainFiles.odcs.length,
      odps: domainFiles.odps.length,
      cads: domainFiles.cads.length,
      bpmn: domainFiles.bpmn.length,
      dmn: domainFiles.dmn.length,
      kb: domainFiles.kb.length,
      adr: domainFiles.adr.length,
    });

    // Load tables
    const tables = await this.loadTablesFromStrings(domainFiles.odcs, domainSpec, workspaceId);

    // Load products
    const products = await this.loadProductsFromStrings(domainFiles.odps, domainSpec);

    // Load assets
    const assets = await this.loadAssetsFromStrings(domainFiles.cads, domainSpec);

    // Load processes
    const processes = await this.loadProcessesFromStrings(domainFiles.bpmn, domainSpec);

    // Load DMN decisions
    const decisions = await this.loadDecisionsFromStrings(domainFiles.dmn, domainSpec);

    // Load knowledge articles
    const knowledgeArticles = await this.loadKnowledgeArticlesFromStrings(
      domainFiles.kb,
      domainSpec
    );

    // Load decision records (ADRs)
    const decisionRecords = await this.loadDecisionRecordsFromStrings(domainFiles.adr, domainSpec);

    // Convert systems from DomainV2 format to System format
    const systems = this.loadSystems(domainSpec.systems || [], domainSpec.id, workspaceId, tables);

    // Construct Domain object
    const domain: Domain = {
      id: domainSpec.id,
      workspace_id: workspaceId,
      name: domainSpec.name,
      description: domainSpec.description,
      created_at: new Date().toISOString(),
      last_modified_at: new Date().toISOString(),
      systems: systems.map((s) => s.id),
      tables: tables.map((t) => t.id),
      products: products.map((p) => p.id),
      assets: assets.map((a) => a.id),
      processes: processes.map((p) => p.id),
      decisions: decisions.map((d) => d.id),
      // Load view-specific positions for canvas nodes (tables, systems, assets)
      view_positions: (domainSpec as any).view_positions,
    };

    return {
      domain,
      tables,
      products,
      assets,
      processes,
      decisions,
      systems,
      knowledgeArticles,
      decisionRecords,
    };
  }

  /**
   * Filter string files by domain using naming convention
   */
  private static filterStringFilesByDomain(
    files: Array<{ name: string; content: string }>,
    categorized: CategorizedFiles,
    workspaceName: string,
    domainName: string
  ): {
    odcs: Array<{ name: string; content: string }>;
    odps: Array<{ name: string; content: string }>;
    cads: Array<{ name: string; content: string }>;
    bpmn: Array<{ name: string; content: string }>;
    dmn: Array<{ name: string; content: string }>;
    kb: Array<{ name: string; content: string }>;
    adr: Array<{ name: string; content: string }>;
  } {
    const prefix = `${workspaceName}_${domainName}_`.toLowerCase();

    const filterByPrefix = (fileNames: string[]): Array<{ name: string; content: string }> => {
      return files.filter(
        (f) => fileNames.includes(f.name) && f.name.toLowerCase().startsWith(prefix)
      );
    };

    return {
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
   * Load ODCS tables from string content
   */
  private static async loadTablesFromStrings(
    files: Array<{ name: string; content: string }>,
    domainSpec: DomainV2,
    workspaceId: string
  ): Promise<Table[]> {
    const tables: Table[] = [];

    for (const file of files) {
      try {
        const parsed = await odcsService.parseYAML(file.content);

        if (parsed && typeof parsed === 'object' && 'tables' in parsed) {
          const workspace = parsed as any;
          if (workspace.tables && Array.isArray(workspace.tables) && workspace.tables.length > 0) {
            const table = workspace.tables[0];
            table.primary_domain_id = domainSpec.id;
            table.workspace_id = workspaceId;
            table.visible_domains = [domainSpec.id];
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
   * Load ODPS products from string content
   */
  private static async loadProductsFromStrings(
    files: Array<{ name: string; content: string }>,
    domainSpec: DomainV2
  ): Promise<DataProduct[]> {
    const products: DataProduct[] = [];

    for (const file of files) {
      try {
        const product = await odpsService.parseYAML(file.content);

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
   * Load CADS assets from string content
   */
  private static async loadAssetsFromStrings(
    files: Array<{ name: string; content: string }>,
    domainSpec: DomainV2
  ): Promise<ComputeAsset[]> {
    const assets: ComputeAsset[] = [];

    for (const file of files) {
      try {
        const asset = await cadsService.parseYAML(file.content);

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
   * Load BPMN processes from string content
   */
  private static async loadProcessesFromStrings(
    files: Array<{ name: string; content: string }>,
    domainSpec: DomainV2
  ): Promise<BPMNProcess[]> {
    const processes: BPMNProcess[] = [];

    for (const file of files) {
      try {
        const process = await bpmnService.parseXML(file.content);

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
   * Load DMN decisions from string content
   */
  private static async loadDecisionsFromStrings(
    files: Array<{ name: string; content: string }>,
    domainSpec: DomainV2
  ): Promise<DMNDecision[]> {
    const decisions: DMNDecision[] = [];

    for (const file of files) {
      try {
        const decision = await dmnService.parseXML(file.content);

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

  /**
   * Load knowledge articles from string content
   */
  private static async loadKnowledgeArticlesFromStrings(
    files: Array<{ name: string; content: string }>,
    domainSpec: DomainV2
  ): Promise<KnowledgeArticle[]> {
    const articles: KnowledgeArticle[] = [];

    for (const file of files) {
      try {
        const article = await knowledgeService.parseKnowledgeYaml(file.content);

        if (article && typeof article === 'object' && 'id' in article) {
          (article as any).domain_id = domainSpec.id;
          articles.push(article as KnowledgeArticle);
        }
      } catch (error) {
        console.error(
          `[WorkspaceV2Loader] Failed to load knowledge article from ${file.name}:`,
          error
        );
      }
    }

    return articles;
  }

  /**
   * Load decision records from string content
   */
  private static async loadDecisionRecordsFromStrings(
    files: Array<{ name: string; content: string }>,
    domainSpec: DomainV2
  ): Promise<Decision[]> {
    const records: Decision[] = [];

    for (const file of files) {
      try {
        const record = await decisionService.parseDecisionYaml(file.content);

        if (record && typeof record === 'object' && 'id' in record) {
          (record as any).domain_id = domainSpec.id;
          records.push(record as Decision);
        }
      } catch (error) {
        console.error(
          `[WorkspaceV2Loader] Failed to load decision record from ${file.name}:`,
          error
        );
      }
    }

    return records;
  }

  /**
   * Load systems from workspace.yaml domain spec
   */
  private static loadSystems(
    systemSpecs: SystemV2[],
    domainId: string,
    _workspaceId: string,
    tables: Table[]
  ): System[] {
    const systems: System[] = [];

    for (const spec of systemSpecs) {
      let tableIds: string[] = [];

      // PRIORITY 1: Use table_ids from workspace.yaml if present
      if (spec.table_ids && spec.table_ids.length > 0) {
        tableIds = spec.table_ids;
        console.log(
          `[WorkspaceV2Loader] System "${spec.name}" has explicit table_ids in workspace.yaml: ${tableIds.length} table(s)`
        );
      } else {
        // FALLBACK: Find tables by metadata.system_id or naming convention (legacy support)
        const systemTables = tables.filter((t) => {
          // Check if table has system_id in metadata
          const tableSystemId = (t as any).metadata?.system_id;
          if (tableSystemId === spec.id) {
            return true;
          }
          // Fallback: check if table name contains system name
          const tableName = t.name?.toLowerCase() || '';
          const systemName = spec.name?.toLowerCase() || '';
          return tableName.includes(systemName) || systemName.includes(tableName);
        });
        tableIds = systemTables.map((t) => t.id);
        if (tableIds.length > 0) {
          console.log(
            `[WorkspaceV2Loader] System "${spec.name}" matched ${tableIds.length} table(s) via fallback (metadata/naming)`
          );
        }
      }

      // Get asset_ids from workspace.yaml if present
      const assetIds = spec.asset_ids || [];

      const system: System = {
        id: spec.id,
        name: spec.name,
        description: spec.description,
        domain_id: domainId,
        system_type: 'database', // Default system type
        table_ids: tableIds,
        asset_ids: assetIds,
        created_at: new Date().toISOString(),
        last_modified_at: new Date().toISOString(),
      };

      // Update tables with system linkage (set primary_system_id on matched tables)
      for (const tableId of tableIds) {
        const table = tables.find((t) => t.id === tableId);
        if (table) {
          (table as any).primary_system_id = spec.id;
        }
      }

      systems.push(system);
      console.log(
        `[WorkspaceV2Loader] Loaded system "${spec.name}" with ${tableIds.length} table(s), ${assetIds.length} asset(s)`
      );
    }

    return systems;
  }

  /**
   * Load relationships from workspace.yaml
   */
  private static loadRelationships(
    relationshipSpecs: RelationshipV2[],
    workspaceId: string
  ): Relationship[] {
    return relationshipSpecs.map((spec) => {
      // Map cardinality to source/target cardinality
      let sourceCardinality: '0' | '1' | 'N' = '1';
      let targetCardinality: '0' | '1' | 'N' = '1';

      if (spec.cardinality === 'one_to_many') {
        targetCardinality = 'N';
      } else if (spec.cardinality === 'many_to_many') {
        sourceCardinality = 'N';
        targetCardinality = 'N';
      }

      // Map relationship_type to RelationshipType
      let relType: 'one-to-one' | 'one-to-many' | 'many-to-many' = 'one-to-many';
      if (spec.cardinality === 'one_to_one') {
        relType = 'one-to-one';
      } else if (spec.cardinality === 'many_to_many') {
        relType = 'many-to-many';
      }

      return {
        id: spec.id,
        workspace_id: workspaceId,
        domain_id: '', // Will be determined by the tables' domain
        source_id: spec.source_table_id,
        target_id: spec.target_table_id,
        source_type: 'table' as const,
        target_type: 'table' as const,
        source_table_id: spec.source_table_id,
        target_table_id: spec.target_table_id,
        type: relType,
        source_cardinality: sourceCardinality,
        target_cardinality: targetCardinality,
        description: spec.notes,
        color: spec.color,
        // Connection point handles for edge positioning on canvas
        source_handle: (spec as any).source_handle,
        target_handle: (spec as any).target_handle,
        model_type: 'physical' as const,
        is_circular: false,
        created_at: new Date().toISOString(),
        last_modified_at: new Date().toISOString(),
      };
    });
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
      kb: filterByPrefix(categorized.kb),
      adr: filterByPrefix(categorized.adr),
    };
  }

  /**
   * Load ODCS tables from files
   */
  private static async loadTables(
    files: File[],
    domainSpec: DomainV2,
    workspaceId: string
  ): Promise<Table[]> {
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
            table.workspace_id = workspaceId;
            table.visible_domains = [domainSpec.id];

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

  /**
   * Load knowledge articles from .kb.yaml files
   */
  private static async loadKnowledgeArticles(
    files: File[],
    domainSpec: DomainV2
  ): Promise<KnowledgeArticle[]> {
    const articles: KnowledgeArticle[] = [];

    for (const file of files) {
      try {
        const content = await browserFileService.readFile(file);
        const article = await knowledgeService.parseKnowledgeYaml(content);

        if (article && typeof article === 'object' && 'id' in article) {
          (article as any).domain_id = domainSpec.id;
          articles.push(article as KnowledgeArticle);
          console.log(`[WorkspaceV2Loader] Loaded knowledge article: ${article.title}`);
        }
      } catch (error) {
        console.error(
          `[WorkspaceV2Loader] Failed to load knowledge article from ${file.name}:`,
          error
        );
      }
    }

    return articles;
  }

  /**
   * Load decision records (ADRs) from .adr.yaml files
   */
  private static async loadDecisionRecords(
    files: File[],
    domainSpec: DomainV2
  ): Promise<Decision[]> {
    const decisions: Decision[] = [];

    for (const file of files) {
      try {
        const content = await browserFileService.readFile(file);
        const decision = await decisionService.parseDecisionYaml(content);

        if (decision && typeof decision === 'object' && 'id' in decision) {
          (decision as any).domain_id = domainSpec.id;
          decisions.push(decision as Decision);
          console.log(`[WorkspaceV2Loader] Loaded decision record: ${decision.title}`);
        }
      } catch (error) {
        console.error(
          `[WorkspaceV2Loader] Failed to load decision record from ${file.name}:`,
          error
        );
      }
    }

    return decisions;
  }
}
