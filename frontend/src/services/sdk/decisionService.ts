/**
 * Decision Service
 * Handles MADR Architecture Decision Records via SDK 1.13.3+
 *
 * SDK 1.13.3 WASM Methods:
 * - parse_decision_yaml(yaml: string) -> JSON string
 * - parse_decision_index_yaml(yaml: string) -> JSON string
 * - export_decision_to_yaml(decision_json: string) -> YAML string
 * - export_decision_to_markdown(decision_json: string) -> Markdown string
 * - create_decision(number, title, context, decision) -> JSON string
 * - create_decision_index() -> JSON string
 * - add_decision_to_index(index_json, decision_json, filename) -> JSON string
 *
 * NOTE: WASM SDK works with YAML strings, not file paths.
 * File I/O must be handled by the application layer.
 */

import { sdkLoader } from './sdkLoader';
import type {
  Decision,
  DecisionIndex,
  DecisionIndexEntry,
  DecisionFilter,
  DecisionOption,
} from '@/types/decision';
import {
  DecisionStatus,
  DecisionCategory,
  isValidStatusTransition,
  formatDecisionNumber,
} from '@/types/decision';

/**
 * Decision Service for SDK 1.13.3+ decision management
 *
 * This service provides methods to work with decisions using the SDK.
 * In WASM mode, it works with YAML/JSON strings rather than file paths.
 */
class DecisionService {
  /**
   * Check if decision features are supported by the current SDK
   */
  isSupported(): boolean {
    return sdkLoader.hasDecisionSupport();
  }

  /**
   * Parse a decision from YAML string
   */
  async parseDecisionYaml(yaml: string): Promise<Decision | null> {
    // Try SDK first if supported
    if (this.isSupported()) {
      const sdk = await sdkLoader.load();
      if (sdk.parse_decision_yaml) {
        try {
          const resultJson = sdk.parse_decision_yaml(yaml);
          const result = JSON.parse(resultJson);

          if (result.error) {
            throw new Error(result.error);
          }

          return result as Decision;
        } catch (error) {
          console.warn('[DecisionService] SDK parse failed, trying fallback:', error);
        }
      }
    }

    // Fallback: Parse YAML directly using js-yaml
    return this.parseDecisionYamlFallback(yaml);
  }

  /**
   * Fallback parser for decisions when SDK is not available
   */
  private async parseDecisionYamlFallback(yamlContent: string): Promise<Decision | null> {
    try {
      const jsYaml = await import('js-yaml');
      const parsed = jsYaml.load(yamlContent) as any;

      if (!parsed || typeof parsed !== 'object') {
        console.error('[DecisionService] Invalid YAML content');
        return null;
      }

      // Map YAML fields to Decision structure (MADR format)
      const decision: Decision = {
        id: parsed.id || crypto.randomUUID(),
        number: parsed.number || 0,
        title: parsed.title || 'Untitled Decision',
        status: parsed.status || 'draft',
        category: parsed.category || 'architecture',
        context: parsed.context || '',
        decision: parsed.decision || '',
        consequences: parsed.consequences || '',
        options: Array.isArray(parsed.options) ? parsed.options : [],
        domain_id: parsed.domain_id,
        workspace_id: parsed.workspace_id,
        authors: Array.isArray(parsed.authors) ? parsed.authors : [],
        deciders: Array.isArray(parsed.deciders) ? parsed.deciders : [],
        tags: parsed.tags,
        created_at: parsed.created_at || new Date().toISOString(),
        updated_at: parsed.updated_at || new Date().toISOString(),
        decided_at: parsed.decided_at,
        superseded_by: parsed.superseded_by,
      };

      console.log(`[DecisionService] Parsed decision via fallback: ${decision.title}`);
      return decision;
    } catch (error) {
      console.error('[DecisionService] Fallback parse failed:', error);
      return null;
    }
  }

  /**
   * Parse a decision index from YAML string
   */
  async parseDecisionIndexYaml(yaml: string): Promise<DecisionIndex | null> {
    if (!this.isSupported()) {
      return null;
    }

    const sdk = await sdkLoader.load();
    if (!sdk.parse_decision_index_yaml) {
      return null;
    }

    try {
      const resultJson = sdk.parse_decision_index_yaml(yaml);
      const result = JSON.parse(resultJson);

      if (result.error) {
        throw new Error(result.error);
      }

      return result as DecisionIndex;
    } catch (error) {
      console.error('[DecisionService] Failed to parse decision index YAML:', error);
      return null;
    }
  }

