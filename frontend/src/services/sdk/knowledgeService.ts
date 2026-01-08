/**
 * Knowledge Service
 * Handles Knowledge Base articles via SDK 1.13.3+
 *
 * SDK 1.13.3 WASM Methods:
 * - parse_knowledge_yaml(yaml: string) -> JSON string
 * - parse_knowledge_index_yaml(yaml: string) -> JSON string
 * - export_knowledge_to_yaml(article_json: string) -> YAML string
 * - export_knowledge_to_markdown(article_json: string) -> Markdown string
 * - search_knowledge_articles(articles_json: string, query: string) -> JSON string
 * - create_knowledge_article(number, title, article_type, summary, content) -> JSON string
 * - create_knowledge_index() -> JSON string
 * - add_article_to_knowledge_index(index_json, article_json, filename) -> JSON string
 *
 * NOTE: WASM SDK works with YAML strings, not file paths.
 * File I/O must be handled by the application layer.
 */

import { sdkLoader } from './sdkLoader';
import type {
  KnowledgeArticle,
  KnowledgeIndex,
  KnowledgeIndexEntry,
  KnowledgeFilter,
  KnowledgeSearchResult,
} from '@/types/knowledge';
import {
  ArticleType,
  ArticleStatus,
  isValidArticleStatusTransition,
  formatArticleNumber,
} from '@/types/knowledge';

/**
 * Knowledge Service for SDK 1.13.3+ knowledge base management
 *
 * This service provides methods to work with knowledge articles using the SDK.
 * In WASM mode, it works with YAML/JSON strings rather than file paths.
 */
class KnowledgeService {
  /**
   * Check if knowledge features are supported by the current SDK
   */
  isSupported(): boolean {
    return sdkLoader.hasKnowledgeSupport();
  }

  /**
   * Parse a knowledge article from YAML string
   */
  async parseKnowledgeYaml(yaml: string): Promise<KnowledgeArticle | null> {
    // Try SDK first if supported
    if (this.isSupported()) {
      const sdk = await sdkLoader.load();
      if (sdk.parse_knowledge_yaml) {
        try {
          const resultJson = sdk.parse_knowledge_yaml(yaml);
          const result = JSON.parse(resultJson);

          if (result.error) {
            throw new Error(result.error);
          }

          return result as KnowledgeArticle;
        } catch (error) {
          console.warn('[KnowledgeService] SDK parse failed, trying fallback:', error);
        }
      }
    }

    // Fallback: Parse YAML directly using js-yaml
    return this.parseKnowledgeYamlFallback(yaml);
  }

  /**
   * Fallback parser for knowledge articles when SDK is not available
   */
  private async parseKnowledgeYamlFallback(yamlContent: string): Promise<KnowledgeArticle | null> {
    try {
      const jsYaml = await import('js-yaml');
      const parsed = jsYaml.load(yamlContent) as any;

      if (!parsed || typeof parsed !== 'object') {
        console.error('[KnowledgeService] Invalid YAML content');
        return null;
      }

      // Map YAML fields to KnowledgeArticle structure
      const article: KnowledgeArticle = {
        id: parsed.id || crypto.randomUUID(),
        number: parsed.number || 0,
        title: parsed.title || 'Untitled Article',
        type: parsed.type || 'guide',
        status: parsed.status || 'draft',
        summary: parsed.summary || '',
        content: parsed.content || '',
        domain_id: parsed.domain_id,
        workspace_id: parsed.workspace_id,
        authors: Array.isArray(parsed.authors) ? parsed.authors : [],
        reviewers: Array.isArray(parsed.reviewers) ? parsed.reviewers : [],
        tags: parsed.tags,
        created_at: parsed.created_at || new Date().toISOString(),
        updated_at: parsed.updated_at || new Date().toISOString(),
        published_at: parsed.published_at,
        reviewed_at: parsed.reviewed_at,
        archived_at: parsed.archived_at,
      };

      console.log(`[KnowledgeService] Parsed article via fallback: ${article.title}`);
      return article;
    } catch (error) {
      console.error('[KnowledgeService] Fallback parse failed:', error);
      return null;
    }
  }

