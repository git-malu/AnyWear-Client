import { useState, useEffect } from 'react';
import type { GetNewsArticles200ArticlesItem, GetNewsSaved200ArticlesItem } from '../../api/model';
import { formatRelativeTime, formatDate } from '../../pages/news/utils';

type NewsArticle = GetNewsArticles200ArticlesItem | GetNewsSaved200ArticlesItem;

interface ArticleDetailModalProps {
  article: NewsArticle | null;
  isOpen: boolean;
  onClose: () => void;
  onToggleSave: (article: NewsArticle) => void;
  onReadFull: (article: NewsArticle) => void;
}

export default function ArticleDetailModal({
  article,
  isOpen,
  onClose,
  onToggleSave,
  onReadFull,
}: ArticleDetailModalProps) {
  const [imageFailed, setImageFailed] = useState(false);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen || !article) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal content */}
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 -ml-1"
            aria-label="Close"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="h-6 w-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18 18 6M6 6l12 12"
              />
            </svg>
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleSave(article);
            }}
            className="text-gray-400 hover:text-indigo-600 transition-colors p-1 -mr-1"
            aria-label={article.isSaved ? 'Unsave article' : 'Save article'}
          >
            {article.isSaved ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-6 w-6 text-indigo-600"
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
                className="h-6 w-6"
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

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1">
          {/* Hero image */}
          {article.imageUrl && !imageFailed ? (
            <div className="w-full">
              <img
                src={article.imageUrl}
                alt={article.title}
                onError={() => setImageFailed(true)}
                className="w-full object-cover max-h-64"
              />
            </div>
          ) : (
            <div className="w-full h-48 bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1}
                stroke="currentColor"
                className="h-12 w-12 text-gray-400"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z"
                />
              </svg>
            </div>
          )}

          {/* Content */}
          <div className="px-4 py-4">
            <h2 className="text-xl font-bold text-gray-900 leading-tight">
              {article.title}
            </h2>

            {/* Meta row */}
            <div className="mt-2 flex flex-wrap items-center gap-x-2 text-sm text-gray-500">
              <span className="font-medium text-gray-700">
                {article.sourceName}
              </span>
              {article.author && (
                <>
                  <span className="text-gray-300">·</span>
                  <span>{article.author}</span>
                </>
              )}
              <span className="text-gray-300">·</span>
              <span title={formatDate(article.publishedAt)}>
                {formatRelativeTime(article.publishedAt)}
              </span>
            </div>

            {/* Divider */}
            <div className="mt-4 border-t border-gray-100" />

            {/* Content excerpt */}
            {(article.content || article.description) && (
              <p className="mt-4 text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                {article.content || article.description}
              </p>
            )}
          </div>
        </div>

        {/* Footer with CTA */}
        <div className="px-4 py-4 border-t border-gray-100 shrink-0">
          <button
            onClick={() => onReadFull(article)}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-transparent text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
          >
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
                d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
              />
            </svg>
            Read Full Article
          </button>
        </div>
      </div>
    </div>
  );
}
