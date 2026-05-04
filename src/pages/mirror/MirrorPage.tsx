import { useState, useCallback } from 'react';
import MirrorErrorBoundary from '../../components/mirror/MirrorErrorBoundary';
import CreditDisplay from '../../components/mirror/CreditDisplay';
import BasePhotoSelector from '../../components/mirror/BasePhotoSelector';
import WearableItemMultiSelector from '../../components/mirror/WearableItemMultiSelector';
import StylePromptInput from '../../components/mirror/StylePromptInput';
import TryOnButton from '../../components/mirror/TryOnButton';
import ResultArea from '../../components/mirror/ResultArea';
import VtoHistorySection from '../../components/mirror/VtoHistorySection';
import useVtoGeneration from '../../hooks/useVtoGeneration';
import { useGetUsersMe } from '../../api/endpoints/users/users';

export default function MirrorPage() {
  const [selectedBasePhotoId, setSelectedBasePhotoId] = useState<string | null>(null);
  const [selectedWearableItemIds, setSelectedGarmentIds] = useState<string[]>([]);
  const [prompt, setPrompt] = useState('');

  const { generate, result, errorMessage, isPolling, isStarting, vtoId } = useVtoGeneration();
  const { data: user } = useGetUsersMe();

  const credits = user?.dailyCredits ?? 0;
  const canGenerate = !!selectedBasePhotoId && selectedWearableItemIds.length > 0 && credits > 0 && !isStarting && !isPolling;

  const handleGenerate = useCallback(() => {
    if (!selectedBasePhotoId || selectedWearableItemIds.length === 0) return;
    generate({
      base_photo_id: selectedBasePhotoId,
      wearable_item_ids: selectedWearableItemIds,
      prompt: prompt.trim() || undefined,
    });
  }, [generate, selectedBasePhotoId, selectedWearableItemIds, prompt]);

  const handleReuseOutfit = useCallback((ids: string[]) => {
    setSelectedGarmentIds(ids);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleRate = useCallback((_rating: number) => {
    // Rating will be handled by the hook integration
  }, []);

  return (
    <MirrorErrorBoundary>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">The Mirror</h1>
            <p className="mt-1 text-sm text-gray-500">Virtual try-on for your wardrobe items.</p>
          </div>
          <CreditDisplay />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Base Photo</h2>
            <BasePhotoSelector
              selectedPhotoId={selectedBasePhotoId}
              onSelect={setSelectedBasePhotoId}
            />
          </div>

          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Wearable Items</h2>
            <WearableItemMultiSelector
              selectedIds={selectedWearableItemIds}
              onSelectionChange={setSelectedGarmentIds}
            />
          </div>

          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Style Prompt (Optional)</h2>
            <StylePromptInput value={prompt} onChange={setPrompt} />
          </div>

          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Try On</h2>
            <div className="space-y-3">
              <TryOnButton
                onGenerate={handleGenerate}
                disabled={!canGenerate}
                isLoading={isStarting || isPolling}
                credits={credits}
              />
              {!selectedBasePhotoId && (
                <p className="text-xs text-gray-400 text-center">Select a base photo to start</p>
              )}
              {selectedBasePhotoId && selectedWearableItemIds.length === 0 && (
                <p className="text-xs text-gray-400 text-center">Select at least one wearable item</p>
              )}
              {selectedBasePhotoId && selectedWearableItemIds.length > 0 && credits === 0 && (
                <p className="text-xs text-red-500 text-center">Out of daily credits. Credits reset at midnight.</p>
              )}
              {errorMessage && (
                <p className="text-xs text-red-600 text-center">{errorMessage}</p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Result</h2>
          <ResultArea
            vtoId={vtoId}
            onRetry={handleGenerate}
            onRate={handleRate}
            currentRating={result?.image_key ? null : null}
          />
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">History</h2>
          <VtoHistorySection onReuseOutfit={handleReuseOutfit} />
        </div>
      </div>
    </MirrorErrorBoundary>
  );
}
