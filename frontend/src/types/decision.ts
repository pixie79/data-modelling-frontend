/**
 * Type definitions for MADR (Markdown Architectural Decision Records) Decision entity
 * SDK 1.14.0+
 */

/**
 * Enhanced Tag type supporting Simple, Pair, and List formats (SDK 1.13.1+)
 */
export type Tag =
  | string // Simple: just a string value
  | { key: string; value: string } // Pair: key-value pair
  | { key: string; values: string[] }; // List: key with multiple values

/**
 * Decision status following MADR lifecycle
 */
export enum DecisionStatus {
  Draft = 'draft',
  Proposed = 'proposed',
  Accepted = 'accepted',
  Deprecated = 'deprecated',
  Superseded = 'superseded',
  Rejected = 'rejected',
}

/**
 * Decision category for classification (SDK 1.14.0+)
 * Extended with additional categories from SDK schema
 */
export enum DecisionCategory {
  Architecture = 'architecture',
  Technology = 'technology',
  Process = 'process',
  Security = 'security',
  Data = 'data',
  Integration = 'integration',
  Infrastructure = 'infrastructure',
  Operations = 'operations',
  Testing = 'testing',
  Documentation = 'documentation',
  Team = 'team',
  Compliance = 'compliance',
  Performance = 'performance',
  Other = 'other',
}

/**
 * Driver priority for decision drivers (SDK 1.14.0+)
 */
export enum DriverPriority {
  High = 'high',
  Medium = 'medium',
  Low = 'low',
}

/**
 * Decision driver - a reason or force behind a decision (SDK 1.14.0+)
 */
export interface DecisionDriver {
  description: string;
  priority?: DriverPriority;
}

/**
 * Linked asset types (SDK 1.14.0+)
 */
export enum LinkedAssetType {
  ODCS = 'odcs',
  ODPS = 'odps',
  CADS = 'cads',
  Relationship = 'relationship',
}

/**
 * Linked asset relationship type (SDK 1.14.0+)
 */
export enum LinkedAssetRelationship {
  Affects = 'affects',
  Implements = 'implements',
  Deprecates = 'deprecates',
}

/**
 * A linked asset reference (SDK 1.14.0+)
 */
export interface LinkedAsset {
  asset_type: LinkedAssetType;
  asset_id: string;
  asset_name?: string;
  relationship?: LinkedAssetRelationship;
}

/**
 * Compliance information for a decision (SDK 1.14.0+)
 */
export interface DecisionCompliance {
  regulatory_impact?: string;
  privacy_assessment?: string;
  security_assessment?: string;
  frameworks?: string[];
}

/**
 * A decision option with pros and cons
 */
export interface DecisionOption {
  title: string; // Note: SDK uses 'name', converter handles translation
  description: string;
  pros: string[];
  cons: string[];
  selected?: boolean;
}

/**
 * Architecture Decision Record following MADR format (SDK 1.14.0+)
 */
export interface Decision {
  id: string; // UUID - unique identifier, must be preserved
  number: number; // Timestamp-based number (YYMMDDHHmm format, e.g., 2601101806)
  title: string; // Decision title (max 200 chars)
  status: DecisionStatus;
  category: DecisionCategory;
  context: string; // Background and context for the decision
  decision: string; // The actual decision made
  consequences: string; // Positive and negative consequences
  options: DecisionOption[]; // Considered alternatives
  domain?: string; // Optional domain name
  domain_id?: string; // UUID - optional domain association
  workspace_id?: string; // UUID - workspace this decision belongs to
  date?: string; // Decision date (ISO timestamp)
  superseded_by?: string; // UUID - ID of decision that supersedes this one
  supersedes?: string; // UUID - ID of decision this one supersedes
  related_decisions?: string[]; // UUIDs of related decisions
  related_knowledge?: string[]; // UUIDs of related knowledge articles
  authors?: string[]; // List of authors
  deciders?: string[]; // List of decision makers (RACI Responsible)
  consulted?: string[]; // List of people consulted (RACI Consulted)
  informed?: string[]; // List of people informed (RACI Informed)
  drivers?: DecisionDriver[]; // Priority-ranked reasons (SDK 1.14.0+)
  linked_assets?: LinkedAsset[]; // References to data assets (SDK 1.14.0+)
  compliance?: DecisionCompliance; // Regulatory/security info (SDK 1.14.0+)
  confirmation_date?: string; // Review/confirmation date (SDK 1.14.0+)
  confirmation_notes?: string; // Review notes (SDK 1.14.0+)
  tags?: Tag[];
  notes?: string; // Additional notes
  custom_properties?: Record<string, unknown>;
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
  decided_at?: string; // ISO timestamp when decision was accepted/rejected
}

/**
 * Decision index entry for tracking decisions
 */