  /**
   * Parse a knowledge index from YAML string
   */
  async parseKnowledgeIndexYaml(yaml: string): Promise<KnowledgeIndex | null> {
    if (!this.isSupported()) {
      return null;
    }

    const sdk = await sdkLoader.load();
    if (!sdk.parse_knowledge_index_yaml) {
      return null;
    }

    try {
      const resultJson = sdk.parse_knowledge_index_yaml(yaml);
      const result = JSON.parse(resultJson);

      if (result.error) {
        throw new Error(result.error);
      }

      return result as KnowledgeIndex;
    } catch (error) {
      console.error('[KnowledgeService] Failed to parse knowledge index YAML:', error);
      return null;
    }
  }

  /**
   * Export an article to YAML string
   */
  async exportKnowledgeToYaml(article: KnowledgeArticle): Promise<string | null> {
    if (!this.isSupported()) {
      throw new Error('Knowledge features require SDK 1.13.3+');
    }

    const sdk = await sdkLoader.load();
    if (!sdk.export_knowledge_to_yaml) {
      throw new Error('export_knowledge_to_yaml method not available in SDK');
    }

    try {
      const articleJson = JSON.stringify(article);
      const yaml = sdk.export_knowledge_to_yaml(articleJson);
      return yaml;
    } catch (error) {
      console.error('[KnowledgeService] Failed to export knowledge to YAML:', error);
      throw error;
    }
  }

  /**
   * Export an article to Markdown string
   */
  async exportKnowledgeToMarkdown(article: KnowledgeArticle): Promise<string> {
    // Try SDK export first
    if (this.isSupported()) {
      const sdk = await sdkLoader.load();
      if (sdk.export_knowledge_to_markdown) {
        try {
          const articleJson = JSON.stringify(article);
          const markdown = sdk.export_knowledge_to_markdown(articleJson);
          return markdown;
        } catch {
          console.warn('[KnowledgeService] SDK markdown export failed, using fallback');
        }
      }
    }

    // Fallback to client-side markdown generation
    return this.generateMarkdown(article);
  }

  /**
   * Search knowledge articles using SDK
   */
  async searchKnowledgeViaSDK(
    articles: KnowledgeArticle[],
    query: string
  ): Promise<KnowledgeSearchResult[]> {
    if (!this.isSupported()) {
      return this.clientSideSearch(articles, query);
    }

    const sdk = await sdkLoader.load();
    if (!sdk.search_knowledge_articles) {
      return this.clientSideSearch(articles, query);
    }

    try {
      const articlesJson = JSON.stringify(articles);
      const resultJson = sdk.search_knowledge_articles(articlesJson, query);
      const result = JSON.parse(resultJson);

      if (result.error) {
        throw new Error(result.error);
      }

      return (result.results ?? result) as KnowledgeSearchResult[];
    } catch (error) {
      console.error('[KnowledgeService] SDK search failed:', error);
      return this.clientSideSearch(articles, query);
    }
  }

  /**
   * Create a new knowledge article using SDK
   */
  async createArticleViaSDK(
    number: number,
    title: string,
    articleType: string,
    summary: string,
    content: string
  ): Promise<KnowledgeArticle | null> {
    if (!this.isSupported()) {
      return null;
    }

    const sdk = await sdkLoader.load();
    if (!sdk.create_knowledge_article) {
      return null;
    }

    try {
      const resultJson = sdk.create_knowledge_article(number, title, articleType, summary, content);
      const result = JSON.parse(resultJson);

      if (result.error) {
        throw new Error(result.error);
      }

      return result as KnowledgeArticle;
    } catch (error) {
      console.error('[KnowledgeService] Failed to create article via SDK:', error);
      return null;
    }
  }

  /**
   * Create a new empty knowledge index using SDK
   */
  async createKnowledgeIndexViaSDK(): Promise<KnowledgeIndex | null> {
    if (!this.isSupported()) {
      return null;
    }

    const sdk = await sdkLoader.load();
    if (!sdk.create_knowledge_index) {
      return null;
    }

    try {
      const resultJson = sdk.create_knowledge_index();
      const result = JSON.parse(resultJson);

      if (result.error) {
        throw new Error(result.error);
      }

      return result as KnowledgeIndex;
    } catch (error) {
      console.error('[KnowledgeService] Failed to create knowledge index via SDK:', error);
      return null;
    }
  }

