/**
 * Knowledge Service
 * Handles Knowledge Base articles via SDK 1.14.0+
 *
 * SDK 1.14.0 WASM Methods:
 * - parse_knowledge_yaml(yaml: string) -> JSON string
 * - parse_knowledge_index_yaml(yaml: string) -> JSON string
 * - export_knowledge_to_yaml(article_json: string) -> YAML string
 * - export_knowledge_to_markdown(article_json: string) -> Markdown string
 * - export_knowledge_to_branded_markdown(article_json, branding_json?) -> Markdown string
 * - export_knowledge_to_pdf(article_json, branding_json?) -> JSON with base64 PDF
 * - search_knowledge_articles(articles_json: string, query: string) -> JSON string
 * - create_knowledge_article(number, title, summary, content, author) -> JSON string
 * - create_knowledge_index() -> JSON string
 * - add_article_to_knowledge_index(index_json, article_json, filename) -> JSON string
 *
 * NOTE: WASM SDK works with YAML strings, not file paths.
 * File I/O must be handled by the application layer.
 */

import { sdkLoader } from './sdkLoader';
import {
  frontendKnowledgeToSDK,
  sdkKnowledgeToFrontend,
  sdkKnowledgeIndexToFrontend,
  frontendKnowledgeIndexToSDK,
} from './sdkTypeConverters';
import type { BrandingConfig, PDFExportResult } from './decisionService';
import { DEFAULT_BRANDING } from './decisionService';
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
  generateArticleNumber,
} from '@/types/knowledge';

