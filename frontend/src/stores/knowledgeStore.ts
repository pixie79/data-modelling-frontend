/**
 * Knowledge Store
 * Manages Knowledge Base articles state using Zustand
 * SDK 1.13.3+
 *
 * NOTE: The SDK 1.13.3 WASM methods work with YAML strings, not file paths.
 * File I/O must be handled by the application layer (e.g., Electron file system).
 * This store manages in-memory state and delegates to the service for
 * parsing, validation, and export operations.
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
import { ArticleType, ArticleStatus, generateArticleNumber } from '@/types/knowledge';

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

  // Data operations (in-memory, synchronous)
  addArticle: (article: KnowledgeArticle) => void;
  updateArticleInStore: (articleId: string, updates: Partial<KnowledgeArticle>) => void;
  removeArticle: (articleId: string) => void;

  // SDK-backed operations (parsing, creation, export)
  parseKnowledgeYaml: (yaml: string) => Promise<KnowledgeArticle | null>;
  parseKnowledgeIndexYaml: (yaml: string) => Promise<KnowledgeIndex | null>;
  exportKnowledgeToYaml: (article: KnowledgeArticle) => Promise<string | null>;
  exportKnowledgeToMarkdown: (article: KnowledgeArticle) => Promise<string>;
  exportKnowledgeToPDF: (article: KnowledgeArticle) => Promise<void>;
  hasPDFExport: () => boolean;

  // Search (uses SDK if available, falls back to client-side)
  search: (query: string) => Promise<void>;

  // High-level creation/update using service
  createArticle: (data: {
    title: string;
    type: ArticleType;
    summary: string;
    content: string;
    domain_id?: string;
    authors?: string[];
  }) => KnowledgeArticle;

  updateArticle: (articleId: string, updates: Partial<KnowledgeArticle>) => KnowledgeArticle | null;

  changeArticleStatus: (articleId: string, newStatus: ArticleStatus) => KnowledgeArticle | null;

  // Selectors
  getArticleById: (id: string) => KnowledgeArticle | undefined;
  getArticlesByType: (type: ArticleType) => KnowledgeArticle[];
  getArticlesByStatus: (status: ArticleStatus) => KnowledgeArticle[];
  getArticlesByDomain: (domainId: string) => KnowledgeArticle[];
  getPublishedArticles: () => KnowledgeArticle[];
  getDraftArticles: () => KnowledgeArticle[];
  getNextArticleNumber: () => number;

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
        const filtered = applyFilter(articles, filter);
        console.log('[KnowledgeStore] setArticles:', {
          articlesCount: articles.length,
          filter,
          filteredCount: filtered.length,
          articles: articles.map((a) => ({
            id: a.id,
            title: a.title,
            domain_id: a.domain_id,
          })),
        });
        set({ filteredArticles: filtered });
      },

      setSelectedArticle: (article) => set({ selectedArticle: article }),

      setKnowledgeIndex: (index) => set({ knowledgeIndex: index }),

      setFilter: (filter) => {
        set({ filter });
        // Update filtered articles
        const articles = get().articles;
        const filtered = applyFilter(articles, filter);
        console.log('[KnowledgeStore] setFilter:', {
          filter,
          articlesCount: articles.length,
          filteredCount: filtered.length,
        });
        set({ filteredArticles: filtered });
      },

      setSearchQuery: (query) => set({ searchQuery: query }),

      setSearchResults: (results) => set({ searchResults: results }),

      setLoading: (isLoading) => set({ isLoading }),

      setSearching: (isSearching) => set({ isSearching }),

      setSaving: (isSaving) => set({ isSaving }),

      setError: (error) => set({ error }),

      clearError: () => set({ error: null }),

      clearSearch: () => set({ searchQuery: '', searchResults: [] }),

      // Data operations (in-memory)
      addArticle: (article) => {
        const articles = [...get().articles, article];
        const filter = get().filter;
        set({
          articles,
          filteredArticles: applyFilter(articles, filter),
        });
      },

      updateArticleInStore: (articleId, updates) => {
        const articles = get().articles.map((a) =>
          a.id === articleId ? { ...a, ...updates, updated_at: new Date().toISOString() } : a
        );
        const filter = get().filter;
        const selectedArticle = get().selectedArticle;
        const updatedArticle = articles.find((a) => a.id === articleId);

        set({
          articles,
          filteredArticles: applyFilter(articles, filter),
          selectedArticle:
            selectedArticle?.id === articleId ? (updatedArticle ?? null) : selectedArticle,
        });
      },

      removeArticle: (articleId) => {
        const articles = get().articles.filter((a) => a.id !== articleId);
        const filter = get().filter;
        const selectedArticle = get().selectedArticle;

        set({
          articles,
          filteredArticles: applyFilter(articles, filter),
          selectedArticle: selectedArticle?.id === articleId ? null : selectedArticle,
        });
      },

      // SDK-backed operations
      parseKnowledgeYaml: async (yaml) => {
        try {
          return await knowledgeService.parseKnowledgeYaml(yaml);
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Failed to parse knowledge YAML' });
          return null;
        }
      },

      parseKnowledgeIndexYaml: async (yaml) => {
        try {
          return await knowledgeService.parseKnowledgeIndexYaml(yaml);
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to parse knowledge index',
          });
          return null;
        }
      },

      exportKnowledgeToYaml: async (article) => {
        try {
          return await knowledgeService.exportKnowledgeToYaml(article);
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to export article to YAML',
          });
          return null;
        }
      },

      exportKnowledgeToMarkdown: async (article) => {
        try {
          return await knowledgeService.exportKnowledgeToMarkdown(article);
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to export article to Markdown',
          });
          throw error;
        }
      },

      exportKnowledgeToPDF: async (article) => {
        try {
          const pdfResult = await knowledgeService.exportKnowledgeToPDF(article);
          knowledgeService.downloadPDF(pdfResult);
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to export article to PDF',
          });
          throw error;
        }
      },

      hasPDFExport: () => {
        return knowledgeService.hasPDFExport();
      },

      // Search
      search: async (query) => {
        if (!query.trim()) {
          set({ searchQuery: '', searchResults: [] });
          return;
        }

        set({ isSearching: true, searchQuery: query, error: null });
        try {
          const articles = get().articles;
          const results = await knowledgeService.searchKnowledgeViaSDK(articles, query);
          set({ searchResults: results, isSearching: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Search failed',
            isSearching: false,
          });
        }
      },

      // High-level creation using service
      createArticle: (data) => {
        // Use timestamp-based number (YYMMDDHHmm) for unique IDs across systems
        const timestampNumber = generateArticleNumber();
        const article = knowledgeService.createArticle(data, timestampNumber);

        // Add to store
        get().addArticle(article);
        set({ selectedArticle: article });

        // Update index
        const index = get().knowledgeIndex;
        if (index) {
          const entry = knowledgeService.createIndexEntry(article);
          const updatedIndex: KnowledgeIndex = {
            ...index,
            articles: [...index.articles, entry],
            last_updated: new Date().toISOString(),
          };
          set({ knowledgeIndex: updatedIndex });
        }

        return article;
      },

      updateArticle: (articleId, updates) => {
        const article = get().getArticleById(articleId);
        if (!article) {
          set({ error: `Article not found: ${articleId}` });
          return null;
        }

        const updatedArticle = knowledgeService.updateArticle(article, updates);
        get().updateArticleInStore(articleId, updatedArticle);

        // Update index if title, type, or status changed
        if (updates.title || updates.type || updates.status) {
          const index = get().knowledgeIndex;
          if (index) {
            const updatedArticles = index.articles.map((e) =>
              e.id === articleId
                ? {
                    ...e,
                    title: updatedArticle.title,
                    type: updatedArticle.type,
                    status: updatedArticle.status,
                    updated_at: updatedArticle.updated_at,
                    published_at: updatedArticle.published_at,
                  }
                : e
            );
            set({
              knowledgeIndex: {
                ...index,
                articles: updatedArticles,
                last_updated: updatedArticle.updated_at,
              },
            });
          }
        }

        return updatedArticle;
      },

      changeArticleStatus: (articleId, newStatus) => {
        const article = get().getArticleById(articleId);
        if (!article) {
          set({ error: `Article not found: ${articleId}` });
          return null;
        }

        try {
          const updatedArticle = knowledgeService.changeStatus(article, newStatus);
          get().updateArticleInStore(articleId, updatedArticle);
          return updatedArticle;
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Failed to change status' });
          return null;
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

      /** @deprecated Use generateArticleNumber() from types/knowledge instead */
      getNextArticleNumber: () => {
        // Now uses timestamp-based numbers (YYMMDDHHmm)
        return generateArticleNumber();
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
  console.log('[KnowledgeStore] applyFilter start:', filtered.length, 'articles');

  if (filter.domain_id) {
    // Include items matching the domain OR cross-domain items (no domain_id)
    const beforeCount = filtered.length;
    filtered = filtered.filter((a) => a.domain_id === filter.domain_id || !a.domain_id);
    console.log(
      `[KnowledgeStore] After domain filter (${filter.domain_id}): ${beforeCount} -> ${filtered.length}`
    );
  }

  if (filter.type && filter.type.length > 0) {
    const beforeCount = filtered.length;
    filtered = filtered.filter((a) => filter.type!.includes(a.type));
    console.log(`[KnowledgeStore] After type filter: ${beforeCount} -> ${filtered.length}`);
  }

  if (filter.status && filter.status.length > 0) {
    const beforeCount = filtered.length;
    filtered = filtered.filter((a) => filter.status!.includes(a.status));
    console.log(`[KnowledgeStore] After status filter: ${beforeCount} -> ${filtered.length}`);
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

  console.log('[KnowledgeStore] applyFilter result:', filtered.length, 'articles');
  return filtered;
}
