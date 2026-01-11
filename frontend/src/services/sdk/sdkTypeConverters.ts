/**
 * SDK Type Converters
 *
 * Converts between frontend snake_case types and SDK camelCase types.
 * The SDK v1.14.0+ uses camelCase for all field names, while the frontend
 * historically used snake_case. These converters handle the translation
 * at the boundary between frontend and SDK.
 */

import type { Decision, DecisionOption, DecisionIndex, DecisionIndexEntry } from '@/types/decision';
import type { KnowledgeArticle, KnowledgeIndex, KnowledgeIndexEntry } from '@/types/knowledge';

// =============================================================================
// SDK Types (camelCase) - What the SDK returns/expects
// =============================================================================

/** SDK Decision type with camelCase fields */
export interface SDKDecision {
  id: string;
  number: number;
  title: string;
  status: string;
  category: string;
  domain?: string | null;
  domainId?: string | null;
  workspaceId?: string | null;
  date?: string;
  decidedAt?: string | null;
  authors?: string[];
  deciders?: string[];
  consulted?: string[];
  informed?: string[];
  context: string;
  drivers?: Array<{ description: string; priority?: string }>;
  options?: SDKDecisionOption[];
  decision: string;
  consequences?: string | null;
  linkedAssets?: Array<{
    assetType: string;
    assetId: string;
    assetName?: string;
    relationship?: string;
  }>;
  supersedes?: string | null;
  supersededBy?: string | null;
  relatedDecisions?: string[];
  relatedKnowledge?: string[];
  compliance?: {
    regulatoryImpact?: string;
    privacyAssessment?: string;
    securityAssessment?: string;
    frameworks?: string[];
  } | null;
  confirmationDate?: string | null;
  confirmationNotes?: string | null;
  tags?: string[];
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** SDK Decision Option with camelCase fields */
export interface SDKDecisionOption {
  name: string;
  description: string;
  pros: string[];
  cons: string[];
  selected?: boolean;
}

/** SDK Decision Index with camelCase fields */
export interface SDKDecisionIndex {
  workspaceId: string;
  decisions: SDKDecisionIndexEntry[];
  lastUpdated: string;
}

/** SDK Decision Index Entry with camelCase fields */
export interface SDKDecisionIndexEntry {
  id: string;
  number: number;
  title: string;
  status: string;
  category: string;
  domainId?: string;
  createdAt: string;
  updatedAt: string;
}

/** SDK Knowledge Article type with camelCase fields */
export interface SDKKnowledgeArticle {
  id: string;
  number: number;
  title: string;
  articleType: string;
  status: string;
  domain?: string | null;
  domainId?: string | null;
  workspaceId?: string | null;
  summary: string;
  content: string;
  authors: string[];
  reviewers?: string[];
  lastReviewed?: string | null;
  reviewedAt?: string | null;
  publishedAt?: string | null;
  archivedAt?: string | null;
  reviewFrequency?: string | null;
  audience?: string[];
  skillLevel?: string | null;
  linkedAssets?: Array<{
    assetType: string;
    assetId: string;
    assetName?: string;
    relationship?: string;
  }>;
  linkedDecisions?: string[];
  relatedDecisions?: string[];
  relatedArticles?: string[];
  prerequisites?: string[];
  seeAlso?: string[];
  tags?: string[];
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** SDK Knowledge Index with camelCase fields */
export interface SDKKnowledgeIndex {
  workspaceId: string;
  articles: SDKKnowledgeIndexEntry[];
  lastUpdated: string;
}

/** SDK Knowledge Index Entry with camelCase fields */
export interface SDKKnowledgeIndexEntry {
  id: string;
  number: number;
  title: string;
  articleType: string;
  status: string;
  domainId?: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

// =============================================================================
// Decision Converters
// =============================================================================

/**
 * Convert SDK Decision (camelCase) to Frontend Decision (snake_case)
 */
export function sdkDecisionToFrontend(sdk: SDKDecision): Decision {
  return {
    id: sdk.id,
    number: sdk.number,
    title: sdk.title,
    status: sdk.status as Decision['status'],
    category: sdk.category as Decision['category'],
    context: sdk.context,
    decision: sdk.decision,
    consequences: sdk.consequences || '',
    options: (sdk.options || []).map(sdkDecisionOptionToFrontend),
    domain_id: sdk.domainId || undefined,
    workspace_id: sdk.workspaceId || undefined,
    superseded_by: sdk.supersededBy || undefined,
    supersedes: sdk.supersedes || undefined,
    related_decisions: sdk.relatedDecisions || undefined,
    related_knowledge: sdk.relatedKnowledge || undefined,
    authors: sdk.authors || undefined,
    deciders: sdk.deciders || undefined,
    consulted: sdk.consulted || undefined,
    informed: sdk.informed || undefined,
    tags: sdk.tags || undefined,
    created_at: sdk.createdAt,
    updated_at: sdk.updatedAt,
    decided_at: sdk.decidedAt || undefined,
  };
}

/**
 * Convert Frontend Decision (snake_case) to SDK Decision (camelCase)
 */
export function frontendDecisionToSDK(frontend: Decision): SDKDecision {
  return {
    id: frontend.id,
    number: frontend.number,
    title: frontend.title,
    status: frontend.status,
    category: frontend.category,
    context: frontend.context,
    decision: frontend.decision,
    consequences: frontend.consequences || null,
    options: (frontend.options || []).map(frontendDecisionOptionToSDK),
    domainId: frontend.domain_id || null,
    workspaceId: frontend.workspace_id || null,
    supersededBy: frontend.superseded_by || null,
    supersedes: frontend.supersedes || null,
    relatedDecisions: frontend.related_decisions || [],
    relatedKnowledge: frontend.related_knowledge || [],
    authors: frontend.authors || [],
    deciders: frontend.deciders || [],
    consulted: frontend.consulted || [],
    informed: frontend.informed || [],
    tags: (frontend.tags || []).map(tagToString),
    createdAt: frontend.created_at,
    updatedAt: frontend.updated_at,
    decidedAt: frontend.decided_at || null,
  };
}

/**
 * Convert SDK Decision Option to Frontend format
 */
function sdkDecisionOptionToFrontend(sdk: SDKDecisionOption): DecisionOption {
  return {
    title: sdk.name, // SDK uses 'name', frontend uses 'title'
    description: sdk.description,
    pros: sdk.pros || [],
    cons: sdk.cons || [],
  };
}

/**
 * Convert Frontend Decision Option to SDK format
 */
function frontendDecisionOptionToSDK(frontend: DecisionOption): SDKDecisionOption {
  return {
    name: frontend.title, // Frontend uses 'title', SDK uses 'name'
    description: frontend.description,
    pros: frontend.pros || [],
    cons: frontend.cons || [],
  };
}

/**
 * Convert SDK Decision Index to Frontend format
 */
export function sdkDecisionIndexToFrontend(sdk: SDKDecisionIndex): DecisionIndex {
  return {
    workspace_id: sdk.workspaceId,
    decisions: sdk.decisions.map(sdkDecisionIndexEntryToFrontend),
    last_updated: sdk.lastUpdated,
  };
}

/**
 * Convert Frontend Decision Index to SDK format
 */
export function frontendDecisionIndexToSDK(frontend: DecisionIndex): SDKDecisionIndex {
  return {
    workspaceId: frontend.workspace_id,
    decisions: frontend.decisions.map(frontendDecisionIndexEntryToSDK),
    lastUpdated: frontend.last_updated,
  };
}

/**
 * Convert SDK Decision Index Entry to Frontend format
 */
function sdkDecisionIndexEntryToFrontend(sdk: SDKDecisionIndexEntry): DecisionIndexEntry {
  return {
    id: sdk.id,
    number: sdk.number,
    title: sdk.title,
    status: sdk.status as DecisionIndexEntry['status'],
    category: sdk.category as DecisionIndexEntry['category'],
    domain_id: sdk.domainId,
    created_at: sdk.createdAt,
    updated_at: sdk.updatedAt,
  };
}

/**
 * Convert Frontend Decision Index Entry to SDK format
 */
function frontendDecisionIndexEntryToSDK(frontend: DecisionIndexEntry): SDKDecisionIndexEntry {
  return {
    id: frontend.id,
    number: frontend.number,
    title: frontend.title,
    status: frontend.status,
    category: frontend.category,
    domainId: frontend.domain_id,
    createdAt: frontend.created_at,
    updatedAt: frontend.updated_at,
  };
}

// =============================================================================
// Knowledge Converters
// =============================================================================

/**
 * Convert SDK Knowledge Article (camelCase) to Frontend format (snake_case)
 */
export function sdkKnowledgeToFrontend(sdk: SDKKnowledgeArticle): KnowledgeArticle {
  return {
    id: sdk.id,
    number: sdk.number,
    title: sdk.title,
    type: sdk.articleType as KnowledgeArticle['type'],
    status: sdk.status as KnowledgeArticle['status'],
    summary: sdk.summary,
    content: sdk.content,
    domain_id: sdk.domainId || undefined,
    workspace_id: sdk.workspaceId || undefined,
    authors: sdk.authors || [],
    reviewers: sdk.reviewers || [],
    related_articles: sdk.relatedArticles || undefined,
    related_decisions: sdk.relatedDecisions || sdk.linkedDecisions || undefined,
    prerequisites: sdk.prerequisites || undefined,
    see_also: sdk.seeAlso || undefined,
    tags: sdk.tags || undefined,
    created_at: sdk.createdAt,
    updated_at: sdk.updatedAt,
    published_at: sdk.publishedAt || undefined,
    reviewed_at: sdk.reviewedAt || sdk.lastReviewed || undefined,
    archived_at: sdk.archivedAt || undefined,
  };
}

/**
 * Convert Frontend Knowledge Article (snake_case) to SDK format (camelCase)
 */
export function frontendKnowledgeToSDK(frontend: KnowledgeArticle): SDKKnowledgeArticle {
  return {
    id: frontend.id,
    number: frontend.number,
    title: frontend.title,
    articleType: frontend.type,
    status: frontend.status,
    summary: frontend.summary,
    content: frontend.content,
    domainId: frontend.domain_id || null,
    workspaceId: frontend.workspace_id || null,
    authors: frontend.authors || [],
    reviewers: frontend.reviewers || [],
    relatedArticles: frontend.related_articles || [],
    relatedDecisions: frontend.related_decisions || [],
    prerequisites: frontend.prerequisites || [],
    seeAlso: frontend.see_also || [],
    tags: (frontend.tags || []).map(tagToString),
    createdAt: frontend.created_at,
    updatedAt: frontend.updated_at,
    publishedAt: frontend.published_at || null,
    reviewedAt: frontend.reviewed_at || null,
    archivedAt: frontend.archived_at || null,
  };
}

/**
 * Convert SDK Knowledge Index to Frontend format
 */
export function sdkKnowledgeIndexToFrontend(sdk: SDKKnowledgeIndex): KnowledgeIndex {
  return {
    workspace_id: sdk.workspaceId,
    articles: sdk.articles.map(sdkKnowledgeIndexEntryToFrontend),
    last_updated: sdk.lastUpdated,
  };
}

/**
 * Convert Frontend Knowledge Index to SDK format
 */
export function frontendKnowledgeIndexToSDK(frontend: KnowledgeIndex): SDKKnowledgeIndex {
  return {
    workspaceId: frontend.workspace_id,
    articles: frontend.articles.map(frontendKnowledgeIndexEntryToSDK),
    lastUpdated: frontend.last_updated,
  };
}

/**
 * Convert SDK Knowledge Index Entry to Frontend format
 */
function sdkKnowledgeIndexEntryToFrontend(sdk: SDKKnowledgeIndexEntry): KnowledgeIndexEntry {
  return {
    id: sdk.id,
    number: sdk.number,
    title: sdk.title,
    type: sdk.articleType as KnowledgeIndexEntry['type'],
    status: sdk.status as KnowledgeIndexEntry['status'],
    domain_id: sdk.domainId,
    created_at: sdk.createdAt,
    updated_at: sdk.updatedAt,
    published_at: sdk.publishedAt,
  };
}

/**
 * Convert Frontend Knowledge Index Entry to SDK format
 */
function frontendKnowledgeIndexEntryToSDK(frontend: KnowledgeIndexEntry): SDKKnowledgeIndexEntry {
  return {
    id: frontend.id,
    number: frontend.number,
    title: frontend.title,
    articleType: frontend.type,
    status: frontend.status,
    domainId: frontend.domain_id,
    createdAt: frontend.created_at,
    updatedAt: frontend.updated_at,
    publishedAt: frontend.published_at,
  };
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Convert Tag to string (SDK only supports string tags)
 */
function tagToString(
  tag: string | { key: string; value: string } | { key: string; values: string[] }
): string {
  if (typeof tag === 'string') {
    return tag;
  }
  if ('value' in tag) {
    return `${tag.key}:${tag.value}`;
  }
  if ('values' in tag) {
    return `${tag.key}:${tag.values.join(',')}`;
  }
  return String(tag);
}

/**
 * Generic camelCase to snake_case converter for objects
 * Use this for dynamic/unknown object structures
 */
export function camelToSnake<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[snakeKey] = camelToSnake(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      result[snakeKey] = value.map((item) =>
        item && typeof item === 'object' ? camelToSnake(item as Record<string, unknown>) : item
      );
    } else {
      result[snakeKey] = value;
    }
  }
  return result;
}

/**
 * Generic snake_case to camelCase converter for objects
 * Use this for dynamic/unknown object structures
 */
export function snakeToCamel<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[camelKey] = snakeToCamel(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      result[camelKey] = value.map((item) =>
        item && typeof item === 'object' ? snakeToCamel(item as Record<string, unknown>) : item
      );
    } else {
      result[camelKey] = value;
    }
  }
  return result;
}
