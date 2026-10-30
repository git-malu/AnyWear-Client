import { useState, useMemo } from 'react';
import { useGetWardrobe, useGetWardrobeCategories } from '../../api/endpoints/wardrobe/wardrobe';
import CachedImage from '../CachedImage';
import { getPrimaryImageUrl } from '../../lib/image-utils';
import type { GetWardrobe200Item } from '../../api/model/getWardrobe200Item';
import type { GetWardrobeParams } from '../../api/model/getWardrobeParams';

interface WearableItemMultiSelectorProps {
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  outfitName?: string;
  onOutfitNameChange?: (value: string) => void;
}

export default function WearableItemMultiSelector({ selectedIds, onSelectionChange, outfitName, onOutfitNameChange }: WearableItemMultiSelectorProps) {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [search, setSearch] = useState('');

  const filters: GetWardrobeParams = activeCategory !== 'all' ? { category: activeCategory } : {};
  const { data: wardrobeData, isLoading } = useGetWardrobe(filters);
  const { data: categoriesResponse } = useGetWardrobeCategories();

  const items = useMemo(
    () => (Array.isArray(wardrobeData) ? wardrobeData : []),
    [wardrobeData],
  );
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
        <span aria-live="polite" className={`text-sm font-medium ${selectedIds.length > 0 ? 'text-indigo-700' : 'text-gray-600'}`}>
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
                aria-label={`Remove ${item.name || item.category} from selection`}
                className="rounded-full p-1 text-indigo-700 hover:bg-indigo-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}

      <label htmlFor="mirror-item-search" className="sr-only">Search wardrobe items</label>
      <input
        id="mirror-item-search"
        type="search"
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
            } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2`}
            aria-pressed={activeCategory === 'all'}
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
              } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2`}
              aria-pressed={activeCategory === cat}
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
        <div className="grid max-h-96 grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3 md:grid-cols-4">
          {filteredItems.map((item: GetWardrobe200Item) => {
            const isSelected = selectedIds.includes(item.id);
            const imageUrl = getPrimaryImageUrl(item.images);
            // The cache file names the image record, so two images of one item
            // are two entries rather than one overwritten entry.
            const primaryImageId = item.images.find((image) => image.isPrimary)?.imageId
              ?? item.images[0]?.imageId;
            return (
              <button
                type="button"
                key={item.id}
                onClick={() => toggleItem(item.id)}
                aria-pressed={isSelected}
                aria-label={`${isSelected ? 'Remove' : 'Select'} ${item.name || item.category}`}
                className={`relative block w-full overflow-hidden rounded-xl border text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-600 ${
                  isSelected
                    ? 'border-indigo-600 bg-indigo-50/40'
                    : 'border-gray-200 bg-white hover:border-gray-400'
                }`}
              >
                <div className="aspect-[4/5] bg-gray-100">
                  {imageUrl && primaryImageId ? (
                    <CachedImage src={imageUrl} cacheKey={primaryImageId} alt={item.name || item.category} className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-400 text-xs">No Image</div>
                  )}
                </div>
                <div className="p-2">
                  <p className="truncate text-xs font-medium text-gray-900">{item.name || item.category}</p>
                  <span className="text-xs text-gray-600">{item.category}</span>
                </div>
                {isSelected && (
                  <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-indigo-700 px-2 py-1 text-[11px] font-medium text-white">
                    Selected
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {onOutfitNameChange !== undefined && (
        <div className="mt-3 border-t border-gray-100 pt-3">
          <label htmlFor="mirror-outfit-name" className="mb-1 block text-xs font-medium text-gray-700">Outfit name (optional)</label>
          <input
            id="mirror-outfit-name"
            type="text"
            maxLength={200}
            value={outfitName ?? ''}
            onChange={(e) => onOutfitNameChange(e.target.value)}
            placeholder="Save as outfit (optional)"
            className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400 placeholder-gray-400"
          />
        </div>
      )}
    </div>
  );
}
