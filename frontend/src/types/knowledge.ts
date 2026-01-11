/**
 * Type definitions for Knowledge Base articles
 * SDK 1.14.0+
 */

import type { Tag, LinkedAsset } from './decision';

// Re-export Tag for convenience
export type { Tag };

/**
 * Knowledge article type classification (SDK 1.14.0+)
 * Extended with additional types from SDK schema
 */
export enum ArticleType {
  Guide = 'guide',
  Reference = 'reference',
  Concept = 'concept',
  Tutorial = 'tutorial',
  Troubleshooting = 'troubleshooting',
  Runbook = 'runbook',
  Faq = 'faq',
  Glossary = 'glossary',
  Architecture = 'architecture',
  Api = 'api',
  ReleaseNotes = 'releaseNotes',
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
 * Skill level for article audience (SDK 1.14.0+)
 */
export enum SkillLevel {
  Beginner = 'beginner',
  Intermediate = 'intermediate',
  Advanced = 'advanced',
}

/**
 * Review frequency for articles (SDK 1.14.0+)
 */
export enum ReviewFrequency {
  Monthly = 'monthly',
  Quarterly = 'quarterly',
  Yearly = 'yearly',
}

/**
 * Knowledge article entity (SDK 1.14.0+)
 */
export interface KnowledgeArticle {
  id: string; // UUID - unique identifier, must be preserved
  number: number; // Timestamp-based number (YYMMDDHHmm format, e.g., 2601101806)
  title: string; // Article title (max 200 chars)
  type: ArticleType;
  status: ArticleStatus;
  summary: string; // Brief summary/abstract (max 500 chars)
  content: string; // Full article content (markdown)
  domain?: string; // Optional domain name
  domain_id?: string; // UUID - optional domain association
  workspace_id?: string; // UUID - workspace this article belongs to
  authors: string[]; // List of author names/emails (required, min 1)
  reviewers: string[]; // List of reviewer names/emails
  audience?: string[]; // Target audience (SDK 1.14.0+)
  skill_level?: SkillLevel; // Required skill level (SDK 1.14.0+)
  review_frequency?: ReviewFrequency; // How often to review (SDK 1.14.0+)
  linked_assets?: LinkedAsset[]; // References to data assets (SDK 1.14.0+)
  linked_decisions?: string[]; // UUIDs of linked decisions (SDK 1.14.0+)
  related_articles?: string[]; // UUIDs of related knowledge articles
  related_decisions?: string[]; // UUIDs of related decisions
  prerequisites?: string[]; // UUIDs of prerequisite articles
  see_also?: string[]; // UUIDs of related articles for "See Also" section
  tags?: Tag[];
  notes?: string; // Additional notes
  custom_properties?: Record<string, unknown>;
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
  published_at?: string; // ISO timestamp when article was published
  reviewed_at?: string; // ISO timestamp when article was last reviewed
  last_reviewed?: string; // Alternative field for last review date
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
  /** @deprecated No longer used - numbers are now timestamp-based */
  next_number?: number;
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
  skill_level?: SkillLevel;
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
    [ArticleType.Faq]: 'FAQ',
    [ArticleType.Glossary]: 'Glossary',
    [ArticleType.Architecture]: 'Architecture',
    [ArticleType.Api]: 'API',
    [ArticleType.ReleaseNotes]: 'Release Notes',
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
 * Get display label for skill level
 */
export function getSkillLevelLabel(level: SkillLevel): string {
  const labels: Record<SkillLevel, string> = {
    [SkillLevel.Beginner]: 'Beginner',
    [SkillLevel.Intermediate]: 'Intermediate',
    [SkillLevel.Advanced]: 'Advanced',
  };
  return labels[level];
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
    [ArticleType.Faq]: 'yellow',
    [ArticleType.Glossary]: 'indigo',
    [ArticleType.Architecture]: 'violet',
    [ArticleType.Api]: 'teal',
    [ArticleType.ReleaseNotes]: 'slate',
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
 * Get color for skill level (for UI badges)
 */
export function getSkillLevelColor(level: SkillLevel): string {
  const colors: Record<SkillLevel, string> = {
    [SkillLevel.Beginner]: 'green',
    [SkillLevel.Intermediate]: 'yellow',
    [SkillLevel.Advanced]: 'red',
  };
  return colors[level];
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
    [ArticleType.Faq]: 'question-mark-circle',
    [ArticleType.Glossary]: 'book-open',
    [ArticleType.Architecture]: 'cube-transparent',
    [ArticleType.Api]: 'code-bracket',
    [ArticleType.ReleaseNotes]: 'document-plus',
  };
  return icons[type];
}

/**
 * Generate a timestamp-based article number in YYMMDDHHmm format
 * This ensures unique numbers even when multiple users create articles
 * on different systems and merge via Git
 */
export function generateArticleNumber(): number {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  return parseInt(`${yy}${mm}${dd}${hh}${min}`, 10);
}

/**
 * Format article number for display (e.g., "2601101806")
 * For timestamp-based numbers, just return the number as string
 */
export function formatArticleNumber(num: number): string {
  // Timestamp-based numbers are 10 digits (YYMMDDHHmm)
  // Legacy 4-digit numbers should still be padded
  if (num < 10000) {
    return num.toString().padStart(4, '0');
  }
  return num.toString();
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