  /**
   * Export a decision to YAML string
   */
  async exportDecisionToYaml(decision: Decision): Promise<string | null> {
    if (!this.isSupported()) {
      throw new Error('Decision features require SDK 1.13.3+');
    }

    const sdk = await sdkLoader.load();
    if (!sdk.export_decision_to_yaml) {
      throw new Error('export_decision_to_yaml method not available in SDK');
    }

    try {
      const decisionJson = JSON.stringify(decision);
      const yaml = sdk.export_decision_to_yaml(decisionJson);
      return yaml;
    } catch (error) {
      console.error('[DecisionService] Failed to export decision to YAML:', error);
      throw error;
    }
  }

  /**
   * Export a decision to Markdown string
   */
  async exportDecisionToMarkdown(decision: Decision): Promise<string> {
    // Try SDK export first
    if (this.isSupported()) {
      const sdk = await sdkLoader.load();
      if (sdk.export_decision_to_markdown) {
        try {
          const decisionJson = JSON.stringify(decision);
          const markdown = sdk.export_decision_to_markdown(decisionJson);
          return markdown;
        } catch {
          console.warn('[DecisionService] SDK markdown export failed, using fallback');
        }
      }
    }

    // Fallback to client-side markdown generation
    return this.generateMarkdown(decision);
  }

  /**
   * Create a new decision using SDK
   */
  async createDecisionViaSDK(
    number: number,
    title: string,
    context: string,
    decisionText: string
  ): Promise<Decision | null> {
    if (!this.isSupported()) {
      return null;
    }

    const sdk = await sdkLoader.load();
    if (!sdk.create_decision) {
      return null;
    }

    try {
      const resultJson = sdk.create_decision(number, title, context, decisionText);
      const result = JSON.parse(resultJson);

      if (result.error) {
        throw new Error(result.error);
      }

      return result as Decision;
    } catch (error) {
      console.error('[DecisionService] Failed to create decision via SDK:', error);
      return null;
    }
  }

  /**
   * Create a new empty decision index using SDK
   */
  async createDecisionIndexViaSDK(): Promise<DecisionIndex | null> {
    if (!this.isSupported()) {
      return null;
    }

    const sdk = await sdkLoader.load();
    if (!sdk.create_decision_index) {
      return null;
    }

    try {
      const resultJson = sdk.create_decision_index();
      const result = JSON.parse(resultJson);

      if (result.error) {
        throw new Error(result.error);
      }

      return result as DecisionIndex;
    } catch (error) {
      console.error('[DecisionService] Failed to create decision index via SDK:', error);
      return null;
    }
  }

  /**
   * Add a decision to the index using SDK
   */
  async addDecisionToIndex(
    index: DecisionIndex,
    decision: Decision,
    filename: string
  ): Promise<DecisionIndex | null> {
    if (!this.isSupported()) {
      return null;
    }

    const sdk = await sdkLoader.load();
    if (!sdk.add_decision_to_index) {
      return null;
    }

    try {
      const indexJson = JSON.stringify(index);
      const decisionJson = JSON.stringify(decision);
      const resultJson = sdk.add_decision_to_index(indexJson, decisionJson, filename);
      const result = JSON.parse(resultJson);

      if (result.error) {
        throw new Error(result.error);
      }

      return result as DecisionIndex;
    } catch (error) {
      console.error('[DecisionService] Failed to add decision to index:', error);
      return null;
    }
  }

  // ============================================================
  // Higher-level methods that work with in-memory data
  // These don't require file I/O and work with decision arrays
  // ============================================================

  /**
   * Load a single decision by ID from an array of decisions
   */
  findDecisionById(decisions: Decision[], decisionId: string): Decision | null {
    return decisions.find((d) => d.id === decisionId) ?? null;
  }

  /**
   * Filter decisions by criteria
   */
  filterDecisions(decisions: Decision[], filter: DecisionFilter): Decision[] {
    let filtered = [...decisions];

    if (filter.domain_id) {
      filtered = filtered.filter((d) => d.domain_id === filter.domain_id);
    }

    if (filter.status && filter.status.length > 0) {
      filtered = filtered.filter((d) => filter.status!.includes(d.status));
    }

    if (filter.category && filter.category.length > 0) {
      filtered = filtered.filter((d) => filter.category!.includes(d.category));
    }

    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      filtered = filtered.filter(
        (d) =>
          d.title.toLowerCase().includes(searchLower) ||
          d.context.toLowerCase().includes(searchLower) ||
          d.decision.toLowerCase().includes(searchLower)
      );
    }

    if (filter.tags && filter.tags.length > 0) {
      filtered = filtered.filter((d) => {
        if (!d.tags) return false;
        return filter.tags!.some((filterTag) =>
          d.tags!.some((t) => {
            if (typeof t === 'string') return t === filterTag;
            if ('value' in t) return t.value === filterTag;
            return false;
          })
        );
      });
    }