  /**
   * Add an article to the index using SDK
   */
  async addArticleToIndex(
    index: KnowledgeIndex,
    article: KnowledgeArticle,
    filename: string
  ): Promise<KnowledgeIndex | null> {
    if (!this.isSupported()) {
      return null;
    }

    const sdk = await sdkLoader.load();
    if (!sdk.add_article_to_knowledge_index) {
      return null;
    }

    try {
      const indexJson = JSON.stringify(index);
      const articleJson = JSON.stringify(article);
      const resultJson = sdk.add_article_to_knowledge_index(indexJson, articleJson, filename);
      const result = JSON.parse(resultJson);

      if (result.error) {
        throw new Error(result.error);
      }

      return result as KnowledgeIndex;
    } catch (error) {
      console.error('[KnowledgeService] Failed to add article to index:', error);
      return null;
    }
  }

  // ============================================================
  // Higher-level methods that work with in-memory data
  // These don't require file I/O and work with article arrays
  // ============================================================

  /**
   * Find an article by ID from an array of articles
   */
  findArticleById(articles: KnowledgeArticle[], articleId: string): KnowledgeArticle | null {
    return articles.find((a) => a.id === articleId) ?? null;
  }

  /**
   * Filter articles by criteria
   */
  filterKnowledge(articles: KnowledgeArticle[], filter: KnowledgeFilter): KnowledgeArticle[] {
    let filtered = [...articles];

    if (filter.domain_id) {
      filtered = filtered.filter((a) => a.domain_id === filter.domain_id);
    }

    if (filter.type && filter.type.length > 0) {
      filtered = filtered.filter((a) => filter.type!.includes(a.type));
    }

    if (filter.status && filter.status.length > 0) {
      filtered = filtered.filter((a) => filter.status!.includes(a.status));
    }

    if (filter.author) {
      filtered = filtered.filter((a) =>
        a.authors.some((author) => author.toLowerCase().includes(filter.author!.toLowerCase()))
      );
    }

    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      filtered = filtered.filter(
        (a) =>
          a.title.toLowerCase().includes(searchLower) ||
          a.summary.toLowerCase().includes(searchLower) ||
          a.content.toLowerCase().includes(searchLower)
      );
    }

