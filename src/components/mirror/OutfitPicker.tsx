import { useGetOutfits } from '../../api/endpoints/outfits/outfits';
import { getPrimaryImage } from '../../lib/image-utils';
import CachedImage from '../CachedImage';

interface OutfitPickerProps {
  selectedOutfitId: string | null;
  onSelect: (outfitId: string) => void;
}

export default function OutfitPicker({ selectedOutfitId, onSelect }: OutfitPickerProps) {
  const { data, isLoading } = useGetOutfits({ query: {} });

  const outfits = data?.outfits ?? [];

  if (isLoading) {
    return <p className="text-sm text-gray-400">Loading outfits...</p>;
  }

  if (outfits.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-gray-500">No saved outfits yet.</p>
        <p className="text-xs text-gray-400 mt-1">Switch to &quot;Select Items&quot; to create one on the fly.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-[320px] overflow-y-auto">
      {outfits.map((outfit) => {
        const firstItem = outfit.wearableItems?.[0];
        const primaryImage = firstItem ? getPrimaryImage(firstItem.imageKeys) : null;
        const isSelected = outfit.id === selectedOutfitId;

        return (
          <button
            key={outfit.id}
            onClick={() => onSelect(outfit.id)}
            className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${isSelected ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-gray-200 hover:border-gray-300 bg-white'}`}
          >
            <div className="w-12 h-12 rounded-md bg-gray-100 flex-shrink-0 overflow-hidden">
              {primaryImage ? (
                <CachedImage src={primaryImage} cacheKey={outfit.id} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{outfit.name || 'Untitled Outfit'}</p>
              <p className="text-xs text-gray-500">{outfit.wearableItems?.length ?? 0} items</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
