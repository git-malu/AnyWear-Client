import type { GetNewsSaved200ArticlesItem } from '../../api/model';
import ArticleCard from './ArticleCard';

interface SavedSectionProps {
  articles: GetNewsSaved200ArticlesItem[];
  isLoading: boolean;
  isError: boolean;
  isEmpty: boolean;
  onSelect: (article: GetNewsSaved200ArticlesItem) => void;
  onToggleSave: (article: GetNewsSaved200ArticlesItem) => void;
  onRetry: () => void;
}

export default function SavedSection({
  articles,
  isLoading,
  isError,
  isEmpty,
  onSelect,
  onToggleSave,
  onRetry,
}: SavedSectionProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200"
          >
            <div className="aspect-w-16 aspect-h-9 animate-pulse bg-gray-200" />
            <div className="p-3 space-y-2">
              <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
              <div className="h-3 bg-gray-200 rounded animate-pulse w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center py-12 bg-white shadow sm:rounded-lg">
        <div className="text-4xl mb-3">⚠️</div>
        <p className="text-gray-900 font-medium">Something went wrong</p>
        <p className="text-gray-500 text-sm mt-1">
          We couldn't load your saved articles.
        </p>
        <button
          onClick={onRetry}
          className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="text-center py-16 bg-white shadow sm:rounded-lg">
        <div className="text-5xl mb-4">🔖</div>
        <p className="text-gray-900 font-medium text-lg">
          No saved articles yet
        </p>
        <p className="text-gray-500 text-sm mt-1 max-w-sm mx-auto">
          Browse the news tab to find articles worth keeping. Tap the bookmark
          icon to save them for later.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {articles.map((article) => (
        <ArticleCard
          key={article.id}
          article={article}
          onSelect={onSelect}
          onToggleSave={onToggleSave}
        />
      ))}
    </div>
  );
}
