import { useState, useCallback, useRef, useEffect } from 'react';
import {
  useQueryClient,
  useInfiniteQuery,
} from '@tanstack/react-query';
import type {
  GetNewsArticles200ArticlesItem,
  GetNewsSaved200ArticlesItem,
} from '../../api/model';
import {
  getNewsArticles,
  useGetNewsCategories,
  useGetNewsSaved,
  usePostNewsArticlesArticleIdSave,
  useDeleteNewsArticlesArticleIdSave,
  postNewsArticlesArticleIdSave,
} from '../../api/endpoints/news/news';
import SearchBar from '../../components/news/SearchBar';
import CategoryBar from '../../components/news/CategoryBar';
import ArticleCard from '../../components/news/ArticleCard';
import ArticleDetailModal from '../../components/news/ArticleDetailModal';
import SavedSection from '../../components/news/SavedSection';
import NewsSkeleton from '../../components/news/NewsSkeleton';

// ── Shared article type ───────────────────────────────────────────────────────

type NewsArticle = GetNewsArticles200ArticlesItem | GetNewsSaved200ArticlesItem;

// ── URL opener ───────────────────────────────────────────────────────────────

function openArticleUrl(url: string) {
  // Try Tauri plugin-opener first, fallback to window.open
  try {
    import('@tauri-apps/plugin-opener').then(({ openUrl }) => {
      openUrl(url);
    }).catch(() => {
      window.open(url, '_blank', 'noopener,noreferrer');
    });
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

// ── Page size ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

// ── Page component ───────────────────────────────────────────────────────────

export default function NewsPage() {
  const queryClient = useQueryClient();

  // ── Local state ──────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeTab, setActiveTab] = useState<'all' | 'saved'>('all');
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null);

  // ── Categories query ─────────────────────────────────────────────────────
  const {
    data: categoriesData,
    isLoading: categoriesLoading,
  } = useGetNewsCategories({
    query: { staleTime: 30 * 60 * 1000 },
  });

  const categories = categoriesData?.categories ?? [];

  // ── Articles infinite query ──────────────────────────────────────────────
  const {
    data: articlesData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: articlesLoading,
    isError: articlesError,
    error: articlesErrorObj,
    refetch: refetchArticles,
  } = useInfiniteQuery({
    queryKey: ['news', 'articles', { q: searchQuery, category: activeCategory }],
    queryFn: ({ pageParam = 1, signal }) =>
      getNewsArticles(
        {
          page: pageParam as number,
          limit: PAGE_SIZE,
          ...(searchQuery ? { q: searchQuery } : {}),
          ...(activeCategory !== 'all' ? { category: activeCategory } : {}),
        },
        undefined,
        signal,
      ),
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore ? lastPage.pagination.page + 1 : undefined,
    staleTime: 5 * 60 * 1000,
    initialPageParam: 1,
  });

  // Flatten all pages into a single article list
  const articles: GetNewsArticles200ArticlesItem[] =
    articlesData?.pages.flatMap((page) => page.articles) ?? [];

  // ── Saved articles query ─────────────────────────────────────────────────
  const {
    data: savedData,
    isLoading: savedLoading,
    isError: savedError,
    refetch: refetchSaved,
  } = useGetNewsSaved(
    { page: 1, limit: PAGE_SIZE },
    { query: { staleTime: 0 } },
  );

  const savedArticles = savedData?.articles ?? [];

  // ── Save mutation (with 409 handling) ────────────────────────────────────
  const saveMutation = usePostNewsArticlesArticleIdSave({
    mutation: {
      mutationFn: async (variables: { articleId: string }) => {
        try {
          return await postNewsArticlesArticleIdSave(variables.articleId);
        } catch (error: unknown) {
          const axiosError = error as { response?: { status?: number } };
          if (axiosError?.response?.status === 409) {
            // 409 means article already saved — treat as success to
            // prevent rolling back the optimistic update.
            return { saved: true, articleId: variables.articleId };
          }
          throw error;
        }
      },
      onMutate: async (variables) => {
        await queryClient.cancelQueries({ queryKey: ['news', 'articles'] });
        const articleId = variables.articleId;

        // Optimistically update all article pages
        queryClient.setQueriesData<{
          pages: { articles: GetNewsArticles200ArticlesItem[] }[];
          pageParams: number[];
        }>(
          { queryKey: ['news', 'articles'] },
          (old) => {
            if (!old) return old;
            return {
              ...old,
              pages: old.pages.map((page) => ({
                ...page,
                articles: page.articles.map((a) =>
                  a.id === articleId ? { ...a, isSaved: true } : a,
                ),
              })),
            };
          },
        );
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: ['news'] });
      },
    },
  });

  // ── Unsave mutation ──────────────────────────────────────────────────────
  const unsaveMutation = useDeleteNewsArticlesArticleIdSave({
    mutation: {
      onMutate: async (variables) => {
        await queryClient.cancelQueries({ queryKey: ['news', 'articles'] });
        const articleId = variables.articleId;

        queryClient.setQueriesData<{
          pages: { articles: GetNewsArticles200ArticlesItem[] }[];
          pageParams: number[];
        }>(
          { queryKey: ['news', 'articles'] },
          (old) => {
            if (!old) return old;
            return {
              ...old,
              pages: old.pages.map((page) => ({
                ...page,
                articles: page.articles.map((a) =>
                  a.id === articleId ? { ...a, isSaved: false } : a,
                ),
              })),
            };
          },
        );
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: ['news'] });
      },
    },
  });

  const handleToggleSave = useCallback(
    (article: NewsArticle) => {
      if (article.isSaved) {
        unsaveMutation.mutate({ articleId: article.id });
      } else {
        saveMutation.mutate({ articleId: article.id });
      }
    },
    [saveMutation, unsaveMutation],
  );

  // ── Article selection / reading ──────────────────────────────────────────
  const handleOpenArticle = useCallback((article: NewsArticle) => {
    openArticleUrl(article.url);
  }, []);

  const handleSelectArticle = useCallback((article: NewsArticle) => {
    setSelectedArticle(article);
  }, []);

  // ── Category / search changes ────────────────────────────────────────────
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
  }, []);

  const handleCategoryChange = useCallback((value: string) => {
    setActiveCategory(value);
  }, []);

  // ── Infinite scroll observer ─────────────────────────────────────────────
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: '200px' },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // ── Empty state determination ────────────────────────────────────────────
  const showArticlesEmpty =
    !articlesLoading && !articlesError && articles.length === 0;
  const showSavedEmpty =
    !savedLoading && !savedError && savedArticles.length === 0;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-gray-900">News</h1>
        <button
          onClick={() => refetchArticles()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          disabled={articlesLoading}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className={`h-4 w-4 ${articlesLoading ? 'animate-spin' : ''}`}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182"
            />
          </svg>
          Refresh
        </button>
      </div>

      {/* Tab toggle: All News / Saved */}
      <div className="flex border-b border-gray-200 mb-4">
        <button
          onClick={() => setActiveTab('all')}
          className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'all'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          All News
        </button>
        <button
          onClick={() => setActiveTab('saved')}
          className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'saved'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          Saved
        </button>
      </div>

      {/* ── "All News" tab ────────────────────────────────────────────────── */}
      {activeTab === 'all' && (
        <>
          {/* Search bar */}
          <div className="mb-4">
            <SearchBar
              value={searchQuery}
              onChange={handleSearchChange}
            />
          </div>

          {/* Category bar */}
          <div className="mb-5">
            <CategoryBar
              categories={categories}
              activeCategory={activeCategory}
              onSelect={handleCategoryChange}
              isLoading={categoriesLoading}
            />
          </div>

          {/* ── Error state ──────────────────────────────────────────────── */}
          {articlesError && (
            <div className="text-center py-16 bg-white shadow sm:rounded-lg">
              <div className="text-5xl mb-4">⚠️</div>
              <p className="text-gray-900 font-medium text-lg">
                Something went wrong
              </p>
              <p className="text-gray-500 text-sm mt-1 max-w-sm mx-auto">
                We couldn't load the news feed. Please check your connection
                and try again.
              </p>
              <button
                onClick={() => refetchArticles()}
                className="mt-5 inline-flex items-center gap-2 px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="h-4 w-4"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182"
                  />
                </svg>
                Try Again
              </button>
              {/* Show technical details for debugging */}
              {articlesErrorObj && (
                <p className="mt-3 text-xs text-gray-400">
                  {articlesErrorObj instanceof Error
                    ? articlesErrorObj.message
                    : 'Unknown error'}
                </p>
              )}
            </div>
          )}

          {/* ── Loading state ────────────────────────────────────────────── */}
          {articlesLoading && <NewsSkeleton count={6} />}

          {/* ── Empty state ───────────────────────────────────────────────── */}
          {showArticlesEmpty && (
            <div className="text-center py-16 bg-white shadow sm:rounded-lg">
              <div className="text-5xl mb-4">📰</div>
              <p className="text-gray-900 font-medium text-lg">
                {searchQuery
                  ? `No articles found for "${searchQuery}"`
                  : 'No articles right now'}
              </p>
              <p className="text-gray-500 text-sm mt-1 max-w-sm mx-auto">
                {searchQuery
                  ? 'Try a different search term.'
                  : 'Check back soon for the latest fashion news and trends.'}
              </p>
              <button
                onClick={() => refetchArticles()}
                className="mt-5 inline-flex items-center gap-2 px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="h-4 w-4"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182"
                  />
                </svg>
                Refresh
              </button>
            </div>
          )}

          {/* ── Article grid ─────────────────────────────────────────────── */}
          {!articlesLoading && !articlesError && articles.length > 0 && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {articles.map((article) => (
                  <ArticleCard
                    key={article.id}
                    article={article}
                    onSelect={handleSelectArticle}
                    onToggleSave={handleToggleSave}
                  />
                ))}
              </div>

              {/* Infinite scroll trigger */}
              <div ref={loadMoreRef} className="h-8 mt-4" />

              {/* Next-page loading indicator */}
              {isFetchingNextPage && (
                <div className="flex justify-center py-4">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="h-6 w-6 animate-spin text-gray-400"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182"
                    />
                  </svg>
                </div>
              )}

              {/* End-of-list marker */}
              {!hasNextPage && articles.length > 0 && (
                <p className="text-center text-xs text-gray-400 py-4">
                  You're all caught up!
                </p>
              )}
            </>
          )}
        </>
      )}

      {/* ── "Saved" tab ──────────────────────────────────────────────────── */}
      {activeTab === 'saved' && (
        <SavedSection
          articles={savedArticles}
          isLoading={savedLoading}
          isError={savedError}
          isEmpty={showSavedEmpty}
          onSelect={handleSelectArticle}
          onToggleSave={handleToggleSave}
          onRetry={() => refetchSaved()}
        />
      )}

      {/* ── Article Detail Modal ──────────────────────────────────────────── */}
      <ArticleDetailModal
        article={selectedArticle}
        isOpen={!!selectedArticle}
        onClose={() => setSelectedArticle(null)}
        onToggleSave={handleToggleSave}
        onReadFull={handleOpenArticle}
      />
    </div>
  );
}