/**
 * Knowledge Service for SDK 1.14.0+ knowledge base management
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
   * Check if PDF export is supported
   */
  hasPDFExport(): boolean {
    return sdkLoader.hasPDFExport();
  }

  /**
   * Check if markdown export is supported
   */
  hasMarkdownExport(): boolean {
    return sdkLoader.hasMarkdownExport();
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
          const sdkArticle = JSON.parse(resultJson);

          if (sdkArticle.error) {
            throw new Error(sdkArticle.error);
          }

          // Convert from SDK camelCase to frontend snake_case
          return sdkKnowledgeToFrontend(sdkArticle);
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
      const parsed = jsYaml.load(yamlContent) as Record<string, unknown>;

      if (!parsed || typeof parsed !== 'object') {
        console.error('[KnowledgeService] Invalid YAML content');
        return null;
      }

      // Handle both camelCase (SDK) and snake_case (legacy) field names
      const article: KnowledgeArticle = {
        id: (parsed.id as string) || crypto.randomUUID(),
        number: (parsed.number as number) || 0,
        title: (parsed.title as string) || 'Untitled Article',
        type: ((parsed.articleType as string) || (parsed.type as string) || 'guide') as ArticleType,
        status: ((parsed.status as string) || 'draft') as ArticleStatus,
        summary: (parsed.summary as string) || '',
        content: (parsed.content as string) || '',
        domain_id: (parsed.domainId as string) || (parsed.domain_id as string),
        workspace_id: (parsed.workspaceId as string) || (parsed.workspace_id as string),
        authors: Array.isArray(parsed.authors) ? (parsed.authors as string[]) : [],
        reviewers: Array.isArray(parsed.reviewers) ? (parsed.reviewers as string[]) : [],
        tags: (parsed.tags as string[]) || undefined,
        created_at:
          (parsed.createdAt as string) || (parsed.created_at as string) || new Date().toISOString(),
        updated_at:
          (parsed.updatedAt as string) || (parsed.updated_at as string) || new Date().toISOString(),
        published_at: (parsed.publishedAt as string) || (parsed.published_at as string),
        reviewed_at:
          (parsed.reviewedAt as string) ||
          (parsed.reviewed_at as string) ||
          (parsed.lastReviewed as string),
        archived_at: (parsed.archivedAt as string) || (parsed.archived_at as string),
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
      const sdkIndex = JSON.parse(resultJson);

      if (sdkIndex.error) {
        throw new Error(sdkIndex.error);
      }

      // Convert from SDK camelCase to frontend snake_case
      return sdkKnowledgeIndexToFrontend(sdkIndex);
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
      throw new Error('Knowledge features require SDK 1.14.0+');
    }

    const sdk = await sdkLoader.load();
    if (!sdk.export_knowledge_to_yaml) {
      throw new Error('export_knowledge_to_yaml method not available in SDK');
    }

    try {
      // Convert from frontend snake_case to SDK camelCase
      const sdkArticle = frontendKnowledgeToSDK(article);
      const articleJson = JSON.stringify(sdkArticle);
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
  async exportKnowledgeToMarkdown(
    article: KnowledgeArticle,
    branding?: BrandingConfig
  ): Promise<string> {
    // Try SDK export first
    if (this.hasMarkdownExport()) {
      const sdk = await sdkLoader.load();

      try {
        // Convert from frontend snake_case to SDK camelCase
        const sdkArticle = frontendKnowledgeToSDK(article);
        const articleJson = JSON.stringify(sdkArticle);

        // Use branded markdown if branding provided
        if (branding && sdk.export_knowledge_to_branded_markdown) {
          const brandingJson = JSON.stringify(branding);
          return sdk.export_knowledge_to_branded_markdown(articleJson, brandingJson);
        }

        // Use standard markdown
        if (sdk.export_knowledge_to_markdown) {
          return sdk.export_knowledge_to_markdown(articleJson);
        }
      } catch (error) {
        console.warn('[KnowledgeService] SDK markdown export failed, using fallback:', error);
      }
    }

    // Fallback to client-side markdown generation
    return this.generateMarkdown(article);
  }

  /**
   * Export an article to PDF (SDK 1.14.0+)
   * Returns base64-encoded PDF data
   */
  async exportKnowledgeToPDF(
    article: KnowledgeArticle,
    branding?: BrandingConfig
  ): Promise<PDFExportResult> {
    if (!this.hasPDFExport()) {
      throw new Error('PDF export requires SDK 1.14.0+');
    }

    const sdk = await sdkLoader.load();
    if (!sdk.export_knowledge_to_pdf) {
      throw new Error('export_knowledge_to_pdf method not available in SDK');
    }

    try {
      // Convert from frontend snake_case to SDK camelCase
      const sdkArticle = frontendKnowledgeToSDK(article);
      const articleJson = JSON.stringify(sdkArticle);

      // Use provided branding or default
      const brandingToUse = branding || DEFAULT_BRANDING;
      const brandingJson = JSON.stringify(brandingToUse);

      const resultJson = sdk.export_knowledge_to_pdf(articleJson, brandingJson);
      const result = JSON.parse(resultJson);

      if (result.error) {
        throw new Error(result.error);
      }

      return {
        data: result.data || result.pdf_data || result.pdfData,
        filename:
          result.filename ||
          `KB-${formatArticleNumber(article.number)}-${article.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.pdf`,
        mimeType: 'application/pdf',
      };
    } catch (error) {
      console.error('[KnowledgeService] Failed to export knowledge to PDF:', error);
      throw error;
    }
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
      // Convert to SDK format
      const sdkArticles = articles.map((article) => frontendKnowledgeToSDK(article));
      const articlesJson = JSON.stringify(sdkArticles);
      const resultJson = sdk.search_knowledge_articles(articlesJson, query);
      const result = JSON.parse(resultJson);

      if (result.error) {
        throw new Error(result.error);
      }

      // Convert results back to frontend format
      const sdkResults = result.results ?? result;
      return (sdkResults as Array<{ article: unknown; score: number }>).map((r) => ({
        article: sdkKnowledgeToFrontend(r.article as Parameters<typeof sdkKnowledgeToFrontend>[0]),
        score: r.score,
      }));
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
    summary: string,
    content: string,
    author: string
  ): Promise<KnowledgeArticle | null> {
    if (!this.isSupported()) {
      return null;
    }

    const sdk = await sdkLoader.load();
    if (!sdk.create_knowledge_article) {
      return null;
    }

    try {
      const resultJson = sdk.create_knowledge_article(number, title, summary, content, author);
      const sdkArticle = JSON.parse(resultJson);

      if (sdkArticle.error) {
        throw new Error(sdkArticle.error);
      }

      // Convert from SDK camelCase to frontend snake_case
      return sdkKnowledgeToFrontend(sdkArticle);
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
      const sdkIndex = JSON.parse(resultJson);

      if (sdkIndex.error) {
        throw new Error(sdkIndex.error);
      }

      // Convert from SDK camelCase to frontend snake_case
      return sdkKnowledgeIndexToFrontend(sdkIndex);
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
      // Convert to SDK format
      const sdkIndex = frontendKnowledgeIndexToSDK(index);
      const sdkArticle = frontendKnowledgeToSDK(article);

      const indexJson = JSON.stringify(sdkIndex);
      const articleJson = JSON.stringify(sdkArticle);
      const resultJson = sdk.add_article_to_knowledge_index(indexJson, articleJson, filename);
      const result = JSON.parse(resultJson);

      if (result.error) {
        throw new Error(result.error);
      }

      // Convert back to frontend format
      return sdkKnowledgeIndexToFrontend(result);
    } catch (error) {
      console.error('[KnowledgeService] Failed to add article to index:', error);
      return null;
    }
  }

  /**
   * Export knowledge index to YAML
   */
  async exportKnowledgeIndexToYaml(index: KnowledgeIndex): Promise<string | null> {
    if (!this.isSupported()) {
      return null;
    }

    const sdk = await sdkLoader.load();
    if (!sdk.export_knowledge_index_to_yaml) {
      return null;
    }

    try {
      const sdkIndex = frontendKnowledgeIndexToSDK(index);
      const indexJson = JSON.stringify(sdkIndex);
      return sdk.export_knowledge_index_to_yaml(indexJson);
    } catch (error) {
      console.error('[KnowledgeService] Failed to export knowledge index to YAML:', error);
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
   * @param data Article data
   * @param number Optional timestamp-based number (YYMMDDHHmm). If not provided, generates one.
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
    number?: number
  ): KnowledgeArticle {
    const now = new Date().toISOString();
    return {
      id: crypto.randomUUID(),
      number: number ?? generateArticleNumber(),
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

  /**
   * Download a PDF from base64 data
   * Utility method for UI components
   */
  downloadPDF(pdfResult: PDFExportResult): void {
    const byteCharacters = atob(pdfResult.data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: pdfResult.mimeType });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = pdfResult.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

// Export singleton instance
export const knowledgeService = new KnowledgeService();
