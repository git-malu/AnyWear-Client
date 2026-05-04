import { useState } from 'react';
import useVtoHistory from '../../hooks/useVtoHistory';
import CachedImage from '../CachedImage';
import RatingWidget from './RatingWidget';
import type { GetVtoHistoryStatus } from '../../api/model/getVtoHistoryStatus';
import type { GetVtoHistory200GenerationsItem } from '../../api/model/getVtoHistory200GenerationsItem';

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

interface VtoHistorySectionProps {
  onReuseOutfit: (wearableItemIds: string[]) => void;
}

export default function VtoHistorySection({ onReuseOutfit }: VtoHistorySectionProps) {
  const { generations, total, page, nextPage, goToPage, isLoading, filters, setFilters, rateGeneration } = useVtoHistory();
  const [viewImageUrl, setViewImageUrl] = useState<string | null>(null);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select
          value={filters.status ?? ''}
          onChange={(e) => {
            const val = e.target.value as GetVtoHistoryStatus | '';
            setFilters({ ...filters, status: val || undefined });
          }}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Status</option>
          <option value="Complete">Complete</option>
          <option value="Failed">Failed</option>
          <option value="Pending">Pending</option>
          <option value="Processing">Processing</option>
        </select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="animate-pulse bg-gray-200 rounded-lg aspect-[3/4]" />
          ))}
        </div>
      ) : generations.length === 0 ? (
        <div className="bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 p-6 text-center">
          <p className="text-sm text-gray-500">No try-on sessions yet. Select your base photo and wearable items above to get started.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {generations.map((gen: GetVtoHistory200GenerationsItem) => {
              const wearableItemIds = gen.items?.map((item) => item.id) ?? [];
              return (
                <div key={gen.id} className="relative group bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                  <div className="aspect-[3/4] bg-gray-200">
                    {gen.generatedImageUrl ? (
                      <CachedImage
                        src={gen.generatedImageUrl}
                        cacheKey={`vto-hist-${gen.id}`}
                        alt="Try-on history"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-400 text-xs">
                        {gen.status === 'Failed' ? 'Generation failed' : 'No image'}
                      </div>
                    )}
                  </div>
                  <div className="p-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-500">{relativeTime(gen.createdAt)}</span>
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${
                        gen.status === 'Complete' ? 'bg-green-100 text-green-800' :
                        gen.status === 'Failed' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {gen.status}
                      </span>
                    </div>
                    {gen.items.length > 0 && (
                      <p className="text-xs text-gray-500">{gen.items.length} wearable item{gen.items.length !== 1 ? 's' : ''}</p>
                    )}
                    {gen.rating != null ? (
                      <RatingWidget rating={gen.rating} onChange={() => {}} readonly />
                    ) : gen.status === 'Complete' && (
                      <RatingWidget rating={null} onChange={(r) => rateGeneration(gen.id, r)} />
                    )}
                  </div>
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-3">
                    {gen.generatedImageUrl && (
                      <button
                        onClick={() => setViewImageUrl(gen.generatedImageUrl)}
                        className="w-full text-xs bg-white/90 text-gray-800 px-3 py-1.5 rounded hover:bg-white text-center"
                      >
                        View Full
                      </button>
                    )}
                    {wearableItemIds.length > 0 && (
                      <button
                        onClick={() => onReuseOutfit(wearableItemIds)}
                        className="w-full text-xs bg-white/90 text-gray-800 px-3 py-1.5 rounded hover:bg-white text-center"
                      >
                        Reuse Outfit
                      </button>
                    )}
                    <button
                      onClick={() => {/* re-submit handled by parent */}}
                      className="w-full text-xs bg-white/90 text-gray-800 px-3 py-1.5 rounded hover:bg-white text-center"
                    >
                      Retry
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <span className="text-sm text-gray-500">
              Page {page} of {Math.ceil(total / (filters.limit || 12))}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              {nextPage && (
                <button
                  onClick={() => goToPage(nextPage)}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Next
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {viewImageUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setViewImageUrl(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <img src={viewImageUrl} alt="Full view" className="max-w-full max-h-[90vh] object-contain rounded-lg" />
            <button
              onClick={() => setViewImageUrl(null)}
              className="absolute top-2 right-2 bg-white rounded-full p-1 shadow-lg hover:bg-gray-100"
            >
              <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