    return filtered;
  }

  /**
   * Create a new decision object (client-side)
   */
  createDecision(
    data: {
      title: string;
      category: DecisionCategory;
      context: string;
      decision: string;
      consequences?: string;
      options?: DecisionOption[];
      domain_id?: string;
      authors?: string[];
    },
    nextNumber: number = 1
  ): Decision {
    const now = new Date().toISOString();
    return {
      id: crypto.randomUUID(),
      number: nextNumber,
      title: data.title,
      status: DecisionStatus.Draft,
      category: data.category,
      context: data.context,
      decision: data.decision,
      consequences: data.consequences ?? '',
      options: data.options ?? [],
      domain_id: data.domain_id,
      authors: data.authors ?? [],
      created_at: now,
      updated_at: now,
    };
  }

  /**
   * Update a decision object
   */
  updateDecision(decision: Decision, updates: Partial<Decision>): Decision {
    return {
      ...decision,
      ...updates,
      id: decision.id, // Preserve ID
      number: decision.number, // Preserve number
      created_at: decision.created_at, // Preserve created_at
      updated_at: new Date().toISOString(),
    };
  }

  /**
   * Change decision status with validation
   */
  changeStatus(decision: Decision, newStatus: DecisionStatus, supersededById?: string): Decision {
    if (!isValidStatusTransition(decision.status, newStatus)) {
      throw new Error(`Invalid status transition from ${decision.status} to ${newStatus}`);
    }

    const updates: Partial<Decision> = {
      status: newStatus,
    };

    // Set decided_at for terminal states
    if (newStatus === DecisionStatus.Accepted || newStatus === DecisionStatus.Rejected) {
      updates.decided_at = new Date().toISOString();
    }

    // Handle superseded status
    if (newStatus === DecisionStatus.Superseded) {
      if (!supersededById) {
        throw new Error('supersededById is required when superseding a decision');
      }
      updates.superseded_by = supersededById;
    }

    return this.updateDecision(decision, updates);
  }

  /**
   * Create a decision index entry from a decision
   */
  createIndexEntry(decision: Decision): DecisionIndexEntry {
    return {
      id: decision.id,
      number: decision.number,
      title: decision.title,
      status: decision.status,
      category: decision.category,
      domain_id: decision.domain_id,
      created_at: decision.created_at,
      updated_at: decision.updated_at,
    };
  }

  /**
   * Generate markdown for a decision (fallback)
   */
  private generateMarkdown(decision: Decision): string {
    const lines: string[] = [
      `# ${formatDecisionNumber(decision.number)}. ${decision.title}`,
      '',
      `**Status:** ${decision.status}`,
      `**Category:** ${decision.category}`,
      `**Date:** ${new Date(decision.created_at).toLocaleDateString()}`,
      '',
    ];

    if (decision.deciders && decision.deciders.length > 0) {
      lines.push(`**Deciders:** ${decision.deciders.join(', ')}`);
      lines.push('');
    }

    lines.push('## Context');
    lines.push('');
    lines.push(decision.context);
    lines.push('');

    lines.push('## Decision');
    lines.push('');
    lines.push(decision.decision);
    lines.push('');

    if (decision.options && decision.options.length > 0) {
      lines.push('## Considered Options');
      lines.push('');
      for (const option of decision.options) {
        lines.push(`### ${option.title}`);
        lines.push('');
        lines.push(option.description);
        lines.push('');
        if (option.pros.length > 0) {
          lines.push('**Pros:**');
          for (const pro of option.pros) {
            lines.push(`- ${pro}`);
          }
          lines.push('');
        }
        if (option.cons.length > 0) {
          lines.push('**Cons:**');
          for (const con of option.cons) {
            lines.push(`- ${con}`);
          }
          lines.push('');
        }
      }
    }

    if (decision.consequences) {
      lines.push('## Consequences');
      lines.push('');
      lines.push(decision.consequences);
      lines.push('');
    }

    if (decision.superseded_by) {
      lines.push('---');
      lines.push('');
      lines.push(`*This decision has been superseded by [ADR-${decision.superseded_by}]*`);
    }

    return lines.join('\n');
  }

  /**
   * Get decisions by status
   */
  getDecisionsByStatus(decisions: Decision[], status: DecisionStatus): Decision[] {
    return this.filterDecisions(decisions, { status: [status] });
  }

  /**
   * Get accepted decisions
   */
  getAcceptedDecisions(decisions: Decision[]): Decision[] {
    return this.getDecisionsByStatus(decisions, DecisionStatus.Accepted);
  }

  /**
   * Get draft decisions
   */
  getDraftDecisions(decisions: Decision[]): Decision[] {
    return this.getDecisionsByStatus(decisions, DecisionStatus.Draft);
  }

  /**
   * Get proposed decisions
   */
  getProposedDecisions(decisions: Decision[]): Decision[] {
    return this.getDecisionsByStatus(decisions, DecisionStatus.Proposed);
  }
}

// Export singleton instance
export const decisionService = new DecisionService();
