/**
 * Type definitions for Knowledge Base articles
 * SDK 1.13.1+
 */

import type { Tag } from './decision';

// Re-export Tag for convenience
export type { Tag };

/**
 * Knowledge article type classification
 */
export enum ArticleType {
  Guide = 'guide',
  Reference = 'reference',
  Concept = 'concept',
  Tutorial = 'tutorial',
  Troubleshooting = 'troubleshooting',
  Runbook = 'runbook',
}

/**
 * Knowledge article lifecycle status
 */
export enum ArticleStatus {
  Draft = 'draft',
  Review = 'review',
  Published = 'published',
  Archived = 'archived',
  Deprecated = 'deprecated',
}

/**
 * Knowledge article entity
 */
export interface KnowledgeArticle {
  id: string; // UUID
  number: number; // Auto-generated article number (e.g., 0001)
  title: string; // Article title (max 255 chars)
  type: ArticleType;
  status: ArticleStatus;
  summary: string; // Brief summary/abstract
  content: string; // Full article content (markdown)
  domain_id?: string; // UUID - optional domain association
  workspace_id?: string; // UUID - workspace this article belongs to
  authors: string[]; // List of author names/emails
  reviewers: string[]; // List of reviewer names/emails
  related_articles?: string[]; // UUIDs of related knowledge articles
  related_decisions?: string[]; // UUIDs of related decisions
  prerequisites?: string[]; // UUIDs of prerequisite articles
  see_also?: string[]; // UUIDs of related articles for "See Also" section
  tags?: Tag[];
  custom_properties?: Record<string, unknown>;
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
  published_at?: string; // ISO timestamp when article was published
  reviewed_at?: string; // ISO timestamp when article was last reviewed
  archived_at?: string; // ISO timestamp when article was archived
}

/**
 * Knowledge index entry for tracking articles
 */
export interface KnowledgeIndexEntry {
  id: string; // UUID
  number: number;
  title: string;
  type: ArticleType;
  status: ArticleStatus;
  domain_id?: string;
  created_at: string;
  updated_at: string;
  published_at?: string;
}

/**
 * Knowledge index for a workspace
 */
export interface KnowledgeIndex {
  workspace_id: string;
  next_number: number;
  articles: KnowledgeIndexEntry[];
  last_updated: string; // ISO timestamp
}

/**
 * Knowledge article filter options
 */
export interface KnowledgeFilter {
  type?: ArticleType[];
  status?: ArticleStatus[];
  domain_id?: string;
  search?: string;
  tags?: string[];
  author?: string;
}

/**
 * Knowledge search result
 */
export interface KnowledgeSearchResult {
  article: KnowledgeArticle;
  score: number; // Relevance score (0-1)
  highlights?: {
    title?: string; // Highlighted title snippet
    summary?: string; // Highlighted summary snippet
    content?: string; // Highlighted content snippet
  };
}

/**
 * Valid status transitions for knowledge articles
 */
export const VALID_ARTICLE_STATUS_TRANSITIONS: Record<ArticleStatus, ArticleStatus[]> = {
  [ArticleStatus.Draft]: [ArticleStatus.Review],
  [ArticleStatus.Review]: [ArticleStatus.Published, ArticleStatus.Draft],
  [ArticleStatus.Published]: [
    ArticleStatus.Archived,
    ArticleStatus.Deprecated,
    ArticleStatus.Review,
  ],
  [ArticleStatus.Archived]: [ArticleStatus.Published],
  [ArticleStatus.Deprecated]: [],
};

/**
 * Check if a status transition is valid
 */
export function isValidArticleStatusTransition(from: ArticleStatus, to: ArticleStatus): boolean {
  return VALID_ARTICLE_STATUS_TRANSITIONS[from].includes(to);
}

/**
 * Get display label for article type
 */
export function getArticleTypeLabel(type: ArticleType): string {
  const labels: Record<ArticleType, string> = {
    [ArticleType.Guide]: 'Guide',
    [ArticleType.Reference]: 'Reference',
    [ArticleType.Concept]: 'Concept',
    [ArticleType.Tutorial]: 'Tutorial',
    [ArticleType.Troubleshooting]: 'Troubleshooting',
    [ArticleType.Runbook]: 'Runbook',
  };
  return labels[type];
}

/**
 * Get display label for article status
 */
export function getArticleStatusLabel(status: ArticleStatus): string {
  const labels: Record<ArticleStatus, string> = {
    [ArticleStatus.Draft]: 'Draft',
    [ArticleStatus.Review]: 'In Review',
    [ArticleStatus.Published]: 'Published',
    [ArticleStatus.Archived]: 'Archived',
    [ArticleStatus.Deprecated]: 'Deprecated',
  };
  return labels[status];
}

/**
 * Get color for article type (for UI badges)
 */
export function getArticleTypeColor(type: ArticleType): string {
  const colors: Record<ArticleType, string> = {
    [ArticleType.Guide]: 'blue',
    [ArticleType.Reference]: 'purple',
    [ArticleType.Concept]: 'cyan',
    [ArticleType.Tutorial]: 'green',
    [ArticleType.Troubleshooting]: 'orange',
    [ArticleType.Runbook]: 'red',
  };
  return colors[type];
}

/**
 * Get color for article status (for UI badges)
 */
export function getArticleStatusColor(status: ArticleStatus): string {
  const colors: Record<ArticleStatus, string> = {
    [ArticleStatus.Draft]: 'gray',
    [ArticleStatus.Review]: 'yellow',
    [ArticleStatus.Published]: 'green',
    [ArticleStatus.Archived]: 'slate',
    [ArticleStatus.Deprecated]: 'red',
  };
  return colors[status];
}

/**
 * Get icon name for article type
 */
export function getArticleTypeIcon(type: ArticleType): string {
  const icons: Record<ArticleType, string> = {
    [ArticleType.Guide]: 'book-open',
    [ArticleType.Reference]: 'document-text',
    [ArticleType.Concept]: 'light-bulb',
    [ArticleType.Tutorial]: 'academic-cap',
    [ArticleType.Troubleshooting]: 'wrench-screwdriver',
    [ArticleType.Runbook]: 'clipboard-document-list',
  };
  return icons[type];
}

/**
 * Format article number as padded string (e.g., "0001")
 */
export function formatArticleNumber(num: number): string {
  return num.toString().padStart(4, '0');
}

/**
 * Generate article filename from number and title
 */
export function generateArticleFilename(number: number, title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
  return `${formatArticleNumber(number)}-${slug}.yaml`;
}

/**
 * Create a new draft article with default values
 */
export function createNewArticle(
  workspaceId: string,
  number: number,
  title: string,
  type: ArticleType = ArticleType.Guide
): Omit<KnowledgeArticle, 'id'> {
  const now = new Date().toISOString();
  return {
    number,
    title,
    type,
    status: ArticleStatus.Draft,
    summary: '',
    content: '',
    workspace_id: workspaceId,
    authors: [],
    reviewers: [],
    tags: [],
    created_at: now,
    updated_at: now,
  };
}
