/**
 * Decision Service
 * Handles MADR Architecture Decision Records via SDK 1.13.1+
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
 * Decision Service for SDK 1.13.1+ decision management
 */
class DecisionService {
  /**
   * Check if decision features are supported by the current SDK
   */
  isSupported(): boolean {
    return sdkLoader.hasDecisionSupport();
  }

  /**
   * Load all decisions for a workspace
   */
  async loadDecisions(workspacePath: string): Promise<Decision[]> {
    if (!this.isSupported()) {
      console.warn('[DecisionService] Decision features require SDK 1.13.1+');
      return [];
    }

    const sdk = await sdkLoader.load();
    if (!sdk.load_decisions) {
      console.warn('[DecisionService] load_decisions method not available');
      return [];
    }

    try {
      const resultJson = sdk.load_decisions(workspacePath);
      const result = JSON.parse(resultJson);

      if (result.error) {
        throw new Error(result.error);
      }

      return (result.decisions ?? result) as Decision[];
    } catch (error) {
      console.error('[DecisionService] Failed to load decisions:', error);
      return [];
    }
  }

  /**
   * Load a single decision by ID
   */
  async loadDecision(workspacePath: string, decisionId: string): Promise<Decision | null> {
    const decisions = await this.loadDecisions(workspacePath);
    return decisions.find((d) => d.id === decisionId) ?? null;
  }

  /**
   * Load the decision index
   */
  async loadDecisionIndex(workspacePath: string): Promise<DecisionIndex | null> {
    if (!this.isSupported()) {
      return null;
    }

    const sdk = await sdkLoader.load();
    if (!sdk.load_decision_index) {
      return null;
    }

    try {
      const resultJson = sdk.load_decision_index(workspacePath);
      const result = JSON.parse(resultJson);

      if (result.error) {
        throw new Error(result.error);
      }

      return result as DecisionIndex;
    } catch (error) {
      console.error('[DecisionService] Failed to load decision index:', error);
      return null;
    }
  }

  /**
   * Load decisions filtered by domain
   */
  async loadDecisionsByDomain(workspacePath: string, domainId: string): Promise<Decision[]> {
    if (!this.isSupported()) {
      return [];
    }

    const sdk = await sdkLoader.load();

    // Try SDK method first
    if (sdk.load_decisions_by_domain) {
      try {
        const resultJson = sdk.load_decisions_by_domain(workspacePath, domainId);
        const result = JSON.parse(resultJson);
        return (result.decisions ?? result) as Decision[];
      } catch (error) {
        console.error('[DecisionService] SDK domain filter failed:', error);
      }
    }

    // Fallback to client-side filtering
    const allDecisions = await this.loadDecisions(workspacePath);
    return allDecisions.filter((d) => d.domain_id === domainId);
  }

  /**
   * Filter decisions by criteria
   */
  async filterDecisions(workspacePath: string, filter: DecisionFilter): Promise<Decision[]> {
    let decisions = await this.loadDecisions(workspacePath);

    if (filter.domain_id) {
      decisions = decisions.filter((d) => d.domain_id === filter.domain_id);
    }

    if (filter.status && filter.status.length > 0) {
      decisions = decisions.filter((d) => filter.status!.includes(d.status));
    }

    if (filter.category && filter.category.length > 0) {
      decisions = decisions.filter((d) => filter.category!.includes(d.category));
    }

    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      decisions = decisions.filter(
        (d) =>
          d.title.toLowerCase().includes(searchLower) ||
          d.context.toLowerCase().includes(searchLower) ||
          d.decision.toLowerCase().includes(searchLower)
      );
    }

