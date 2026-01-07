/**
 * Unit tests for Knowledge Store
 * Tests Zustand store for Knowledge Base articles
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useKnowledgeStore } from '@/stores/knowledgeStore';
import { knowledgeService } from '@/services/sdk/knowledgeService';
import { ArticleType, ArticleStatus } from '@/types/knowledge';
import type { KnowledgeArticle, KnowledgeIndex, KnowledgeSearchResult } from '@/types/knowledge';

// Mock knowledgeService
vi.mock('@/services/sdk/knowledgeService', () => ({
  knowledgeService: {
    loadKnowledge: vi.fn(),
    loadKnowledgeIndex: vi.fn(),
    loadKnowledgeByDomain: vi.fn(),
    searchKnowledge: vi.fn(),
    createArticle: vi.fn(),
    updateArticle: vi.fn(),
    changeStatus: vi.fn(),
    deleteArticle: vi.fn(),
    exportToMarkdown: vi.fn(),
  },
}));

describe('useKnowledgeStore', () => {
  const mockWorkspacePath = '/test/workspace';

  const mockArticle: KnowledgeArticle = {
    id: 'article-1',
    number: 1,
    title: 'Getting Started Guide',
    type: ArticleType.Guide,
    status: ArticleStatus.Published,
    summary: 'A guide to getting started',
    content: '# Getting Started\n\nContent here.',
    domain_id: 'domain-1',
    authors: ['Jane Doe'],
    reviewers: ['John Smith'],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    published_at: '2024-01-02T00:00:00Z',
  };

  const mockArticle2: KnowledgeArticle = {
    ...mockArticle,
    id: 'article-2',
    number: 2,
    title: 'API Reference',
    type: ArticleType.Reference,
    status: ArticleStatus.Draft,
    domain_id: 'domain-2',
  };

  const mockKnowledgeIndex: KnowledgeIndex = {
    workspace_id: 'workspace-1',
    next_number: 3,
    articles: [],
    last_updated: '2024-01-02T00:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store state
    useKnowledgeStore.getState().reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const state = useKnowledgeStore.getState();

      expect(state.articles).toEqual([]);
      expect(state.selectedArticle).toBeNull();
      expect(state.knowledgeIndex).toBeNull();
      expect(state.filter).toEqual({});
      expect(state.searchQuery).toBe('');
      expect(state.searchResults).toEqual([]);
      expect(state.isLoading).toBe(false);
      expect(state.isSearching).toBe(false);
      expect(state.isSaving).toBe(false);
      expect(state.error).toBeNull();
      expect(state.filteredArticles).toEqual([]);
    });
  });

  describe('setters', () => {
    it('should set articles and update filtered articles', () => {
      const store = useKnowledgeStore.getState();

      store.setArticles([mockArticle, mockArticle2]);

      const state = useKnowledgeStore.getState();
      expect(state.articles).toHaveLength(2);
      expect(state.filteredArticles).toHaveLength(2);
    });

    it('should set selected article', () => {
      const store = useKnowledgeStore.getState();

      store.setSelectedArticle(mockArticle);

      expect(useKnowledgeStore.getState().selectedArticle).toEqual(mockArticle);
    });

    it('should set knowledge index', () => {
      const store = useKnowledgeStore.getState();

      store.setKnowledgeIndex(mockKnowledgeIndex);

      expect(useKnowledgeStore.getState().knowledgeIndex).toEqual(mockKnowledgeIndex);
    });

    it('should set filter and update filtered articles', () => {
      const store = useKnowledgeStore.getState();
      store.setArticles([mockArticle, mockArticle2]);

      store.setFilter({ status: [ArticleStatus.Draft] });

      const state = useKnowledgeStore.getState();
      expect(state.filter).toEqual({ status: [ArticleStatus.Draft] });
      expect(state.filteredArticles).toHaveLength(1);
      expect(state.filteredArticles[0]?.id).toBe('article-2');
    });

    it('should set search query', () => {
      const store = useKnowledgeStore.getState();

      store.setSearchQuery('test query');

      expect(useKnowledgeStore.getState().searchQuery).toBe('test query');
    });

    it('should set search results', () => {
      const store = useKnowledgeStore.getState();
      const mockResults: KnowledgeSearchResult[] = [{ article: mockArticle, score: 0.9 }];

      store.setSearchResults(mockResults);

      expect(useKnowledgeStore.getState().searchResults).toEqual(mockResults);
    });

    it('should set loading state', () => {
      const store = useKnowledgeStore.getState();

      store.setLoading(true);

      expect(useKnowledgeStore.getState().isLoading).toBe(true);
    });

    it('should set searching state', () => {
      const store = useKnowledgeStore.getState();

      store.setSearching(true);

      expect(useKnowledgeStore.getState().isSearching).toBe(true);
    });

    it('should set saving state', () => {
      const store = useKnowledgeStore.getState();

      store.setSaving(true);

      expect(useKnowledgeStore.getState().isSaving).toBe(true);
    });

    it('should set and clear error', () => {
      const store = useKnowledgeStore.getState();

      store.setError('Test error');
      expect(useKnowledgeStore.getState().error).toBe('Test error');

      store.clearError();
      expect(useKnowledgeStore.getState().error).toBeNull();
    });

    it('should clear search', () => {
      const store = useKnowledgeStore.getState();
      store.setSearchQuery('query');
      store.setSearchResults([{ article: mockArticle, score: 0.9 }]);

      store.clearSearch();

      const state = useKnowledgeStore.getState();
      expect(state.searchQuery).toBe('');
      expect(state.searchResults).toEqual([]);
    });
  });

  describe('loadKnowledge', () => {
    it('should load articles successfully', async () => {
      vi.mocked(knowledgeService.loadKnowledge).mockResolvedValue([mockArticle, mockArticle2]);
      vi.mocked(knowledgeService.loadKnowledgeIndex).mockResolvedValue(mockKnowledgeIndex);

      const store = useKnowledgeStore.getState();
      await store.loadKnowledge(mockWorkspacePath);

      const state = useKnowledgeStore.getState();
      expect(state.articles).toHaveLength(2);
      expect(state.knowledgeIndex).toEqual(mockKnowledgeIndex);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should handle load errors', async () => {
      vi.mocked(knowledgeService.loadKnowledge).mockRejectedValue(new Error('Load failed'));

      const store = useKnowledgeStore.getState();
      await store.loadKnowledge(mockWorkspacePath);

      const state = useKnowledgeStore.getState();
      expect(state.error).toBe('Load failed');
      expect(state.isLoading).toBe(false);
    });

    it('should set loading state during load', async () => {
      vi.mocked(knowledgeService.loadKnowledge).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve([]), 100))
      );
      vi.mocked(knowledgeService.loadKnowledgeIndex).mockResolvedValue(null);

      const loadPromise = useKnowledgeStore.getState().loadKnowledge(mockWorkspacePath);

      expect(useKnowledgeStore.getState().isLoading).toBe(true);

      await loadPromise;

      expect(useKnowledgeStore.getState().isLoading).toBe(false);
    });
  });

  describe('loadKnowledgeByDomain', () => {
    it('should load articles for specific domain', async () => {
      vi.mocked(knowledgeService.loadKnowledgeByDomain).mockResolvedValue([mockArticle]);

      const store = useKnowledgeStore.getState();
      await store.loadKnowledgeByDomain(mockWorkspacePath, 'domain-1');

      const state = useKnowledgeStore.getState();
      expect(state.articles).toHaveLength(1);
      expect(state.filter.domain_id).toBe('domain-1');
      expect(state.isLoading).toBe(false);
    });
  });

  describe('search', () => {
    it('should clear search when query is empty', async () => {
      const store = useKnowledgeStore.getState();
      store.setSearchQuery('previous');
      store.setSearchResults([{ article: mockArticle, score: 0.9 }]);

      await store.search(mockWorkspacePath, '   ');

      const state = useKnowledgeStore.getState();
      expect(state.searchQuery).toBe('');
      expect(state.searchResults).toEqual([]);
    });

    it('should search articles successfully', async () => {
      const mockResults: KnowledgeSearchResult[] = [{ article: mockArticle, score: 0.9 }];
      vi.mocked(knowledgeService.searchKnowledge).mockResolvedValue(mockResults);

      const store = useKnowledgeStore.getState();
      await store.search(mockWorkspacePath, 'Getting Started');

      const state = useKnowledgeStore.getState();
      expect(state.searchQuery).toBe('Getting Started');
      expect(state.searchResults).toEqual(mockResults);
      expect(state.isSearching).toBe(false);
    });

    it('should handle search errors', async () => {
      vi.mocked(knowledgeService.searchKnowledge).mockRejectedValue(new Error('Search failed'));

      const store = useKnowledgeStore.getState();
      await store.search(mockWorkspacePath, 'test');

      const state = useKnowledgeStore.getState();
      expect(state.error).toBe('Search failed');
      expect(state.isSearching).toBe(false);
    });
  });

  describe('createArticle', () => {
    it('should create article and add to state', async () => {
      const newArticle = { ...mockArticle, id: 'new-article' };
      vi.mocked(knowledgeService.createArticle).mockResolvedValue(newArticle);

      const store = useKnowledgeStore.getState();
      const result = await store.createArticle(mockWorkspacePath, {
        title: 'New Article',
        type: ArticleType.Tutorial,
        summary: 'Summary',
        content: 'Content',
      });

      expect(result).toEqual(newArticle);
      const state = useKnowledgeStore.getState();
      expect(state.articles).toContainEqual(newArticle);
      expect(state.selectedArticle).toEqual(newArticle);
      expect(state.isSaving).toBe(false);
    });

    it('should handle create errors', async () => {
      vi.mocked(knowledgeService.createArticle).mockRejectedValue(new Error('Create failed'));

      const store = useKnowledgeStore.getState();

      await expect(
        store.createArticle(mockWorkspacePath, {
          title: 'New',
          type: ArticleType.Guide,
          summary: 'Summary',
          content: 'Content',
        })
      ).rejects.toThrow('Create failed');

      expect(useKnowledgeStore.getState().error).toBe('Create failed');
    });
  });

  describe('updateArticle', () => {
    it('should update article in state', async () => {
      const updatedArticle = { ...mockArticle, title: 'Updated Title' };
      vi.mocked(knowledgeService.updateArticle).mockResolvedValue(updatedArticle);

      const store = useKnowledgeStore.getState();
      store.setArticles([mockArticle]);
      store.setSelectedArticle(mockArticle);

      await store.updateArticle(mockWorkspacePath, 'article-1', { title: 'Updated Title' });

      const state = useKnowledgeStore.getState();
      expect(state.articles[0]?.title).toBe('Updated Title');
      expect(state.selectedArticle?.title).toBe('Updated Title');
      expect(state.isSaving).toBe(false);
    });
  });

  describe('changeArticleStatus', () => {
    it('should change status and update state', async () => {
      const updatedArticle = { ...mockArticle, status: ArticleStatus.Archived };
      vi.mocked(knowledgeService.changeStatus).mockResolvedValue(updatedArticle);

      const store = useKnowledgeStore.getState();
      store.setArticles([mockArticle]);

      await store.changeArticleStatus(mockWorkspacePath, 'article-1', ArticleStatus.Archived);

      const state = useKnowledgeStore.getState();
      expect(state.articles[0]?.status).toBe(ArticleStatus.Archived);
    });
  });

  describe('deleteArticle', () => {
    it('should remove article from state', async () => {
      vi.mocked(knowledgeService.deleteArticle).mockResolvedValue();

      const store = useKnowledgeStore.getState();
      store.setArticles([mockArticle, mockArticle2]);
      store.setSelectedArticle(mockArticle);

      await store.deleteArticle(mockWorkspacePath, 'article-1');

      const state = useKnowledgeStore.getState();
      expect(state.articles).toHaveLength(1);
      expect(state.articles[0]?.id).toBe('article-2');
      expect(state.selectedArticle).toBeNull();
    });
  });

  describe('exportToMarkdown', () => {
    it('should export article to markdown', async () => {
      vi.mocked(knowledgeService.exportToMarkdown).mockResolvedValue('# Article');

      const store = useKnowledgeStore.getState();
      const result = await store.exportToMarkdown(mockWorkspacePath, 'article-1');

      expect(result).toBe('# Article');
    });

    it('should set error on export failure', async () => {
      vi.mocked(knowledgeService.exportToMarkdown).mockRejectedValue(new Error('Export failed'));

      const store = useKnowledgeStore.getState();

      await expect(store.exportToMarkdown(mockWorkspacePath, 'article-1')).rejects.toThrow();

      expect(useKnowledgeStore.getState().error).toBe('Export failed');
    });
  });

  describe('selectors', () => {
    beforeEach(() => {
      const store = useKnowledgeStore.getState();
      store.setArticles([
        {
          ...mockArticle,
          id: '1',
          type: ArticleType.Guide,
          status: ArticleStatus.Published,
          domain_id: 'domain-1',
        },
        {
          ...mockArticle,
          id: '2',
          type: ArticleType.Tutorial,
          status: ArticleStatus.Draft,
          domain_id: 'domain-2',
        },
        {
          ...mockArticle,
          id: '3',
          type: ArticleType.Reference,
          status: ArticleStatus.Review,
          domain_id: 'domain-1',
        },
      ]);
    });

    it('should get article by id', () => {
      const store = useKnowledgeStore.getState();

      const article = store.getArticleById('2');

      expect(article?.id).toBe('2');
    });

    it('should return undefined for non-existent article', () => {
      const store = useKnowledgeStore.getState();

      const article = store.getArticleById('non-existent');

      expect(article).toBeUndefined();
    });

    it('should get articles by type', () => {
      const store = useKnowledgeStore.getState();

      const articles = store.getArticlesByType(ArticleType.Tutorial);

      expect(articles).toHaveLength(1);
      expect(articles[0]?.type).toBe(ArticleType.Tutorial);
    });

    it('should get articles by status', () => {
      const store = useKnowledgeStore.getState();

      const articles = store.getArticlesByStatus(ArticleStatus.Published);

      expect(articles).toHaveLength(1);
      expect(articles[0]?.status).toBe(ArticleStatus.Published);
    });

    it('should get articles by domain', () => {
      const store = useKnowledgeStore.getState();

      const articles = store.getArticlesByDomain('domain-1');

      expect(articles).toHaveLength(2);
    });

    it('should get published articles', () => {
      const store = useKnowledgeStore.getState();

      const articles = store.getPublishedArticles();

      expect(articles).toHaveLength(1);
      expect(articles[0]?.status).toBe(ArticleStatus.Published);
    });

    it('should get draft articles', () => {
      const store = useKnowledgeStore.getState();

      const articles = store.getDraftArticles();

      expect(articles).toHaveLength(1);
      expect(articles[0]?.status).toBe(ArticleStatus.Draft);
    });
  });

  describe('filtering', () => {
    beforeEach(() => {
      const store = useKnowledgeStore.getState();
      store.setArticles([
        {
          ...mockArticle,
          id: '1',
          number: 3,
          title: 'Getting Started',
          type: ArticleType.Guide,
          status: ArticleStatus.Published,
          domain_id: 'domain-1',
          authors: ['Alice'],
        },
        {
          ...mockArticle,
          id: '2',
          number: 2,
          title: 'API Docs',
          type: ArticleType.Reference,
          status: ArticleStatus.Draft,
          domain_id: 'domain-2',
          authors: ['Bob'],
        },
        {
          ...mockArticle,
          id: '3',
          number: 1,
          title: 'Tutorial',
          type: ArticleType.Tutorial,
          status: ArticleStatus.Review,
          domain_id: 'domain-1',
          authors: ['Alice', 'Charlie'],
        },
      ]);
    });

    it('should filter by type', () => {
      const store = useKnowledgeStore.getState();

      store.setFilter({ type: [ArticleType.Reference] });

      const state = useKnowledgeStore.getState();
      expect(state.filteredArticles).toHaveLength(1);
      expect(state.filteredArticles[0]?.type).toBe(ArticleType.Reference);
    });

    it('should filter by status', () => {
      const store = useKnowledgeStore.getState();

      store.setFilter({ status: [ArticleStatus.Draft, ArticleStatus.Review] });

      const state = useKnowledgeStore.getState();
      expect(state.filteredArticles).toHaveLength(2);
    });

    it('should filter by domain_id', () => {
      const store = useKnowledgeStore.getState();

      store.setFilter({ domain_id: 'domain-1' });

      const state = useKnowledgeStore.getState();
      expect(state.filteredArticles).toHaveLength(2);
    });

    it('should filter by author', () => {
      const store = useKnowledgeStore.getState();

      store.setFilter({ author: 'Alice' });

      const state = useKnowledgeStore.getState();
      expect(state.filteredArticles).toHaveLength(2);
    });

    it('should filter by search term in title', () => {
      const store = useKnowledgeStore.getState();

      store.setFilter({ search: 'API' });

      const state = useKnowledgeStore.getState();
      expect(state.filteredArticles).toHaveLength(1);
      expect(state.filteredArticles[0]?.title).toContain('API');
    });

    it('should combine multiple filters', () => {
      const store = useKnowledgeStore.getState();

      store.setFilter({
        status: [ArticleStatus.Published, ArticleStatus.Review],
        domain_id: 'domain-1',
      });

      const state = useKnowledgeStore.getState();
      expect(state.filteredArticles).toHaveLength(2);
    });

    it('should sort by number descending', () => {
      const store = useKnowledgeStore.getState();

      store.setFilter({});

      const state = useKnowledgeStore.getState();
      expect(state.filteredArticles[0]?.number).toBe(3);
      expect(state.filteredArticles[1]?.number).toBe(2);
      expect(state.filteredArticles[2]?.number).toBe(1);
    });
  });

  describe('reset', () => {
    it('should reset to initial state', () => {
      const store = useKnowledgeStore.getState();
      store.setArticles([mockArticle]);
      store.setSelectedArticle(mockArticle);
      store.setSearchQuery('test');
      store.setError('Some error');
      store.setLoading(true);

      store.reset();

      const state = useKnowledgeStore.getState();
      expect(state.articles).toEqual([]);
      expect(state.selectedArticle).toBeNull();
      expect(state.searchQuery).toBe('');
      expect(state.error).toBeNull();
      expect(state.isLoading).toBe(false);
    });
  });
});
