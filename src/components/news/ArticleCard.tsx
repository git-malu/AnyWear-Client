import { useState } from 'react';
import type { GetNewsArticles200ArticlesItem, GetNewsSaved200ArticlesItem } from '../../api/model';
import { formatRelativeTime } from '../../pages/news/utils';

type NewsArticle = GetNewsArticles200ArticlesItem | GetNewsSaved200ArticlesItem;

interface ArticleCardProps {
  article: NewsArticle;
  onSelect: (article: NewsArticle) => void;
  onToggleSave: (article: NewsArticle) => void;
}

export default function ArticleCard({
  article,
  onSelect,
  onToggleSave,
}: ArticleCardProps) {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <div
      onClick={() => onSelect(article)}
      className="group bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
    >
      {/* Image */}
      <div className="aspect-w-16 aspect-h-9 bg-gray-100 relative overflow-hidden">
        {article.imageUrl && !imageFailed ? (
          <img
            src={article.imageUrl}
            alt={article.title}
            loading="lazy"
            onError={() => setImageFailed(true)}
            className="object-cover w-full h-full"
          />
        ) : (
          <div className="flex items-center justify-center h-full w-full bg-gradient-to-br from-gray-200 to-gray-300">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1}
              stroke="currentColor"
              className="h-10 w-10 text-gray-400"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z"
              />
            </svg>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3">
        <h3 className="text-sm font-medium text-gray-900 line-clamp-2 leading-snug">
          {article.title}
        </h3>
        <div className="mt-1.5 flex items-center justify-between">
          <p className="text-xs text-gray-500">
            {article.sourceName}
            <span className="mx-1.5 text-gray-300">·</span>
            {formatRelativeTime(article.publishedAt)}
          </p>
          {/* Bookmark toggle */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleSave(article);
            }}
            className="text-gray-400 hover:text-indigo-600 transition-colors p-0.5 -mr-0.5"
            aria-label={article.isSaved ? 'Unsave article' : 'Save article'}
          >
            {article.isSaved ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-5 w-5 text-indigo-600"
              >
                <path
                  fillRule="evenodd"
                  d="M6.32 2.577a49.255 49.255 0 0 1 11.36 0c1.497.174 2.57 1.46 2.57 2.93V21a.75.75 0 0 1-1.085.67L12 18.089l-7.165 3.583A.75.75 0 0 1 3.75 21V5.507c0-1.47 1.073-2.756 2.57-2.93Z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="h-5 w-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z"
                />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
