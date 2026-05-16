import { useRef } from 'react';
import type { GetNewsCategories200CategoriesItem } from '../../api/model';

interface CategoryBarProps {
  categories: GetNewsCategories200CategoriesItem[];
  activeCategory: string;
  onSelect: (value: string) => void;
  isLoading?: boolean;
}

export default function CategoryBar({
  categories,
  activeCategory,
  onSelect,
  isLoading = false,
}: CategoryBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  if (isLoading) {
    return (
      <div className="flex gap-2 overflow-hidden py-1">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="shrink-0 h-8 w-20 animate-pulse rounded-full bg-gray-200"
          />
        ))}
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="flex gap-2 overflow-x-auto py-1 scrollbar-hide -mx-1 px-1"
    >
      {/* "All" is always first */}
      <button
        onClick={() => onSelect('all')}
        className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
          activeCategory === 'all'
            ? 'bg-indigo-600 text-white shadow-sm'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        All
      </button>

      {categories.map((cat) => (
        <button
          key={cat.value}
          onClick={() => onSelect(cat.value)}
          className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
            activeCategory === cat.value
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {cat.label}
        </button>
      ))}
    </div>
  );
}
