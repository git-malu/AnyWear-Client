import { useState, useEffect } from 'react';
import { useGetWardrobe, useDeleteWardrobeItemsId, useGetWardrobeCategories } from '../../api/endpoints/wardrobe/wardrobe';
import { useGetOutfits, useDeleteOutfitsId } from '../../api/endpoints/outfits/outfits';
import AddItemModal from './AddItemModal';
import CreateOutfitModal from './CreateOutfitModal';
import ItemDetailsModal from './ItemDetailsModal';
import CachedImage from '../../components/CachedImage';
import { getPrimaryImage } from '../../lib/image-utils';
import { connectSse } from '../../lib/sse';
import { GetWardrobe200Item } from '../../api/model/getWardrobe200Item';
import { GetWardrobeParams } from '../../api/model/getWardrobeParams';
import { useQueryClient } from '@tanstack/react-query';

function getTagStatusBadge(status: string | undefined) {
  switch (status) {
    case 'processing':
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">Analyzing...</span>;
    case 'ready':
      return null;
    case 'failed':
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Failed</span>;
    case 'uploading':
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Uploading...</span>;
    default:
      return null;
  }
}

function getColorFromAttributes(styleAttributes: unknown): string | null {
  if (!styleAttributes || typeof styleAttributes !== 'object') return null;
  const sa = styleAttributes as Record<string, unknown>;
  return typeof sa.color === 'string' ? sa.color : null;
}

function getMaterialFromAttributes(styleAttributes: unknown): string | null {
  if (!styleAttributes || typeof styleAttributes !== 'object') return null;
  const sa = styleAttributes as Record<string, unknown>;
  return typeof sa.material === 'string' ? sa.material : null;
}