    if (filter.tags && filter.tags.length > 0) {
      decisions = decisions.filter((d) => {
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

    return decisions;
  }

  /**
   * Save a decision
   */
  async saveDecision(workspacePath: string, decision: Decision): Promise<void> {
    if (!this.isSupported()) {
      throw new Error('Decision features require SDK 1.13.1+');
    }

    const sdk = await sdkLoader.load();
    if (!sdk.save_decision) {
      throw new Error('save_decision method not available in SDK');
    }

    try {
      const decisionJson = JSON.stringify(decision);
      const resultJson = sdk.save_decision(decisionJson, workspacePath);
      const result = JSON.parse(resultJson);

      if (!result.success) {
        throw new Error(result.error || 'Failed to save decision');
      }

      console.log('[DecisionService] Decision saved:', decision.id);
    } catch (error) {
      console.error('[DecisionService] Failed to save decision:', error);
      throw error;
    }
  }

  /**
   * Create a new decision
   */
  async createDecision(
    workspacePath: string,
    data: {
      title: string;
      category: DecisionCategory;
      context: string;
      decision: string;
      consequences?: string;
      options?: DecisionOption[];
      domain_id?: string;
      authors?: string[];
    }
  ): Promise<Decision> {
    // Load index to get next number
    let index = await this.loadDecisionIndex(workspacePath);
    const nextNumber = index?.next_number ?? 1;

    const now = new Date().toISOString();
    const decision: Decision = {
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

    // Save the decision
    await this.saveDecision(workspacePath, decision);

    // Update the index
    if (index) {
      const newEntry: DecisionIndexEntry = {
        id: decision.id,
        number: decision.number,
        title: decision.title,
        status: decision.status,
        category: decision.category,
        domain_id: decision.domain_id,
        created_at: decision.created_at,
        updated_at: decision.updated_at,
      };

      index.decisions.push(newEntry);
      index.next_number = nextNumber + 1;
      index.last_updated = now;

      await this.saveDecisionIndex(workspacePath, index);
    }

    return decision;
  }

  /**
   * Update a decision
   */
  async updateDecision(
    workspacePath: string,
    decisionId: string,
    updates: Partial<Decision>
  ): Promise<Decision> {
    const decision = await this.loadDecision(workspacePath, decisionId);
    if (!decision) {
      throw new Error(`Decision not found: ${decisionId}`);
    }

    const updatedDecision: Decision = {
      ...decision,
      ...updates,
      id: decision.id, // Preserve ID
      number: decision.number, // Preserve number
      created_at: decision.created_at, // Preserve created_at
      updated_at: new Date().toISOString(),
    };

    await this.saveDecision(workspacePath, updatedDecision);

    // Update index if title or status changed
    if (updates.title || updates.status || updates.category) {
      const index = await this.loadDecisionIndex(workspacePath);
      if (index) {
        const entryIndex = index.decisions.findIndex((e) => e.id === decisionId);
        const existingEntry = index.decisions[entryIndex];
        if (entryIndex >= 0 && existingEntry) {
          index.decisions[entryIndex] = {
            ...existingEntry,
            title: updatedDecision.title,
            status: updatedDecision.status,
            category: updatedDecision.category,
            updated_at: updatedDecision.updated_at,
          };
          index.last_updated = updatedDecision.updated_at;
          await this.saveDecisionIndex(workspacePath, index);
        }
      }
    }

    return updatedDecision;
  }

  /**
   * Change decision status with validation
   */
  async changeStatus(
    workspacePath: string,
    decisionId: string,
    newStatus: DecisionStatus,
    supersededById?: string
  ): Promise<Decision> {
    const decision = await this.loadDecision(workspacePath, decisionId);
    if (!decision) {
      throw new Error(`Decision not found: ${decisionId}`);
    }

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

      // Update the superseding decision
      const supersedingDecision = await this.loadDecision(workspacePath, supersededById);
      if (supersedingDecision) {
        await this.updateDecision(workspacePath, supersededById, {
          supersedes: decisionId,
        });
      }
    }

    return this.updateDecision(workspacePath, decisionId, updates);
  }

  /**
   * Delete a decision
   */
  async deleteDecision(_workspacePath: string, _decisionId: string): Promise<void> {
    // For now, we don't have a delete method in SDK
    // This would need to be implemented when SDK supports it
    throw new Error('Delete operation not yet supported');
  }

  /**
   * Save the decision index
   */
  async saveDecisionIndex(workspacePath: string, index: DecisionIndex): Promise<void> {
    if (!this.isSupported()) {
      throw new Error('Decision features require SDK 1.13.1+');
    }

    const sdk = await sdkLoader.load();
    if (!sdk.save_decision_index) {
      throw new Error('save_decision_index method not available in SDK');
    }

    try {
      const indexJson = JSON.stringify(index);
      const resultJson = sdk.save_decision_index(indexJson, workspacePath);
      const result = JSON.parse(resultJson);

      if (!result.success) {
        throw new Error(result.error || 'Failed to save decision index');
      }
    } catch (error) {
      console.error('[DecisionService] Failed to save decision index:', error);
      throw error;
    }
  }

  /**
   * Export a decision to markdown
   */
  async exportToMarkdown(workspacePath: string, decisionId: string): Promise<string> {
    const decision = await this.loadDecision(workspacePath, decisionId);
    if (!decision) {
      throw new Error(`Decision not found: ${decisionId}`);
    }

    // Try SDK export first
    if (this.isSupported()) {
      const sdk = await sdkLoader.load();
      if (sdk.export_decision_markdown) {
        try {
          const decisionJson = JSON.stringify(decision);
          const markdown = sdk.export_decision_markdown(decisionJson);
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
  async getDecisionsByStatus(workspacePath: string, status: DecisionStatus): Promise<Decision[]> {
    return this.filterDecisions(workspacePath, { status: [status] });
  }

  /**
   * Get accepted decisions
   */
  async getAcceptedDecisions(workspacePath: string): Promise<Decision[]> {
    return this.getDecisionsByStatus(workspacePath, DecisionStatus.Accepted);
  }

  /**
   * Get draft decisions
   */
  async getDraftDecisions(workspacePath: string): Promise<Decision[]> {
    return this.getDecisionsByStatus(workspacePath, DecisionStatus.Draft);
  }

  /**
   * Get proposed decisions
   */
  async getProposedDecisions(workspacePath: string): Promise<Decision[]> {
    return this.getDecisionsByStatus(workspacePath, DecisionStatus.Proposed);
  }
}

// Export singleton instance
export const decisionService = new DecisionService();
