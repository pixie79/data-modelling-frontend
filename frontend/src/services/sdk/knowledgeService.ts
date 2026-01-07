/**
 * Knowledge Service
 * Handles Knowledge Base articles via SDK 1.13.1+
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
 * Knowledge Service for SDK 1.13.1+ knowledge base management
 */
class KnowledgeService {
  /**
   * Check if knowledge features are supported by the current SDK
   */
  isSupported(): boolean {
    return sdkLoader.hasKnowledgeSupport();
  }

  /**
   * Load all knowledge articles for a workspace
   */
  async loadKnowledge(workspacePath: string): Promise<KnowledgeArticle[]> {
    if (!this.isSupported()) {
      console.warn('[KnowledgeService] Knowledge features require SDK 1.13.1+');
      return [];
    }

    const sdk = await sdkLoader.load();
    if (!sdk.load_knowledge) {
      console.warn('[KnowledgeService] load_knowledge method not available');
      return [];
    }

    try {
      const resultJson = sdk.load_knowledge(workspacePath);
      const result = JSON.parse(resultJson);

      if (result.error) {
        throw new Error(result.error);
      }

      return (result.articles ?? result) as KnowledgeArticle[];
    } catch (error) {
      console.error('[KnowledgeService] Failed to load knowledge:', error);
      return [];
    }
  }

  /**
   * Load a single article by ID
   */
  async loadArticle(workspacePath: string, articleId: string): Promise<KnowledgeArticle | null> {
    const articles = await this.loadKnowledge(workspacePath);
    return articles.find((a) => a.id === articleId) ?? null;
  }

  /**
   * Load the knowledge index
   */
  async loadKnowledgeIndex(workspacePath: string): Promise<KnowledgeIndex | null> {
    if (!this.isSupported()) {
      return null;
    }

    const sdk = await sdkLoader.load();
    if (!sdk.load_knowledge_index) {
      return null;
    }

    try {
      const resultJson = sdk.load_knowledge_index(workspacePath);
      const result = JSON.parse(resultJson);

      if (result.error) {
        throw new Error(result.error);
      }

      return result as KnowledgeIndex;
    } catch (error) {
      console.error('[KnowledgeService] Failed to load knowledge index:', error);
      return null;
    }
  }

  /**
   * Load articles filtered by domain
   */
  async loadKnowledgeByDomain(
    workspacePath: string,
    domainId: string
  ): Promise<KnowledgeArticle[]> {
    if (!this.isSupported()) {
      return [];
    }

    const sdk = await sdkLoader.load();

    // Try SDK method first
    if (sdk.load_knowledge_by_domain) {
      try {
        const resultJson = sdk.load_knowledge_by_domain(workspacePath, domainId);
        const result = JSON.parse(resultJson);
        return (result.articles ?? result) as KnowledgeArticle[];
      } catch (error) {
        console.error('[KnowledgeService] SDK domain filter failed:', error);
      }
    }

    // Fallback to client-side filtering
    const allArticles = await this.loadKnowledge(workspacePath);
    return allArticles.filter((a) => a.domain_id === domainId);
  }