export default function WardrobePage() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isOutfitModalOpen, setIsOutfitModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<GetWardrobe200Item | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [filters, setFilters] = useState<GetWardrobeParams>({});

  const queryClient = useQueryClient();

  const { data: wardrobeResponse, isLoading, refetch } = useGetWardrobe(filters, {});

  const { data: categoriesResponse } = useGetWardrobeCategories();
  const { mutate: deleteItem } = useDeleteWardrobeItemsId();
  const { data: outfitsResponse, refetch: refetchOutfits } = useGetOutfits({ query: {} });
  const { mutate: deleteOutfit } = useDeleteOutfitsId();

  const wardrobeData = Array.isArray(wardrobeResponse) ? wardrobeResponse : (wardrobeResponse as any)?.data && Array.isArray((wardrobeResponse as any).data) ? (wardrobeResponse as any).data : [];
  const categories = categoriesResponse?.categories ?? [];

  useEffect(() => {
    if (!wardrobeData || !Array.isArray(wardrobeData)) return;

    const connections: Array<ReturnType<typeof connectSse>> = [];

    for (const item of wardrobeData as GetWardrobe200Item[]) {
      if (item.taggingStatus === 'processing' || item.taggingStatus === 'uploading') {
        const conn = connectSse(
          `/wardrobe/items/${item.id}/stream`,
          (data) => {
            if (data.tagging_status === 'ready' || data.tagging_status === 'failed') {
              queryClient.invalidateQueries({ queryKey: ['/wardrobe'] });
            }
          },
        );
        connections.push(conn);
      }
    }

    return () => {
      connections.forEach((c) => c.close());
    };
  }, [wardrobeData, queryClient]);

  const handleDelete = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this item?')) {
      deleteItem({ id }, {
        onSuccess: () => {
          if (selectedItem?.id === id) setSelectedItem(null);
          refetch();
        },
      });
    }
  };

  const handleCategoryFilter = (category: string) => {
    if (category === 'all') {
      setActiveCategory('all');
      setFilters({});
    } else {
      setActiveCategory(category);
      setFilters({ category });
    }
  };

  const handleRefresh = () => {
    setIsAddModalOpen(false);
    refetch();
  };

  const outfits = outfitsResponse?.outfits ?? [];

  const handleDeleteOutfit = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (window.confirm('Delete this outfit?')) {
      deleteOutfit({ id }, { onSuccess: () => refetchOutfits() });
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Wardrobe</h1>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Add Item
        </button>
      </div>

      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => handleCategoryFilter('all')}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
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
              onClick={() => handleCategoryFilter(cat)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
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
        <div className="text-center py-12">Loading...</div>
      ) : wardrobeData.length === 0 ? (
        <div className="text-center py-12 bg-white shadow sm:rounded-lg">
          <p className="text-gray-500">Your wardrobe is empty. Tap "Add Item" to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {(wardrobeData as GetWardrobe200Item[]).map((item) => {
            const color = getColorFromAttributes(item.styleAttributes);
            const material = getMaterialFromAttributes(item.styleAttributes);
            const statusBadge = getTagStatusBadge(item.taggingStatus);
            const isProcessing = item.taggingStatus === 'processing' || item.taggingStatus === 'uploading';

            return (
              <div
                key={item.id}
                className={`relative group bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200 hover:shadow-md transition-shadow ${isProcessing ? 'cursor-default' : 'cursor-pointer'}`}
                onClick={() => !isProcessing && setSelectedItem(item)}
              >
                <div className="aspect-w-3 aspect-h-4 bg-gray-200">
                  {getPrimaryImage(item.imageKeys) ? (
                    <CachedImage src={getPrimaryImage(item.imageKeys)!} cacheKey={item.id} alt={item.category || 'Wardrobe item'} className="object-cover" />
                  ) : (
                    <div className="flex items-center justify-center h-48 w-full bg-gray-100 text-gray-400">
                      No Image
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <div className="flex items-center gap-1">
                    <h3 className="text-sm font-medium text-gray-900 truncate">{item.name || item.category || 'Unknown'}</h3>
                    {statusBadge}
                  </div>
                  {color && (
                    <p className="text-xs text-gray-500">
                      {[color, material].filter(Boolean).join(' • ')}
                    </p>
                  )}
                </div>
                <button
                  onClick={(e) => item.id && handleDelete(item.id, e)}
                  className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {outfits.length > 0 && (
        <div className="mt-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900">My Outfits</h2>
            <button
              onClick={() => setIsOutfitModalOpen(true)}
              className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
            >
              + Create Outfit
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {outfits.map((outfit) => {
              const firstItem = outfit.wearableItems?.[0];
              const primaryImage = firstItem ? getPrimaryImage(firstItem as any) : null;
              return (
                <div
                  key={outfit.id}
                  className="relative group bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200 hover:shadow-md transition-shadow"
                >
                  <div className="aspect-w-3 aspect-h-4 bg-gray-200">
                    {primaryImage ? (
                      <CachedImage src={primaryImage} cacheKey={outfit.id} alt={outfit.name || 'Outfit'} className="object-cover" />
                    ) : (
                      <div className="flex items-center justify-center h-full bg-gray-100 text-gray-400 text-xs">No image</div>
                    )}
                  </div>
                  <div className="p-3">
                    <h3 className="text-sm font-medium text-gray-900 truncate">{outfit.name || 'Untitled Outfit'}</h3>
                    <p className="text-xs text-gray-500">{outfit.wearableItems?.length ?? 0} items</p>
                  </div>
                  <button
                    onClick={(e) => handleDeleteOutfit(outfit.id, e)}
                    className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {outfits.length === 0 && (
        <div className="mt-8 bg-white shadow sm:rounded-lg p-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700">No outfits yet</p>
            <p className="text-xs text-gray-500">Group wardrobe items into outfits for quick try-ons.</p>
          </div>
          <button
            onClick={() => setIsOutfitModalOpen(true)}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
          >
            Create Outfit
          </button>
        </div>
      )}

      {isAddModalOpen && (
        <AddItemModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onSuccess={handleRefresh}
        />
      )}

      {isOutfitModalOpen && (
        <CreateOutfitModal
          isOpen={isOutfitModalOpen}
          onClose={() => setIsOutfitModalOpen(false)}
          onSuccess={() => refetchOutfits()}
        />
      )}

      {selectedItem && (
        <ItemDetailsModal
          item={selectedItem}
          isOpen={!!selectedItem}
          onClose={() => setSelectedItem(null)}
          onSuccess={() => {
            setSelectedItem(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}
