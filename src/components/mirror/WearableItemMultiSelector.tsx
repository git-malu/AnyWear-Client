import { useState, useMemo } from 'react';
import { useGetWardrobe, useGetWardrobeCategories } from '../../api/endpoints/wardrobe/wardrobe';
import CachedImage from '../CachedImage';
import { getPrimaryImage } from '../../lib/image-utils';
import type { GetWardrobe200Item } from '../../api/model/getWardrobe200Item';
import type { GetWardrobeParams } from '../../api/model/getWardrobeParams';

interface WearableItemMultiSelectorProps {
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
}

export default function WearableItemMultiSelector({ selectedIds, onSelectionChange }: WearableItemMultiSelectorProps) {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [search, setSearch] = useState('');

  const filters: GetWardrobeParams = activeCategory !== 'all' ? { category: activeCategory } : {};
  const { data: wardrobeData, isLoading } = useGetWardrobe(filters);
  const { data: categoriesResponse } = useGetWardrobeCategories();

  const items = Array.isArray(wardrobeData) ? wardrobeData : [];
  const categories = categoriesResponse?.categories ?? [];

  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter((item: GetWardrobe200Item) =>
      (item.name?.toLowerCase().includes(q)) || item.category.toLowerCase().includes(q)
    );
  }, [items, search]);

  const selectedItems = useMemo(() => {
    return items.filter((item: GetWardrobe200Item) => selectedIds.includes(item.id));
  }, [items, selectedIds]);

  const toggleItem = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((sid) => sid !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  const removeSelected = (id: string) => {
    onSelectionChange(selectedIds.filter((sid) => sid !== id));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className={`text-sm font-medium ${selectedIds.length > 0 ? 'text-indigo-600' : 'text-gray-500'}`}>
          {selectedIds.length > 0 ? `${selectedIds.length} selected` : 'No wearable items selected'}
        </span>
      </div>

      {selectedItems.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {selectedItems.map((item) => (
            <span
              key={item.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700"
            >
              {item.name || item.category}
              <button
                onClick={() => removeSelected(item.id)}
                className="text-indigo-500 hover:text-indigo-700"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search wearable items..."
        className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 mb-3"
      />

      {categories.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
              activeCategory === 'all'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                activeCategory === cat
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="animate-pulse bg-gray-200 rounded-lg aspect-[3/4]" />
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 p-6 text-center">
          <p className="text-sm text-gray-500">Your wardrobe is empty. Add items first.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-96 overflow-y-auto">
          {filteredItems.map((item: GetWardrobe200Item) => {
            const isSelected = selectedIds.includes(item.id);
            const imageKey = getPrimaryImage(item.imageKeys);
            return (
              <div
                key={item.id}
                onClick={() => toggleItem(item.id)}
                className={`relative rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${
                  isSelected
                    ? 'border-indigo-500 ring-2 ring-indigo-500'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="aspect-[3/4] bg-gray-200">
                  {imageKey ? (
                    <CachedImage src={imageKey} cacheKey={item.id} alt={item.name || item.category} className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-400 text-xs">No Image</div>
                  )}
                </div>
                <div className="p-1.5">
                  <p className="text-xs font-medium text-gray-900 truncate">{item.name || item.category}</p>
                  <span className="text-xs text-gray-500">{item.category}</span>
                </div>
                {isSelected && (
                  <div className="absolute top-1.5 right-1.5 bg-indigo-600 text-white rounded-full p-0.5">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
