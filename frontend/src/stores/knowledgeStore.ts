/**
 * Knowledge Store
 * Manages Knowledge Base articles state using Zustand
 * SDK 1.13.1+
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { knowledgeService } from '@/services/sdk/knowledgeService';
import type {
  KnowledgeArticle,
  KnowledgeIndex,
  KnowledgeFilter,
  KnowledgeSearchResult,
} from '@/types/knowledge';
import { ArticleType, ArticleStatus } from '@/types/knowledge';

interface KnowledgeState {
  // State
  articles: KnowledgeArticle[];
  selectedArticle: KnowledgeArticle | null;
  knowledgeIndex: KnowledgeIndex | null;
  filter: KnowledgeFilter;
  searchQuery: string;
  searchResults: KnowledgeSearchResult[];
  isLoading: boolean;
  isSearching: boolean;
  isSaving: boolean;
  error: string | null;

  // Computed (via selectors)
  filteredArticles: KnowledgeArticle[];

  // Actions
  setArticles: (articles: KnowledgeArticle[]) => void;
  setSelectedArticle: (article: KnowledgeArticle | null) => void;
  setKnowledgeIndex: (index: KnowledgeIndex | null) => void;
  setFilter: (filter: KnowledgeFilter) => void;
  setSearchQuery: (query: string) => void;
  setSearchResults: (results: KnowledgeSearchResult[]) => void;
  setLoading: (isLoading: boolean) => void;
  setSearching: (isSearching: boolean) => void;
  setSaving: (isSaving: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  clearSearch: () => void;

  // Async operations
  loadKnowledge: (workspacePath: string) => Promise<void>;
  loadKnowledgeByDomain: (workspacePath: string, domainId: string) => Promise<void>;
  search: (workspacePath: string, query: string) => Promise<void>;
  createArticle: (
    workspacePath: string,
    data: {
      title: string;
      type: ArticleType;
      summary: string;
      content: string;
      domain_id?: string;
      authors?: string[];
    }
  ) => Promise<KnowledgeArticle>;
  updateArticle: (
    workspacePath: string,
    articleId: string,
    updates: Partial<KnowledgeArticle>
  ) => Promise<void>;
  changeArticleStatus: (
    workspacePath: string,
    articleId: string,
    newStatus: ArticleStatus
  ) => Promise<void>;
  deleteArticle: (workspacePath: string, articleId: string) => Promise<void>;
  exportToMarkdown: (workspacePath: string, articleId: string) => Promise<string>;

  // Selectors
  getArticleById: (id: string) => KnowledgeArticle | undefined;
  getArticlesByType: (type: ArticleType) => KnowledgeArticle[];
  getArticlesByStatus: (status: ArticleStatus) => KnowledgeArticle[];
  getArticlesByDomain: (domainId: string) => KnowledgeArticle[];
  getPublishedArticles: () => KnowledgeArticle[];
  getDraftArticles: () => KnowledgeArticle[];

  // Reset
  reset: () => void;
}

const initialState = {
  articles: [],
  selectedArticle: null,
  knowledgeIndex: null,
  filter: {},
  searchQuery: '',
  searchResults: [],
  isLoading: false,
  isSearching: false,
  isSaving: false,
  error: null,
  filteredArticles: [],
};

export const useKnowledgeStore = create<KnowledgeState>()(
  persist(
    (set, get) => ({
      ...initialState,

      // Setters
      setArticles: (articles) => {
        set({ articles });
        // Update filtered articles
        const filter = get().filter;
        set({ filteredArticles: applyFilter(articles, filter) });
      },

      setSelectedArticle: (article) => set({ selectedArticle: article }),

      setKnowledgeIndex: (index) => set({ knowledgeIndex: index }),

      setFilter: (filter) => {
        set({ filter });
        // Update filtered articles
        const articles = get().articles;
        set({ filteredArticles: applyFilter(articles, filter) });
      },

      setSearchQuery: (query) => set({ searchQuery: query }),

      setSearchResults: (results) => set({ searchResults: results }),

      setLoading: (isLoading) => set({ isLoading }),

      setSearching: (isSearching) => set({ isSearching }),

      setSaving: (isSaving) => set({ isSaving }),

      setError: (error) => set({ error }),

      clearError: () => set({ error: null }),

      clearSearch: () => set({ searchQuery: '', searchResults: [] }),

      // Async operations
      loadKnowledge: async (workspacePath) => {
        set({ isLoading: true, error: null });
        try {
          const [articles, index] = await Promise.all([
            knowledgeService.loadKnowledge(workspacePath),
            knowledgeService.loadKnowledgeIndex(workspacePath),
          ]);

          const filter = get().filter;
          set({
            articles,
            knowledgeIndex: index,
            filteredArticles: applyFilter(articles, filter),
            isLoading: false,
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to load knowledge',
            isLoading: false,
          });
        }
      },

      loadKnowledgeByDomain: async (workspacePath, domainId) => {
        set({ isLoading: true, error: null });
        try {
          const articles = await knowledgeService.loadKnowledgeByDomain(workspacePath, domainId);
          const filter = { ...get().filter, domain_id: domainId };
          set({
            articles,
            filter,
            filteredArticles: articles, // Already filtered by domain
            isLoading: false,
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to load knowledge',
            isLoading: false,
          });
        }
      },

      search: async (workspacePath, query) => {
        if (!query.trim()) {
          set({ searchQuery: '', searchResults: [] });
          return;
        }

        set({ isSearching: true, searchQuery: query, error: null });
        try {
          const results = await knowledgeService.searchKnowledge(workspacePath, query);
          set({ searchResults: results, isSearching: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Search failed',
            isSearching: false,
          });
        }
      },

      createArticle: async (workspacePath, data) => {
        set({ isSaving: true, error: null });
        try {
          const article = await knowledgeService.createArticle(workspacePath, data);

          // Add to local state
          const articles = [...get().articles, article];
          const filter = get().filter;
          set({
            articles,
            filteredArticles: applyFilter(articles, filter),
            selectedArticle: article,
            isSaving: false,
          });

          return article;
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to create article',
            isSaving: false,
          });
          throw error;
        }
      },

      updateArticle: async (workspacePath, articleId, updates) => {
        set({ isSaving: true, error: null });
        try {
          const updatedArticle = await knowledgeService.updateArticle(
            workspacePath,
            articleId,
            updates
          );

          // Update local state
          const articles = get().articles.map((a) => (a.id === articleId ? updatedArticle : a));
          const filter = get().filter;
          const selectedArticle = get().selectedArticle;

          set({
            articles,
            filteredArticles: applyFilter(articles, filter),
            selectedArticle: selectedArticle?.id === articleId ? updatedArticle : selectedArticle,
            isSaving: false,
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to update article',
            isSaving: false,
          });
          throw error;
        }
      },

      changeArticleStatus: async (workspacePath, articleId, newStatus) => {
        set({ isSaving: true, error: null });
        try {
          const updatedArticle = await knowledgeService.changeStatus(
            workspacePath,
            articleId,
            newStatus
          );

          // Update local state
          const articles = get().articles.map((a) => (a.id === articleId ? updatedArticle : a));
          const filter = get().filter;
          const selectedArticle = get().selectedArticle;

          set({
            articles,
            filteredArticles: applyFilter(articles, filter),
            selectedArticle: selectedArticle?.id === articleId ? updatedArticle : selectedArticle,
            isSaving: false,
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to change article status',
            isSaving: false,
          });
          throw error;
        }
      },

      deleteArticle: async (workspacePath, articleId) => {
        set({ isSaving: true, error: null });
        try {
          await knowledgeService.deleteArticle(workspacePath, articleId);

          // Remove from local state
          const articles = get().articles.filter((a) => a.id !== articleId);
          const filter = get().filter;
          const selectedArticle = get().selectedArticle;

          set({
            articles,
            filteredArticles: applyFilter(articles, filter),
            selectedArticle: selectedArticle?.id === articleId ? null : selectedArticle,
            isSaving: false,
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to delete article',
            isSaving: false,
          });
          throw error;
        }
      },

      exportToMarkdown: async (workspacePath, articleId) => {
        try {
          return await knowledgeService.exportToMarkdown(workspacePath, articleId);
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to export article',
          });
          throw error;
        }
      },

      // Selectors
      getArticleById: (id) => {
        return get().articles.find((a) => a.id === id);
      },

      getArticlesByType: (type) => {
        return get().articles.filter((a) => a.type === type);
      },

      getArticlesByStatus: (status) => {
        return get().articles.filter((a) => a.status === status);
      },

      getArticlesByDomain: (domainId) => {
        return get().articles.filter((a) => a.domain_id === domainId);
      },

      getPublishedArticles: () => {
        return get().articles.filter((a) => a.status === ArticleStatus.Published);
      },

      getDraftArticles: () => {
        return get().articles.filter((a) => a.status === ArticleStatus.Draft);
      },

      // Reset
      reset: () => set(initialState),
    }),
    {
      name: 'knowledge-store',
      partialize: (state) => ({
        // Only persist selected article ID and search query
        selectedArticleId: state.selectedArticle?.id,
        filter: state.filter,
        searchQuery: state.searchQuery,
      }),
    }
  )
);

/**
 * Apply filter to articles
 */
function applyFilter(articles: KnowledgeArticle[], filter: KnowledgeFilter): KnowledgeArticle[] {
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
        a.title.toLowerCase().includes(searchLower) || a.summary.toLowerCase().includes(searchLower)
    );
  }

  // Sort by number descending (newest first)
  filtered.sort((a, b) => b.number - a.number);

  return filtered;
}