    if (filter.tags && filter.tags.length > 0) {
      filtered = filtered.filter((a) => {
        if (!a.tags) return false;
        return filter.tags!.some((filterTag) =>
          a.tags!.some((t) => {
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
   * Client-side search fallback
   */
  private clientSideSearch(articles: KnowledgeArticle[], query: string): KnowledgeSearchResult[] {
    const queryLower = query.toLowerCase();
    const results: KnowledgeSearchResult[] = [];

    for (const article of articles) {
      let score = 0;
      const highlights: KnowledgeSearchResult['highlights'] = {};

      // Title match (highest weight)
      if (article.title.toLowerCase().includes(queryLower)) {
        score += 0.5;
        highlights.title = this.highlightMatch(article.title, query);
      }

      // Summary match
      if (article.summary.toLowerCase().includes(queryLower)) {
        score += 0.3;
        highlights.summary = this.highlightMatch(article.summary, query);
      }

      // Content match
      if (article.content.toLowerCase().includes(queryLower)) {
        score += 0.2;
        // Get snippet around match
        const matchIndex = article.content.toLowerCase().indexOf(queryLower);
        const start = Math.max(0, matchIndex - 50);
        const end = Math.min(article.content.length, matchIndex + query.length + 50);
        highlights.content = '...' + article.content.slice(start, end) + '...';
      }

      if (score > 0) {
        results.push({ article, score, highlights });
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);
    return results;
  }

  /**
   * Highlight matching text
   */
  private highlightMatch(text: string, query: string): string {
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '**$1**');
  }

  /**
   * Create a new article object (client-side)
   */
  createArticle(
    data: {
      title: string;
      type: ArticleType;
      summary: string;
      content: string;
      domain_id?: string;
      authors?: string[];
    },
    nextNumber: number = 1
  ): KnowledgeArticle {
    const now = new Date().toISOString();
    return {
      id: crypto.randomUUID(),
      number: nextNumber,
      title: data.title,
      type: data.type,
      status: ArticleStatus.Draft,
      summary: data.summary,
      content: data.content,
      domain_id: data.domain_id,
      authors: data.authors ?? [],
      reviewers: [],
      created_at: now,
      updated_at: now,
    };
  }

  /**
   * Update an article object
   */
  updateArticle(article: KnowledgeArticle, updates: Partial<KnowledgeArticle>): KnowledgeArticle {
    return {
      ...article,
      ...updates,
      id: article.id, // Preserve ID
      number: article.number, // Preserve number
      created_at: article.created_at, // Preserve created_at
      updated_at: new Date().toISOString(),
    };
  }

  /**
   * Change article status with validation
   */
  changeStatus(article: KnowledgeArticle, newStatus: ArticleStatus): KnowledgeArticle {
    if (!isValidArticleStatusTransition(article.status, newStatus)) {
      throw new Error(`Invalid status transition from ${article.status} to ${newStatus}`);
    }

    const updates: Partial<KnowledgeArticle> = {
      status: newStatus,
    };

    // Set timestamps for status changes
    if (newStatus === ArticleStatus.Published && !article.published_at) {
      updates.published_at = new Date().toISOString();
    }

    if (newStatus === ArticleStatus.Review) {
      updates.reviewed_at = new Date().toISOString();
    }

    if (newStatus === ArticleStatus.Archived) {
      updates.archived_at = new Date().toISOString();
    }

    return this.updateArticle(article, updates);
  }

  /**
   * Create a knowledge index entry from an article
   */
  createIndexEntry(article: KnowledgeArticle): KnowledgeIndexEntry {
    return {
      id: article.id,
      number: article.number,
      title: article.title,
      type: article.type,
      status: article.status,
      domain_id: article.domain_id,
      created_at: article.created_at,
      updated_at: article.updated_at,
      published_at: article.published_at,
    };
  }

  /**
   * Generate markdown for an article (fallback)
   */
  private generateMarkdown(article: KnowledgeArticle): string {
    const lines: string[] = [
      `# ${formatArticleNumber(article.number)}. ${article.title}`,
      '',
      `**Type:** ${article.type}`,
      `**Status:** ${article.status}`,
    ];

    if (article.authors.length > 0) {
      lines.push(`**Authors:** ${article.authors.join(', ')}`);
    }

    if (article.published_at) {
      lines.push(`**Published:** ${new Date(article.published_at).toLocaleDateString()}`);
    }

    lines.push('');
    lines.push('## Summary');
    lines.push('');
    lines.push(article.summary);
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push(article.content);

    if (article.tags && article.tags.length > 0) {
      lines.push('');
      lines.push('---');
      lines.push('');
      const tagStrings = article.tags.map((t) => {
        if (typeof t === 'string') return t;
        if ('value' in t && 'key' in t) return `${t.key}:${t.value}`;
        if ('value' in t) return t.value;
        return '';
      });
      lines.push(`**Tags:** ${tagStrings.join(', ')}`);
    }

    return lines.join('\n');
  }

  /**
   * Get articles by type
   */
  getArticlesByType(articles: KnowledgeArticle[], type: ArticleType): KnowledgeArticle[] {
    return this.filterKnowledge(articles, { type: [type] });
  }

  /**
   * Get articles by status
   */
  getArticlesByStatus(articles: KnowledgeArticle[], status: ArticleStatus): KnowledgeArticle[] {
    return this.filterKnowledge(articles, { status: [status] });
  }

  /**
   * Get published articles
   */
  getPublishedArticles(articles: KnowledgeArticle[]): KnowledgeArticle[] {
    return this.getArticlesByStatus(articles, ArticleStatus.Published);
  }

  /**
   * Get draft articles
   */
  getDraftArticles(articles: KnowledgeArticle[]): KnowledgeArticle[] {
    return this.getArticlesByStatus(articles, ArticleStatus.Draft);
  }
}

// Export singleton instance
export const knowledgeService = new KnowledgeService();