  /**
   * Search knowledge articles
   */
  async searchKnowledge(workspacePath: string, query: string): Promise<KnowledgeSearchResult[]> {
    if (!this.isSupported()) {
      return [];
    }

    const sdk = await sdkLoader.load();

    // Try SDK search first
    if (sdk.search_knowledge) {
      try {
        const resultJson = sdk.search_knowledge(workspacePath, query);
        const result = JSON.parse(resultJson);
        return (result.results ?? result) as KnowledgeSearchResult[];
      } catch (error) {
        console.error('[KnowledgeService] SDK search failed:', error);
      }
    }

    // Fallback to client-side search
    const articles = await this.loadKnowledge(workspacePath);
    return this.clientSideSearch(articles, query);
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
   * Filter articles by criteria
   */
  async filterKnowledge(
    workspacePath: string,
    filter: KnowledgeFilter
  ): Promise<KnowledgeArticle[]> {
    let articles = await this.loadKnowledge(workspacePath);

    if (filter.domain_id) {
      articles = articles.filter((a) => a.domain_id === filter.domain_id);
    }

    if (filter.type && filter.type.length > 0) {
      articles = articles.filter((a) => filter.type!.includes(a.type));
    }

    if (filter.status && filter.status.length > 0) {
      articles = articles.filter((a) => filter.status!.includes(a.status));
    }

    if (filter.author) {
      articles = articles.filter((a) =>
        a.authors.some((author) => author.toLowerCase().includes(filter.author!.toLowerCase()))
      );
    }

    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      articles = articles.filter(
        (a) =>
          a.title.toLowerCase().includes(searchLower) ||
          a.summary.toLowerCase().includes(searchLower) ||
          a.content.toLowerCase().includes(searchLower)
      );
    }

    if (filter.tags && filter.tags.length > 0) {
      articles = articles.filter((a) => {
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

    return articles;
  }

  /**
   * Save an article
   */
  async saveArticle(workspacePath: string, article: KnowledgeArticle): Promise<void> {
    if (!this.isSupported()) {
      throw new Error('Knowledge features require SDK 1.13.1+');
    }

    const sdk = await sdkLoader.load();
    if (!sdk.save_knowledge) {
      throw new Error('save_knowledge method not available in SDK');
    }

    try {
      const articleJson = JSON.stringify(article);
      const resultJson = sdk.save_knowledge(articleJson, workspacePath);
      const result = JSON.parse(resultJson);

      if (!result.success) {
        throw new Error(result.error || 'Failed to save article');
      }

      console.log('[KnowledgeService] Article saved:', article.id);
    } catch (error) {
      console.error('[KnowledgeService] Failed to save article:', error);
      throw error;
    }
  }

  /**
   * Create a new article
   */
  async createArticle(
    workspacePath: string,
    data: {
      title: string;
      type: ArticleType;
      summary: string;
      content: string;
      domain_id?: string;
      authors?: string[];
    }
  ): Promise<KnowledgeArticle> {
    // Load index to get next number
    let index = await this.loadKnowledgeIndex(workspacePath);
    const nextNumber = index?.next_number ?? 1;

    const now = new Date().toISOString();
    const article: KnowledgeArticle = {
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

    // Save the article
    await this.saveArticle(workspacePath, article);

    // Update the index
    if (index) {
      const newEntry: KnowledgeIndexEntry = {
        id: article.id,
        number: article.number,
        title: article.title,
        type: article.type,
        status: article.status,
        domain_id: article.domain_id,
        created_at: article.created_at,
        updated_at: article.updated_at,
      };

      index.articles.push(newEntry);
      index.next_number = nextNumber + 1;
      index.last_updated = now;

      await this.saveKnowledgeIndex(workspacePath, index);
    }

    return article;
  }

  /**
   * Update an article
   */
  async updateArticle(
    workspacePath: string,
    articleId: string,
    updates: Partial<KnowledgeArticle>
  ): Promise<KnowledgeArticle> {
    const article = await this.loadArticle(workspacePath, articleId);
    if (!article) {
      throw new Error(`Article not found: ${articleId}`);
    }

    const updatedArticle: KnowledgeArticle = {
      ...article,
      ...updates,
      id: article.id, // Preserve ID
      number: article.number, // Preserve number
      created_at: article.created_at, // Preserve created_at
      updated_at: new Date().toISOString(),
    };

    await this.saveArticle(workspacePath, updatedArticle);

    // Update index if title, type, or status changed
    if (updates.title || updates.type || updates.status) {
      const index = await this.loadKnowledgeIndex(workspacePath);
      if (index) {
        const entryIndex = index.articles.findIndex((e) => e.id === articleId);
        const existingEntry = index.articles[entryIndex];
        if (entryIndex >= 0 && existingEntry) {
          index.articles[entryIndex] = {
            ...existingEntry,
            title: updatedArticle.title,
            type: updatedArticle.type,
            status: updatedArticle.status,
            updated_at: updatedArticle.updated_at,
            published_at: updatedArticle.published_at,
          };
          index.last_updated = updatedArticle.updated_at;
          await this.saveKnowledgeIndex(workspacePath, index);
        }
      }
    }

    return updatedArticle;
  }

  /**
   * Change article status with validation
   */
  async changeStatus(
    workspacePath: string,
    articleId: string,
    newStatus: ArticleStatus
  ): Promise<KnowledgeArticle> {
    const article = await this.loadArticle(workspacePath, articleId);
    if (!article) {
      throw new Error(`Article not found: ${articleId}`);
    }

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

    return this.updateArticle(workspacePath, articleId, updates);
  }

  /**
   * Delete an article
   */
  async deleteArticle(_workspacePath: string, _articleId: string): Promise<void> {
    // For now, we don't have a delete method in SDK
    throw new Error('Delete operation not yet supported');
  }

  /**
   * Save the knowledge index
   */
  async saveKnowledgeIndex(workspacePath: string, index: KnowledgeIndex): Promise<void> {
    if (!this.isSupported()) {
      throw new Error('Knowledge features require SDK 1.13.1+');
    }

    const sdk = await sdkLoader.load();
    if (!sdk.save_knowledge_index) {
      throw new Error('save_knowledge_index method not available in SDK');
    }

    try {
      const indexJson = JSON.stringify(index);
      const resultJson = sdk.save_knowledge_index(indexJson, workspacePath);
      const result = JSON.parse(resultJson);

      if (!result.success) {
        throw new Error(result.error || 'Failed to save knowledge index');
      }
    } catch (error) {
      console.error('[KnowledgeService] Failed to save knowledge index:', error);
      throw error;
    }
  }

  /**
   * Export an article to markdown
   */
  async exportToMarkdown(workspacePath: string, articleId: string): Promise<string> {
    const article = await this.loadArticle(workspacePath, articleId);
    if (!article) {
      throw new Error(`Article not found: ${articleId}`);
    }

    // Try SDK export first
    if (this.isSupported()) {
      const sdk = await sdkLoader.load();
      if (sdk.export_knowledge_markdown) {
        try {
          const articleJson = JSON.stringify(article);
          const markdown = sdk.export_knowledge_markdown(articleJson);
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
  async getArticlesByType(workspacePath: string, type: ArticleType): Promise<KnowledgeArticle[]> {
    return this.filterKnowledge(workspacePath, { type: [type] });
  }

  /**
   * Get articles by status
   */
  async getArticlesByStatus(
    workspacePath: string,
    status: ArticleStatus
  ): Promise<KnowledgeArticle[]> {
    return this.filterKnowledge(workspacePath, { status: [status] });
  }

  /**
   * Get published articles
   */
  async getPublishedArticles(workspacePath: string): Promise<KnowledgeArticle[]> {
    return this.getArticlesByStatus(workspacePath, ArticleStatus.Published);
  }

  /**
   * Get draft articles
   */
  async getDraftArticles(workspacePath: string): Promise<KnowledgeArticle[]> {
    return this.getArticlesByStatus(workspacePath, ArticleStatus.Draft);
  }
}

// Export singleton instance
export const knowledgeService = new KnowledgeService();