export interface DecisionIndexEntry {
  id: string; // UUID
  number: number;
  title: string;
  status: DecisionStatus;
  category: DecisionCategory;
  domain_id?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Decision index for a workspace
 */
export interface DecisionIndex {
  workspace_id: string;
  /** @deprecated No longer used - numbers are now timestamp-based */
  next_number?: number;
  decisions: DecisionIndexEntry[];
  last_updated: string; // ISO timestamp
}

/**
 * Decision filter options
 */
export interface DecisionFilter {
  status?: DecisionStatus[];
  category?: DecisionCategory[];
  domain_id?: string;
  search?: string;
  tags?: string[];
}

/**
 * Valid status transitions for decisions
 */
export const VALID_STATUS_TRANSITIONS: Record<DecisionStatus, DecisionStatus[]> = {
  [DecisionStatus.Draft]: [DecisionStatus.Proposed, DecisionStatus.Rejected],
  [DecisionStatus.Proposed]: [
    DecisionStatus.Accepted,
    DecisionStatus.Rejected,
    DecisionStatus.Draft,
  ],
  [DecisionStatus.Accepted]: [DecisionStatus.Deprecated, DecisionStatus.Superseded],
  [DecisionStatus.Deprecated]: [],
  [DecisionStatus.Superseded]: [],
  [DecisionStatus.Rejected]: [DecisionStatus.Draft],
};

/**
 * Check if a status transition is valid
 */
export function isValidStatusTransition(from: DecisionStatus, to: DecisionStatus): boolean {
  return VALID_STATUS_TRANSITIONS[from].includes(to);
}

/**
 * Get display label for decision status
 */
export function getDecisionStatusLabel(status: DecisionStatus): string {
  const labels: Record<DecisionStatus, string> = {
    [DecisionStatus.Draft]: 'Draft',
    [DecisionStatus.Proposed]: 'Proposed',
    [DecisionStatus.Accepted]: 'Accepted',
    [DecisionStatus.Deprecated]: 'Deprecated',
    [DecisionStatus.Superseded]: 'Superseded',
    [DecisionStatus.Rejected]: 'Rejected',
  };
  return labels[status];
}

/**
 * Get display label for decision category
 */
export function getDecisionCategoryLabel(category: DecisionCategory): string {
  const labels: Record<DecisionCategory, string> = {
    [DecisionCategory.Architecture]: 'Architecture',
    [DecisionCategory.Technology]: 'Technology',
    [DecisionCategory.Process]: 'Process',
    [DecisionCategory.Security]: 'Security',
    [DecisionCategory.Data]: 'Data',
    [DecisionCategory.Integration]: 'Integration',
    [DecisionCategory.Infrastructure]: 'Infrastructure',
    [DecisionCategory.Operations]: 'Operations',
    [DecisionCategory.Testing]: 'Testing',
    [DecisionCategory.Documentation]: 'Documentation',
    [DecisionCategory.Team]: 'Team',
    [DecisionCategory.Compliance]: 'Compliance',
    [DecisionCategory.Performance]: 'Performance',
    [DecisionCategory.Other]: 'Other',
  };
  return labels[category];
}

/**
 * Get color for decision status (for UI badges)
 */
export function getDecisionStatusColor(status: DecisionStatus): string {
  const colors: Record<DecisionStatus, string> = {
    [DecisionStatus.Draft]: 'gray',
    [DecisionStatus.Proposed]: 'blue',
    [DecisionStatus.Accepted]: 'green',
    [DecisionStatus.Deprecated]: 'orange',
    [DecisionStatus.Superseded]: 'purple',
    [DecisionStatus.Rejected]: 'red',
  };
  return colors[status];
}

/**
 * Get color for decision category (for UI badges)
 */
export function getDecisionCategoryColor(category: DecisionCategory): string {
  const colors: Record<DecisionCategory, string> = {
    [DecisionCategory.Architecture]: 'indigo',
    [DecisionCategory.Technology]: 'cyan',
    [DecisionCategory.Process]: 'teal',
    [DecisionCategory.Security]: 'red',
    [DecisionCategory.Data]: 'violet',
    [DecisionCategory.Integration]: 'amber',
    [DecisionCategory.Infrastructure]: 'slate',
    [DecisionCategory.Operations]: 'lime',
    [DecisionCategory.Testing]: 'emerald',
    [DecisionCategory.Documentation]: 'sky',
    [DecisionCategory.Team]: 'pink',
    [DecisionCategory.Compliance]: 'rose',
    [DecisionCategory.Performance]: 'orange',
    [DecisionCategory.Other]: 'gray',
  };
  return colors[category];
}

/**
 * Generate a timestamp-based decision number in YYMMDDHHmm format
 * This ensures unique numbers even when multiple users create decisions
 * on different systems and merge via Git
 */
export function generateDecisionNumber(): number {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  return parseInt(`${yy}${mm}${dd}${hh}${min}`, 10);
}

/**
 * Format decision number for display (e.g., "2601101806")
 * For timestamp-based numbers, just return the number as string
 */
export function formatDecisionNumber(num: number): string {
  // Timestamp-based numbers are 10 digits (YYMMDDHHmm)
  // Legacy 4-digit numbers should still be padded
  if (num < 10000) {
    return num.toString().padStart(4, '0');
  }
  return num.toString();
}

/**
 * Generate decision filename from number and title
 */
export function generateDecisionFilename(number: number, title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
  return `${formatDecisionNumber(number)}-${slug}.yaml`;
}
