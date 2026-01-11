/**
 * Unit tests for Knowledge Service
 * Tests Knowledge Base articles via SDK 1.14.0+
 * Updated for in-memory API (WASM works with YAML strings, not file paths)
 * Updated for type converter patterns (SDK camelCase ↔ frontend snake_case)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { knowledgeService } from '@/services/sdk/knowledgeService';
import { sdkLoader } from '@/services/sdk/sdkLoader';
import { ArticleType, ArticleStatus } from '@/types/knowledge';
import type { KnowledgeArticle, KnowledgeIndex } from '@/types/knowledge';

// Mock sdkLoader
vi.mock('@/services/sdk/sdkLoader', () => ({
  sdkLoader: {
    hasKnowledgeSupport: vi.fn(),
    hasMarkdownExport: vi.fn(),
    hasPDFExport: vi.fn(),
    load: vi.fn(),
  },
}));

describe('KnowledgeService', () => {
  // Frontend format (snake_case) - what the service returns
  const mockArticle: KnowledgeArticle = {
    id: 'article-1',
    number: 1,
    title: 'Getting Started Guide',
    type: ArticleType.Guide,
    status: ArticleStatus.Published,
    summary: 'A comprehensive guide to getting started',
    content: '# Getting Started\n\nThis guide will help you get started.',
    domain_id: 'domain-1',
    authors: ['Jane Doe'],
    reviewers: ['John Smith'],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    published_at: '2024-01-02T00:00:00Z',
  };

  // SDK format (camelCase) - what the SDK returns
  const mockSDKArticle = {
    id: 'article-1',
    number: 1,
    title: 'Getting Started Guide',
    articleType: 'guide', // SDK uses articleType, not type
    status: 'published',
    summary: 'A comprehensive guide to getting started',
    content: '# Getting Started\n\nThis guide will help you get started.',
    domainId: 'domain-1',
    workspaceId: null,
    authors: ['Jane Doe'],
    reviewers: ['John Smith'],
    audience: [],
    skillLevel: null,
    reviewFrequency: null,
    linkedAssets: [],
    linkedDecisions: [],
    relatedArticles: [],
    relatedDecisions: [],
    prerequisites: [],
    seeAlso: [],
    tags: [],
    notes: null,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    publishedAt: '2024-01-02T00:00:00Z',
    reviewedAt: null,
    lastReviewed: null,
    archivedAt: null,
  };

  // Frontend format (snake_case)
  const mockKnowledgeIndex: KnowledgeIndex = {
    workspace_id: 'workspace-1',
    articles: [
      {
        id: 'article-1',
        number: 1,
        title: 'Getting Started Guide',
        type: ArticleType.Guide,
        status: ArticleStatus.Published,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        published_at: '2024-01-02T00:00:00Z',
      },
    ],
    last_updated: '2024-01-02T00:00:00Z',
  };

  // SDK format (camelCase)
  const mockSDKKnowledgeIndex = {
    workspaceId: 'workspace-1',
    articles: [
      {
        id: 'article-1',
        number: 1,
        title: 'Getting Started Guide',
        articleType: 'guide', // SDK uses articleType, not type
        status: 'published',
        domainId: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        publishedAt: '2024-01-02T00:00:00Z',
      },
    ],
    lastUpdated: '2024-01-02T00:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isSupported', () => {
    it('should return true when SDK has knowledge support', () => {
      vi.mocked(sdkLoader.hasKnowledgeSupport).mockReturnValue(true);
      expect(knowledgeService.isSupported()).toBe(true);
    });

    it('should return false when SDK does not have knowledge support', () => {
      vi.mocked(sdkLoader.hasKnowledgeSupport).mockReturnValue(false);
      expect(knowledgeService.isSupported()).toBe(false);
    });
  });

  describe('parseKnowledgeYaml', () => {
    it('should return null when SDK is not supported', async () => {
      vi.mocked(sdkLoader.hasKnowledgeSupport).mockReturnValue(false);

      const result = await knowledgeService.parseKnowledgeYaml('yaml content');

      expect(result).toBeNull();
    });

    it('should parse knowledge YAML successfully', async () => {
      vi.mocked(sdkLoader.hasKnowledgeSupport).mockReturnValue(true);
      // SDK returns camelCase data
      vi.mocked(sdkLoader.load).mockResolvedValue({
        parse_knowledge_yaml: vi.fn().mockReturnValue(JSON.stringify(mockSDKArticle)),
      } as unknown as ReturnType<typeof sdkLoader.load>);

      const result = await knowledgeService.parseKnowledgeYaml('yaml content');

      // Service converts to snake_case
      expect(result?.id).toBe('article-1');
      expect(result?.title).toBe('Getting Started Guide');
      expect(result?.type).toBe(ArticleType.Guide);
      expect(result?.domain_id).toBe('domain-1');
      expect(result?.created_at).toBe('2024-01-01T00:00:00Z');
    });

    it('should return null when parse method is not available', async () => {
      vi.mocked(sdkLoader.hasKnowledgeSupport).mockReturnValue(true);
      vi.mocked(sdkLoader.load).mockResolvedValue(
        {} as unknown as ReturnType<typeof sdkLoader.load>
      );

      const result = await knowledgeService.parseKnowledgeYaml('yaml content');

      expect(result).toBeNull();
    });

    it('should return null on parse error', async () => {
      vi.mocked(sdkLoader.hasKnowledgeSupport).mockReturnValue(true);
      vi.mocked(sdkLoader.load).mockResolvedValue({
        parse_knowledge_yaml: vi.fn().mockReturnValue(JSON.stringify({ error: 'Parse error' })),
      } as unknown as ReturnType<typeof sdkLoader.load>);

      const result = await knowledgeService.parseKnowledgeYaml('invalid yaml');

      expect(result).toBeNull();
    });
  });

  describe('parseKnowledgeIndexYaml', () => {
    it('should return null when SDK is not supported', async () => {
      vi.mocked(sdkLoader.hasKnowledgeSupport).mockReturnValue(false);

      const result = await knowledgeService.parseKnowledgeIndexYaml('yaml content');

      expect(result).toBeNull();
    });

    it('should parse knowledge index YAML successfully', async () => {
      vi.mocked(sdkLoader.hasKnowledgeSupport).mockReturnValue(true);
      // SDK returns camelCase data
      vi.mocked(sdkLoader.load).mockResolvedValue({
        parse_knowledge_index_yaml: vi.fn().mockReturnValue(JSON.stringify(mockSDKKnowledgeIndex)),
      } as unknown as ReturnType<typeof sdkLoader.load>);

      const result = await knowledgeService.parseKnowledgeIndexYaml('yaml content');

      // Service converts to snake_case
      expect(result?.workspace_id).toBe('workspace-1');
      expect(result?.last_updated).toBe('2024-01-02T00:00:00Z');
      expect(result?.articles).toHaveLength(1);
      expect(result?.articles[0]?.id).toBe('article-1');
    });
  });

  describe('exportKnowledgeToYaml', () => {
    it('should throw error when SDK is not supported', async () => {
      vi.mocked(sdkLoader.hasKnowledgeSupport).mockReturnValue(false);

      await expect(knowledgeService.exportKnowledgeToYaml(mockArticle)).rejects.toThrow(
        'Knowledge features require SDK 1.14.0+'
      );
    });

    it('should export article to YAML successfully', async () => {
      vi.mocked(sdkLoader.hasKnowledgeSupport).mockReturnValue(true);
      const mockExport = vi.fn().mockReturnValue('article: yaml');
      vi.mocked(sdkLoader.load).mockResolvedValue({
        export_knowledge_to_yaml: mockExport,
      } as unknown as ReturnType<typeof sdkLoader.load>);

      const result = await knowledgeService.exportKnowledgeToYaml(mockArticle);

      expect(result).toBe('article: yaml');
      // Service converts to camelCase for SDK
      expect(mockExport).toHaveBeenCalled();
      // Verify it was called with a JSON string containing camelCase keys
      const calledArg = mockExport.mock.calls[0][0];
      const parsedArg = JSON.parse(calledArg);
      expect(parsedArg.domainId).toBeDefined(); // camelCase key
    });
  });

  describe('exportKnowledgeToMarkdown', () => {
    it('should use SDK export when available', async () => {
      vi.mocked(sdkLoader.hasKnowledgeSupport).mockReturnValue(true);
      vi.mocked(sdkLoader.hasMarkdownExport).mockReturnValue(true);
      const mockExport = vi.fn().mockReturnValue('# Article Markdown');
      vi.mocked(sdkLoader.load).mockResolvedValue({
        export_knowledge_to_markdown: mockExport,
      } as unknown as ReturnType<typeof sdkLoader.load>);

      const result = await knowledgeService.exportKnowledgeToMarkdown(mockArticle);

      expect(result).toBe('# Article Markdown');
    });

    it('should fallback to client-side markdown generation when SDK not available', async () => {
      vi.mocked(sdkLoader.hasKnowledgeSupport).mockReturnValue(false);
      vi.mocked(sdkLoader.hasMarkdownExport).mockReturnValue(false);

      const result = await knowledgeService.exportKnowledgeToMarkdown(mockArticle);

      expect(result).toContain('# 0001. Getting Started Guide');
      expect(result).toContain('**Type:** guide');
      expect(result).toContain('**Status:** published');
      expect(result).toContain('## Summary');
    });

    it('should fallback to client-side on SDK export failure', async () => {
      vi.mocked(sdkLoader.hasKnowledgeSupport).mockReturnValue(true);
      vi.mocked(sdkLoader.hasMarkdownExport).mockReturnValue(true);
      vi.mocked(sdkLoader.load).mockResolvedValue({
        export_knowledge_to_markdown: vi.fn().mockImplementation(() => {
          throw new Error('SDK error');
        }),
      } as unknown as ReturnType<typeof sdkLoader.load>);

      const result = await knowledgeService.exportKnowledgeToMarkdown(mockArticle);

      expect(result).toContain('# 0001. Getting Started Guide');
    });
  });

  describe('searchKnowledgeViaSDK', () => {
    const mockArticles = [mockArticle, { ...mockArticle, id: 'article-2', title: 'API Reference' }];

    it('should use SDK search when available', async () => {
      // SDK returns camelCase articles in search results
      const mockSDKResults = [{ article: mockSDKArticle, score: 0.9 }];
      vi.mocked(sdkLoader.hasKnowledgeSupport).mockReturnValue(true);
      vi.mocked(sdkLoader.load).mockResolvedValue({
        search_knowledge_articles: vi
          .fn()
          .mockReturnValue(JSON.stringify({ results: mockSDKResults })),
      } as unknown as ReturnType<typeof sdkLoader.load>);

      const result = await knowledgeService.searchKnowledgeViaSDK(mockArticles, 'Getting');

      // Service converts to snake_case
      expect(result).toHaveLength(1);
      expect(result[0]?.article.id).toBe('article-1');
      expect(result[0]?.article.domain_id).toBe('domain-1');
      expect(result[0]?.score).toBe(0.9);
    });

    it('should fallback to client-side search when SDK not available', async () => {
      vi.mocked(sdkLoader.hasKnowledgeSupport).mockReturnValue(false);

      const result = await knowledgeService.searchKnowledgeViaSDK(mockArticles, 'Getting');

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]?.article.title).toContain('Getting');
    });

    it('should fallback to client-side search on SDK failure', async () => {
      vi.mocked(sdkLoader.hasKnowledgeSupport).mockReturnValue(true);
      vi.mocked(sdkLoader.load).mockResolvedValue({
        search_knowledge_articles: vi.fn().mockImplementation(() => {
          throw new Error('SDK error');
        }),
      } as unknown as ReturnType<typeof sdkLoader.load>);

      const result = await knowledgeService.searchKnowledgeViaSDK(mockArticles, 'Getting');

      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('findArticleById', () => {
    const articles = [mockArticle, { ...mockArticle, id: 'article-2', number: 2 }];

    it('should find article by ID', () => {
      const result = knowledgeService.findArticleById(articles, 'article-1');
      expect(result?.id).toBe('article-1');
    });

    it('should return null for non-existent ID', () => {
      const result = knowledgeService.findArticleById(articles, 'non-existent');
      expect(result).toBeNull();
    });
  });

  describe('filterKnowledge', () => {
    const mockArticles: KnowledgeArticle[] = [
      { ...mockArticle, id: 'article-1', type: ArticleType.Guide, status: ArticleStatus.Published },
      {
        ...mockArticle,
        id: 'article-2',
        type: ArticleType.Tutorial,
        status: ArticleStatus.Draft,
        title: 'API Tutorial',
      },
      {
        ...mockArticle,
        id: 'article-3',
        type: ArticleType.Reference,
        status: ArticleStatus.Review,
        domain_id: 'domain-2',
        authors: ['Alice'],
      },
    ];

    it('should filter by type', () => {
      const result = knowledgeService.filterKnowledge(mockArticles, {
        type: [ArticleType.Tutorial],
      });

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('article-2');
    });

    it('should filter by status', () => {
      const result = knowledgeService.filterKnowledge(mockArticles, {
        status: [ArticleStatus.Draft],
      });

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('article-2');
    });

    it('should filter by domain_id', () => {
      const result = knowledgeService.filterKnowledge(mockArticles, {
        domain_id: 'domain-2',
      });

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('article-3');
    });

    it('should filter by author', () => {
      const result = knowledgeService.filterKnowledge(mockArticles, {
        author: 'Alice',
      });

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('article-3');
    });

    it('should filter by search term', () => {
      const result = knowledgeService.filterKnowledge(mockArticles, {
        search: 'API',
      });

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('article-2');
    });

    it('should combine multiple filters', () => {
      const result = knowledgeService.filterKnowledge(mockArticles, {
        type: [ArticleType.Guide, ArticleType.Reference],
        domain_id: 'domain-1',
      });

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('article-1');
    });
  });

  describe('createArticle', () => {
    it('should create article with auto-generated fields', () => {
      const result = knowledgeService.createArticle(
        {
          title: 'New Article',
          type: ArticleType.Tutorial,
          summary: 'Test summary',
          content: 'Test content',
        },
        5
      );

      expect(result.id).toBeDefined();
      expect(result.number).toBe(5);
      expect(result.title).toBe('New Article');
      expect(result.status).toBe(ArticleStatus.Draft);
      expect(result.created_at).toBeDefined();
      expect(result.updated_at).toBeDefined();
    });

    it('should generate timestamp-based number when not provided', () => {
      const result = knowledgeService.createArticle({
        title: 'New Article',
        type: ArticleType.Tutorial,
        summary: 'Test summary',
        content: 'Test content',
      });

      // Number should be timestamp-based (YYMMDDHHmm format - 10 digits)
      expect(result.number).toBeGreaterThan(2000000000);
      expect(result.number.toString()).toHaveLength(10);
    });
  });

  describe('updateArticle', () => {
    it('should update article preserving id and number', () => {
      const result = knowledgeService.updateArticle(mockArticle, {
        title: 'Updated Title',
      });

      expect(result.id).toBe('article-1');
      expect(result.number).toBe(1);
      expect(result.title).toBe('Updated Title');
      expect(result.updated_at).not.toBe(mockArticle.updated_at);
    });

    it('should preserve created_at', () => {
      const result = knowledgeService.updateArticle(mockArticle, {
        title: 'Updated Title',
        created_at: '2025-01-01T00:00:00Z', // Attempt to override
      });

      expect(result.created_at).toBe(mockArticle.created_at);
    });
  });

  describe('changeStatus', () => {
    it('should throw error for invalid status transition', () => {
      // Published -> Draft is not valid
      expect(() => knowledgeService.changeStatus(mockArticle, ArticleStatus.Draft)).toThrow(
        'Invalid status transition'
      );
    });

    it('should set published_at when publishing', () => {
      const draftArticle = {
        ...mockArticle,
        status: ArticleStatus.Review,
        published_at: undefined,
      };

      const result = knowledgeService.changeStatus(draftArticle, ArticleStatus.Published);

      expect(result.status).toBe(ArticleStatus.Published);
      expect(result.published_at).toBeDefined();
    });

    it('should set archived_at when archiving', () => {
      const result = knowledgeService.changeStatus(mockArticle, ArticleStatus.Archived);

      expect(result.status).toBe(ArticleStatus.Archived);
      expect(result.archived_at).toBeDefined();
    });

    it('should set reviewed_at when moving to review', () => {
      const draftArticle = { ...mockArticle, status: ArticleStatus.Draft };

      const result = knowledgeService.changeStatus(draftArticle, ArticleStatus.Review);

      expect(result.status).toBe(ArticleStatus.Review);
      expect(result.reviewed_at).toBeDefined();
    });
  });

  describe('createIndexEntry', () => {
    it('should create index entry from article', () => {
      const result = knowledgeService.createIndexEntry(mockArticle);

      expect(result.id).toBe(mockArticle.id);
      expect(result.number).toBe(mockArticle.number);
      expect(result.title).toBe(mockArticle.title);
      expect(result.type).toBe(mockArticle.type);
      expect(result.status).toBe(mockArticle.status);
    });
  });

  describe('helper methods', () => {
    const mockArticles: KnowledgeArticle[] = [
      { ...mockArticle, id: '1', type: ArticleType.Guide, status: ArticleStatus.Published },
      { ...mockArticle, id: '2', type: ArticleType.Tutorial, status: ArticleStatus.Draft },
      { ...mockArticle, id: '3', type: ArticleType.Reference, status: ArticleStatus.Review },
    ];

    it('should get articles by type', () => {
      const result = knowledgeService.getArticlesByType(mockArticles, ArticleType.Tutorial);

      expect(result).toHaveLength(1);
      expect(result[0]?.type).toBe(ArticleType.Tutorial);
    });

    it('should get articles by status', () => {
      const result = knowledgeService.getArticlesByStatus(mockArticles, ArticleStatus.Draft);

      expect(result).toHaveLength(1);
      expect(result[0]?.status).toBe(ArticleStatus.Draft);
    });

    it('should get published articles', () => {
      const result = knowledgeService.getPublishedArticles(mockArticles);

      expect(result).toHaveLength(1);
      expect(result[0]?.status).toBe(ArticleStatus.Published);
    });

    it('should get draft articles', () => {
      const result = knowledgeService.getDraftArticles(mockArticles);

      expect(result).toHaveLength(1);
      expect(result[0]?.status).toBe(ArticleStatus.Draft);
    });
  });

  describe('SDK integration methods', () => {
    describe('createArticleViaSDK', () => {
      it('should return null when SDK is not supported', async () => {
        vi.mocked(sdkLoader.hasKnowledgeSupport).mockReturnValue(false);

        const result = await knowledgeService.createArticleViaSDK(
          1,
          'Title',
          'guide',
          'Summary',
          'Content'
        );

        expect(result).toBeNull();
      });

      it('should create article via SDK', async () => {
        vi.mocked(sdkLoader.hasKnowledgeSupport).mockReturnValue(true);
        // SDK returns camelCase
        vi.mocked(sdkLoader.load).mockResolvedValue({
          create_knowledge_article: vi.fn().mockReturnValue(JSON.stringify(mockSDKArticle)),
        } as unknown as ReturnType<typeof sdkLoader.load>);

        const result = await knowledgeService.createArticleViaSDK(
          1,
          'Title',
          'guide',
          'Summary',
          'Content'
        );

        // Service converts to snake_case
        expect(result?.id).toBe('article-1');
        expect(result?.domain_id).toBe('domain-1');
        expect(result?.created_at).toBe('2024-01-01T00:00:00Z');
      });
    });

    describe('addArticleToIndex', () => {
      it('should return null when SDK is not supported', async () => {
        vi.mocked(sdkLoader.hasKnowledgeSupport).mockReturnValue(false);

        const result = await knowledgeService.addArticleToIndex(
          mockKnowledgeIndex,
          mockArticle,
          'kb-0001.yaml'
        );

        expect(result).toBeNull();
      });

      it('should add article to index via SDK', async () => {
        // SDK returns camelCase
        const updatedSDKIndex = { ...mockSDKKnowledgeIndex };
        vi.mocked(sdkLoader.hasKnowledgeSupport).mockReturnValue(true);
        vi.mocked(sdkLoader.load).mockResolvedValue({
          add_article_to_knowledge_index: vi.fn().mockReturnValue(JSON.stringify(updatedSDKIndex)),
        } as unknown as ReturnType<typeof sdkLoader.load>);

        const result = await knowledgeService.addArticleToIndex(
          mockKnowledgeIndex,
          mockArticle,
          'kb-0001.yaml'
        );

        // Service converts to snake_case
        expect(result?.workspace_id).toBe('workspace-1');
        expect(result?.last_updated).toBe('2024-01-02T00:00:00Z');
      });
    });
  });
});
