/**
 * Unit tests for Knowledge Store
 * Tests Zustand store for Knowledge Base articles
 * Updated for SDK 1.13.3+ in-memory API
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useKnowledgeStore } from '@/stores/knowledgeStore';
import { knowledgeService } from '@/services/sdk/knowledgeService';
import { ArticleType, ArticleStatus } from '@/types/knowledge';
import type { KnowledgeArticle, KnowledgeIndex, KnowledgeSearchResult } from '@/types/knowledge';

// Mock knowledgeService
vi.mock('@/services/sdk/knowledgeService', () => ({
  knowledgeService: {
    parseKnowledgeYaml: vi.fn(),
    parseKnowledgeIndexYaml: vi.fn(),
    exportKnowledgeToYaml: vi.fn(),
    exportKnowledgeToMarkdown: vi.fn(),
    searchKnowledgeViaSDK: vi.fn(),
    createArticle: vi.fn(),
    createIndexEntry: vi.fn(),
    updateArticle: vi.fn(),
    changeStatus: vi.fn(),
  },
}));

describe('useKnowledgeStore', () => {
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

  describe('in-memory data operations', () => {
    it('should add article to state', () => {
      const store = useKnowledgeStore.getState();

      store.addArticle(mockArticle);

      const state = useKnowledgeStore.getState();
      expect(state.articles).toHaveLength(1);
      expect(state.articles[0]).toEqual(mockArticle);
    });

    it('should update article in state', () => {
      const store = useKnowledgeStore.getState();
      store.setArticles([mockArticle]);

      store.updateArticleInStore('article-1', { title: 'Updated Title' });

      const state = useKnowledgeStore.getState();
      expect(state.articles[0]?.title).toBe('Updated Title');
    });

    it('should update selected article when updating matching article', () => {
      const store = useKnowledgeStore.getState();
      store.setArticles([mockArticle]);
      store.setSelectedArticle(mockArticle);

      store.updateArticleInStore('article-1', { title: 'Updated Title' });

      const state = useKnowledgeStore.getState();
      expect(state.selectedArticle?.title).toBe('Updated Title');
    });

    it('should remove article from state', () => {
      const store = useKnowledgeStore.getState();
      store.setArticles([mockArticle, mockArticle2]);

      store.removeArticle('article-1');

      const state = useKnowledgeStore.getState();
      expect(state.articles).toHaveLength(1);
      expect(state.articles[0]?.id).toBe('article-2');
    });

    it('should clear selected article when removing it', () => {
      const store = useKnowledgeStore.getState();
      store.setArticles([mockArticle, mockArticle2]);
      store.setSelectedArticle(mockArticle);

      store.removeArticle('article-1');

      expect(useKnowledgeStore.getState().selectedArticle).toBeNull();
    });
  });

  describe('search', () => {
    it('should clear search when query is empty', async () => {
      const store = useKnowledgeStore.getState();
      store.setSearchQuery('previous');
      store.setSearchResults([{ article: mockArticle, score: 0.9 }]);

      await store.search('   ');

      const state = useKnowledgeStore.getState();
      expect(state.searchQuery).toBe('');
      expect(state.searchResults).toEqual([]);
    });

    it('should search articles successfully', async () => {
      const mockResults: KnowledgeSearchResult[] = [{ article: mockArticle, score: 0.9 }];
      vi.mocked(knowledgeService.searchKnowledgeViaSDK).mockResolvedValue(mockResults);

      const store = useKnowledgeStore.getState();
      store.setArticles([mockArticle, mockArticle2]);

      await store.search('Getting Started');

      const state = useKnowledgeStore.getState();
      expect(state.searchQuery).toBe('Getting Started');
      expect(state.searchResults).toEqual(mockResults);
      expect(state.isSearching).toBe(false);
    });

    it('should handle search errors', async () => {
      vi.mocked(knowledgeService.searchKnowledgeViaSDK).mockRejectedValue(
        new Error('Search failed')
      );

      const store = useKnowledgeStore.getState();
      await store.search('test');

      const state = useKnowledgeStore.getState();
      expect(state.error).toBe('Search failed');
      expect(state.isSearching).toBe(false);
    });
  });

  describe('createArticle', () => {
    it('should create article and add to state', () => {
      const newArticle = { ...mockArticle, id: 'new-article' };
      vi.mocked(knowledgeService.createArticle).mockReturnValue(newArticle);
      vi.mocked(knowledgeService.createIndexEntry).mockReturnValue({
        id: 'new-article',
        number: 1,
        title: 'New Article',
        type: ArticleType.Tutorial,
        status: ArticleStatus.Draft,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      });

      const store = useKnowledgeStore.getState();
      store.setKnowledgeIndex(mockKnowledgeIndex);

      const result = store.createArticle({
        title: 'New Article',
        type: ArticleType.Tutorial,
        summary: 'Summary',
        content: 'Content',
      });

      expect(result).toEqual(newArticle);
      const state = useKnowledgeStore.getState();
      expect(state.articles).toContainEqual(newArticle);
      expect(state.selectedArticle).toEqual(newArticle);
    });

    it('should update knowledge index when creating', () => {
      const newArticle = { ...mockArticle, id: 'new-article', number: 2601101234 };
      vi.mocked(knowledgeService.createArticle).mockReturnValue(newArticle);
      vi.mocked(knowledgeService.createIndexEntry).mockReturnValue({
        id: 'new-article',
        number: 2601101234,
        title: 'New Article',
        type: ArticleType.Tutorial,
        status: ArticleStatus.Draft,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      });

      const store = useKnowledgeStore.getState();
      store.setKnowledgeIndex(mockKnowledgeIndex);

      store.createArticle({
        title: 'New Article',
        type: ArticleType.Tutorial,
        summary: 'Summary',
        content: 'Content',
      });

      const state = useKnowledgeStore.getState();
      // next_number is deprecated - timestamp-based numbers are used instead
      expect(state.knowledgeIndex?.articles).toHaveLength(1);
      expect(state.knowledgeIndex?.last_updated).toBeDefined();
    });
  });

  describe('updateArticle', () => {
    it('should update article in state', () => {
      const updatedArticle = { ...mockArticle, title: 'Updated Title' };
      vi.mocked(knowledgeService.updateArticle).mockReturnValue(updatedArticle);

      const store = useKnowledgeStore.getState();
      store.setArticles([mockArticle]);
      store.setSelectedArticle(mockArticle);

      const result = store.updateArticle('article-1', { title: 'Updated Title' });

      expect(result?.title).toBe('Updated Title');
      const state = useKnowledgeStore.getState();
      expect(state.articles[0]?.title).toBe('Updated Title');
      expect(state.selectedArticle?.title).toBe('Updated Title');
    });

    it('should return null for non-existent article', () => {
      const store = useKnowledgeStore.getState();

      const result = store.updateArticle('non-existent', { title: 'Updated' });

      expect(result).toBeNull();
      expect(useKnowledgeStore.getState().error).toContain('not found');
    });
  });

  describe('changeArticleStatus', () => {
    it('should change status and update state', () => {
      const updatedArticle = { ...mockArticle, status: ArticleStatus.Archived };
      vi.mocked(knowledgeService.changeStatus).mockReturnValue(updatedArticle);

      const store = useKnowledgeStore.getState();
      store.setArticles([mockArticle]);

      const result = store.changeArticleStatus('article-1', ArticleStatus.Archived);

      expect(result?.status).toBe(ArticleStatus.Archived);
      const state = useKnowledgeStore.getState();
      expect(state.articles[0]?.status).toBe(ArticleStatus.Archived);
    });

    it('should return null for non-existent article', () => {
      const store = useKnowledgeStore.getState();

      const result = store.changeArticleStatus('non-existent', ArticleStatus.Archived);

      expect(result).toBeNull();
    });

    it('should set error when status change throws', () => {
      vi.mocked(knowledgeService.changeStatus).mockImplementation(() => {
        throw new Error('Invalid status transition');
      });

      const store = useKnowledgeStore.getState();
      store.setArticles([mockArticle]);

      const result = store.changeArticleStatus('article-1', ArticleStatus.Draft);

      expect(result).toBeNull();
      expect(useKnowledgeStore.getState().error).toBe('Invalid status transition');
    });
  });

  describe('exportKnowledgeToMarkdown', () => {
    it('should export article to markdown', async () => {
      vi.mocked(knowledgeService.exportKnowledgeToMarkdown).mockResolvedValue('# Article');

      const store = useKnowledgeStore.getState();
      const result = await store.exportKnowledgeToMarkdown(mockArticle);

      expect(result).toBe('# Article');
    });

    it('should set error on export failure', async () => {
      vi.mocked(knowledgeService.exportKnowledgeToMarkdown).mockRejectedValue(
        new Error('Export failed')
      );

      const store = useKnowledgeStore.getState();

      await expect(store.exportKnowledgeToMarkdown(mockArticle)).rejects.toThrow();

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
