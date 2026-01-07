/**
 * Unit tests for Knowledge Service
 * Tests Knowledge Base articles via SDK 1.13.1+
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
    load: vi.fn(),
  },
}));

describe('KnowledgeService', () => {
  const mockWorkspacePath = '/test/workspace';

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

  const mockKnowledgeIndex: KnowledgeIndex = {
    workspace_id: 'workspace-1',
    next_number: 2,
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

  describe('loadKnowledge', () => {
    it('should return empty array when SDK is not supported', async () => {
      vi.mocked(sdkLoader.hasKnowledgeSupport).mockReturnValue(false);

      const result = await knowledgeService.loadKnowledge(mockWorkspacePath);

      expect(result).toEqual([]);
    });

    it('should load articles successfully', async () => {
      vi.mocked(sdkLoader.hasKnowledgeSupport).mockReturnValue(true);
      vi.mocked(sdkLoader.load).mockResolvedValue({
        load_knowledge: vi.fn().mockReturnValue(JSON.stringify({ articles: [mockArticle] })),
      } as unknown as ReturnType<typeof sdkLoader.load>);

      const result = await knowledgeService.loadKnowledge(mockWorkspacePath);

      expect(result).toEqual([mockArticle]);
    });

    it('should return empty array when load_knowledge method is not available', async () => {
      vi.mocked(sdkLoader.hasKnowledgeSupport).mockReturnValue(true);
      vi.mocked(sdkLoader.load).mockResolvedValue(
        {} as unknown as ReturnType<typeof sdkLoader.load>
      );

      const result = await knowledgeService.loadKnowledge(mockWorkspacePath);

      expect(result).toEqual([]);
    });

    it('should handle SDK errors gracefully', async () => {
      vi.mocked(sdkLoader.hasKnowledgeSupport).mockReturnValue(true);
      vi.mocked(sdkLoader.load).mockResolvedValue({
        load_knowledge: vi.fn().mockReturnValue(JSON.stringify({ error: 'SDK error' })),
      } as unknown as ReturnType<typeof sdkLoader.load>);

      const result = await knowledgeService.loadKnowledge(mockWorkspacePath);

      expect(result).toEqual([]);
    });
  });

  describe('loadArticle', () => {
    it('should return null when article is not found', async () => {
      vi.mocked(sdkLoader.hasKnowledgeSupport).mockReturnValue(true);
      vi.mocked(sdkLoader.load).mockResolvedValue({
        load_knowledge: vi.fn().mockReturnValue(JSON.stringify({ articles: [] })),
      } as unknown as ReturnType<typeof sdkLoader.load>);

      const result = await knowledgeService.loadArticle(mockWorkspacePath, 'non-existent');

      expect(result).toBeNull();
    });

    it('should return article when found', async () => {
      vi.mocked(sdkLoader.hasKnowledgeSupport).mockReturnValue(true);
      vi.mocked(sdkLoader.load).mockResolvedValue({
        load_knowledge: vi.fn().mockReturnValue(JSON.stringify({ articles: [mockArticle] })),
      } as unknown as ReturnType<typeof sdkLoader.load>);

      const result = await knowledgeService.loadArticle(mockWorkspacePath, 'article-1');

      expect(result).toEqual(mockArticle);
    });
  });

  describe('loadKnowledgeIndex', () => {
    it('should return null when SDK is not supported', async () => {
      vi.mocked(sdkLoader.hasKnowledgeSupport).mockReturnValue(false);

      const result = await knowledgeService.loadKnowledgeIndex(mockWorkspacePath);

      expect(result).toBeNull();
    });

    it('should load knowledge index successfully', async () => {
      vi.mocked(sdkLoader.hasKnowledgeSupport).mockReturnValue(true);
      vi.mocked(sdkLoader.load).mockResolvedValue({
        load_knowledge_index: vi.fn().mockReturnValue(JSON.stringify(mockKnowledgeIndex)),
      } as unknown as ReturnType<typeof sdkLoader.load>);

      const result = await knowledgeService.loadKnowledgeIndex(mockWorkspacePath);

      expect(result).toEqual(mockKnowledgeIndex);
    });
  });

  describe('loadKnowledgeByDomain', () => {
    it('should return empty array when SDK is not supported', async () => {
      vi.mocked(sdkLoader.hasKnowledgeSupport).mockReturnValue(false);

      const result = await knowledgeService.loadKnowledgeByDomain(mockWorkspacePath, 'domain-1');

      expect(result).toEqual([]);
    });

    it('should use SDK method when available', async () => {
      vi.mocked(sdkLoader.hasKnowledgeSupport).mockReturnValue(true);
      const mockLoadByDomain = vi.fn().mockReturnValue(JSON.stringify({ articles: [mockArticle] }));
      vi.mocked(sdkLoader.load).mockResolvedValue({
        load_knowledge_by_domain: mockLoadByDomain,
      } as unknown as ReturnType<typeof sdkLoader.load>);

      const result = await knowledgeService.loadKnowledgeByDomain(mockWorkspacePath, 'domain-1');

      expect(mockLoadByDomain).toHaveBeenCalledWith(mockWorkspacePath, 'domain-1');
      expect(result).toEqual([mockArticle]);
    });

    it('should fallback to client-side filtering when SDK method fails', async () => {
      vi.mocked(sdkLoader.hasKnowledgeSupport).mockReturnValue(true);
      vi.mocked(sdkLoader.load).mockResolvedValue({
        load_knowledge_by_domain: vi.fn().mockImplementation(() => {
          throw new Error('SDK error');
        }),
        load_knowledge: vi.fn().mockReturnValue(JSON.stringify({ articles: [mockArticle] })),
      } as unknown as ReturnType<typeof sdkLoader.load>);

      const result = await knowledgeService.loadKnowledgeByDomain(mockWorkspacePath, 'domain-1');

      expect(result).toEqual([mockArticle]);
    });
  });

  describe('searchKnowledge', () => {
    it('should return empty array when SDK is not supported', async () => {
      vi.mocked(sdkLoader.hasKnowledgeSupport).mockReturnValue(false);

      const result = await knowledgeService.searchKnowledge(mockWorkspacePath, 'test');

      expect(result).toEqual([]);
    });

    it('should use SDK search when available', async () => {
      vi.mocked(sdkLoader.hasKnowledgeSupport).mockReturnValue(true);
      const mockSearchResults = [{ article: mockArticle, score: 0.9 }];
      vi.mocked(sdkLoader.load).mockResolvedValue({
        search_knowledge: vi.fn().mockReturnValue(JSON.stringify({ results: mockSearchResults })),
      } as unknown as ReturnType<typeof sdkLoader.load>);

      const result = await knowledgeService.searchKnowledge(mockWorkspacePath, 'Getting Started');

      expect(result).toEqual(mockSearchResults);
    });

    it('should fallback to client-side search when SDK search fails', async () => {
      vi.mocked(sdkLoader.hasKnowledgeSupport).mockReturnValue(true);
      vi.mocked(sdkLoader.load).mockResolvedValue({
        search_knowledge: vi.fn().mockImplementation(() => {
          throw new Error('SDK error');
        }),
        load_knowledge: vi.fn().mockReturnValue(JSON.stringify({ articles: [mockArticle] })),
      } as unknown as ReturnType<typeof sdkLoader.load>);

      const result = await knowledgeService.searchKnowledge(mockWorkspacePath, 'Getting');

      expect(result).toHaveLength(1);
      expect(result[0]?.article.id).toBe('article-1');
      expect(result[0]?.score).toBeGreaterThan(0);
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

    beforeEach(() => {
      vi.mocked(sdkLoader.hasKnowledgeSupport).mockReturnValue(true);
      vi.mocked(sdkLoader.load).mockResolvedValue({
        load_knowledge: vi.fn().mockReturnValue(JSON.stringify({ articles: mockArticles })),
      } as unknown as ReturnType<typeof sdkLoader.load>);
    });

    it('should filter by type', async () => {
      const result = await knowledgeService.filterKnowledge(mockWorkspacePath, {
        type: [ArticleType.Tutorial],
      });

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('article-2');
    });

    it('should filter by status', async () => {
      const result = await knowledgeService.filterKnowledge(mockWorkspacePath, {
        status: [ArticleStatus.Draft],
      });

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('article-2');
    });

    it('should filter by domain_id', async () => {
      const result = await knowledgeService.filterKnowledge(mockWorkspacePath, {
        domain_id: 'domain-2',
      });

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('article-3');
    });

    it('should filter by author', async () => {
      const result = await knowledgeService.filterKnowledge(mockWorkspacePath, {
        author: 'Alice',
      });

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('article-3');
    });

    it('should filter by search term', async () => {
      const result = await knowledgeService.filterKnowledge(mockWorkspacePath, {
        search: 'API',
      });

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('article-2');
    });

    it('should combine multiple filters', async () => {
      const result = await knowledgeService.filterKnowledge(mockWorkspacePath, {
        type: [ArticleType.Guide, ArticleType.Reference],
        domain_id: 'domain-1',
      });

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('article-1');
    });
  });

  describe('saveArticle', () => {
    it('should throw error when SDK is not supported', async () => {
      vi.mocked(sdkLoader.hasKnowledgeSupport).mockReturnValue(false);

      await expect(knowledgeService.saveArticle(mockWorkspacePath, mockArticle)).rejects.toThrow(
        'Knowledge features require SDK 1.13.1+'
      );
    });

    it('should save article successfully', async () => {
      vi.mocked(sdkLoader.hasKnowledgeSupport).mockReturnValue(true);
      const mockSaveKnowledge = vi.fn().mockReturnValue(JSON.stringify({ success: true }));
      vi.mocked(sdkLoader.load).mockResolvedValue({
        save_knowledge: mockSaveKnowledge,
      } as unknown as ReturnType<typeof sdkLoader.load>);

      await knowledgeService.saveArticle(mockWorkspacePath, mockArticle);

      expect(mockSaveKnowledge).toHaveBeenCalledWith(
        JSON.stringify(mockArticle),
        mockWorkspacePath
      );
    });

    it('should throw error on save failure', async () => {
      vi.mocked(sdkLoader.hasKnowledgeSupport).mockReturnValue(true);
      vi.mocked(sdkLoader.load).mockResolvedValue({
        save_knowledge: vi
          .fn()
          .mockReturnValue(JSON.stringify({ success: false, error: 'Save failed' })),
      } as unknown as ReturnType<typeof sdkLoader.load>);

      await expect(knowledgeService.saveArticle(mockWorkspacePath, mockArticle)).rejects.toThrow(
        'Save failed'
      );
    });
  });

  describe('createArticle', () => {
    it('should create article with auto-generated fields', async () => {
      vi.mocked(sdkLoader.hasKnowledgeSupport).mockReturnValue(true);
      vi.mocked(sdkLoader.load).mockResolvedValue({
        load_knowledge_index: vi.fn().mockReturnValue(JSON.stringify(mockKnowledgeIndex)),
        save_knowledge: vi.fn().mockReturnValue(JSON.stringify({ success: true })),
        save_knowledge_index: vi.fn().mockReturnValue(JSON.stringify({ success: true })),
      } as unknown as ReturnType<typeof sdkLoader.load>);

      const result = await knowledgeService.createArticle(mockWorkspacePath, {
        title: 'New Article',
        type: ArticleType.Tutorial,
        summary: 'Test summary',
        content: 'Test content',
      });

      expect(result.id).toBeDefined();
      expect(result.number).toBe(2); // next_number from index
      expect(result.title).toBe('New Article');
      expect(result.status).toBe(ArticleStatus.Draft);
      expect(result.created_at).toBeDefined();
      expect(result.updated_at).toBeDefined();
    });
  });

  describe('updateArticle', () => {
    it('should throw error when article is not found', async () => {
      vi.mocked(sdkLoader.hasKnowledgeSupport).mockReturnValue(true);
      vi.mocked(sdkLoader.load).mockResolvedValue({
        load_knowledge: vi.fn().mockReturnValue(JSON.stringify({ articles: [] })),
      } as unknown as ReturnType<typeof sdkLoader.load>);

      await expect(
        knowledgeService.updateArticle(mockWorkspacePath, 'non-existent', { title: 'Updated' })
      ).rejects.toThrow('Article not found: non-existent');
    });

    it('should update article preserving id and number', async () => {
      vi.mocked(sdkLoader.hasKnowledgeSupport).mockReturnValue(true);
      const mockSaveKnowledge = vi.fn().mockReturnValue(JSON.stringify({ success: true }));
      vi.mocked(sdkLoader.load).mockResolvedValue({
        load_knowledge: vi.fn().mockReturnValue(JSON.stringify({ articles: [mockArticle] })),
        save_knowledge: mockSaveKnowledge,
        load_knowledge_index: vi.fn().mockReturnValue(JSON.stringify(mockKnowledgeIndex)),
        save_knowledge_index: vi.fn().mockReturnValue(JSON.stringify({ success: true })),
      } as unknown as ReturnType<typeof sdkLoader.load>);

      const result = await knowledgeService.updateArticle(mockWorkspacePath, 'article-1', {
        title: 'Updated Title',
      });

      expect(result.id).toBe('article-1');
      expect(result.number).toBe(1);
      expect(result.title).toBe('Updated Title');
    });
  });

  describe('changeStatus', () => {
    it('should throw error for invalid status transition', async () => {
      vi.mocked(sdkLoader.hasKnowledgeSupport).mockReturnValue(true);
      vi.mocked(sdkLoader.load).mockResolvedValue({
        load_knowledge: vi.fn().mockReturnValue(JSON.stringify({ articles: [mockArticle] })),
      } as unknown as ReturnType<typeof sdkLoader.load>);

      // Published -> Draft is not valid
      await expect(
        knowledgeService.changeStatus(mockWorkspacePath, 'article-1', ArticleStatus.Draft)
      ).rejects.toThrow('Invalid status transition');
    });

    it('should set published_at when publishing', async () => {
      const draftArticle = {
        ...mockArticle,
        status: ArticleStatus.Review,
        published_at: undefined,
      };
      vi.mocked(sdkLoader.hasKnowledgeSupport).mockReturnValue(true);
      vi.mocked(sdkLoader.load).mockResolvedValue({
        load_knowledge: vi.fn().mockReturnValue(JSON.stringify({ articles: [draftArticle] })),
        save_knowledge: vi.fn().mockReturnValue(JSON.stringify({ success: true })),
        load_knowledge_index: vi.fn().mockReturnValue(JSON.stringify(mockKnowledgeIndex)),
        save_knowledge_index: vi.fn().mockReturnValue(JSON.stringify({ success: true })),
      } as unknown as ReturnType<typeof sdkLoader.load>);

      const result = await knowledgeService.changeStatus(
        mockWorkspacePath,
        'article-1',
        ArticleStatus.Published
      );

      expect(result.status).toBe(ArticleStatus.Published);
      expect(result.published_at).toBeDefined();
    });

    it('should set archived_at when archiving', async () => {
      vi.mocked(sdkLoader.hasKnowledgeSupport).mockReturnValue(true);
      vi.mocked(sdkLoader.load).mockResolvedValue({
        load_knowledge: vi.fn().mockReturnValue(JSON.stringify({ articles: [mockArticle] })),
        save_knowledge: vi.fn().mockReturnValue(JSON.stringify({ success: true })),
        load_knowledge_index: vi.fn().mockReturnValue(JSON.stringify(mockKnowledgeIndex)),
        save_knowledge_index: vi.fn().mockReturnValue(JSON.stringify({ success: true })),
      } as unknown as ReturnType<typeof sdkLoader.load>);

      const result = await knowledgeService.changeStatus(
        mockWorkspacePath,
        'article-1',
        ArticleStatus.Archived
      );

      expect(result.status).toBe(ArticleStatus.Archived);
      expect(result.archived_at).toBeDefined();
    });
  });

  describe('exportToMarkdown', () => {
    it('should throw error when article is not found', async () => {
      vi.mocked(sdkLoader.hasKnowledgeSupport).mockReturnValue(true);
      vi.mocked(sdkLoader.load).mockResolvedValue({
        load_knowledge: vi.fn().mockReturnValue(JSON.stringify({ articles: [] })),
      } as unknown as ReturnType<typeof sdkLoader.load>);

      await expect(
        knowledgeService.exportToMarkdown(mockWorkspacePath, 'non-existent')
      ).rejects.toThrow('Article not found');
    });

    it('should use SDK export when available', async () => {
      const mockExport = vi.fn().mockReturnValue('# Article Markdown');
      vi.mocked(sdkLoader.hasKnowledgeSupport).mockReturnValue(true);
      vi.mocked(sdkLoader.load).mockResolvedValue({
        load_knowledge: vi.fn().mockReturnValue(JSON.stringify({ articles: [mockArticle] })),
        export_knowledge_markdown: mockExport,
      } as unknown as ReturnType<typeof sdkLoader.load>);

      const result = await knowledgeService.exportToMarkdown(mockWorkspacePath, 'article-1');

      expect(result).toBe('# Article Markdown');
    });

    it('should fallback to client-side markdown generation', async () => {
      vi.mocked(sdkLoader.hasKnowledgeSupport).mockReturnValue(true);
      vi.mocked(sdkLoader.load).mockResolvedValue({
        load_knowledge: vi.fn().mockReturnValue(JSON.stringify({ articles: [mockArticle] })),
      } as unknown as ReturnType<typeof sdkLoader.load>);

      const result = await knowledgeService.exportToMarkdown(mockWorkspacePath, 'article-1');

      expect(result).toContain('# 0001. Getting Started Guide');
      expect(result).toContain('**Type:** guide');
      expect(result).toContain('**Status:** published');
      expect(result).toContain('## Summary');
    });
  });

  describe('helper methods', () => {
    beforeEach(() => {
      vi.mocked(sdkLoader.hasKnowledgeSupport).mockReturnValue(true);
      vi.mocked(sdkLoader.load).mockResolvedValue({
        load_knowledge: vi.fn().mockReturnValue(
          JSON.stringify({
            articles: [
              { ...mockArticle, id: '1', type: ArticleType.Guide, status: ArticleStatus.Published },
              { ...mockArticle, id: '2', type: ArticleType.Tutorial, status: ArticleStatus.Draft },
              {
                ...mockArticle,
                id: '3',
                type: ArticleType.Reference,
                status: ArticleStatus.Review,
              },
            ],
          })
        ),
      } as unknown as ReturnType<typeof sdkLoader.load>);
    });

    it('should get articles by type', async () => {
      const result = await knowledgeService.getArticlesByType(
        mockWorkspacePath,
        ArticleType.Tutorial
      );

      expect(result).toHaveLength(1);
      expect(result[0]?.type).toBe(ArticleType.Tutorial);
    });

    it('should get articles by status', async () => {
      const result = await knowledgeService.getArticlesByStatus(
        mockWorkspacePath,
        ArticleStatus.Draft
      );

      expect(result).toHaveLength(1);
      expect(result[0]?.status).toBe(ArticleStatus.Draft);
    });

    it('should get published articles', async () => {
      const result = await knowledgeService.getPublishedArticles(mockWorkspacePath);

      expect(result).toHaveLength(1);
      expect(result[0]?.status).toBe(ArticleStatus.Published);
    });

    it('should get draft articles', async () => {
      const result = await knowledgeService.getDraftArticles(mockWorkspacePath);

      expect(result).toHaveLength(1);
      expect(result[0]?.status).toBe(ArticleStatus.Draft);
    });
  });
});
