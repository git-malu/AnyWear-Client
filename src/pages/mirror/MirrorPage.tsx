import { useState, useCallback } from 'react';
import MirrorErrorBoundary from '../../components/mirror/MirrorErrorBoundary';
import CreditDisplay from '../../components/mirror/CreditDisplay';
import BasePhotoSelector from '../../components/mirror/BasePhotoSelector';
import WearableItemMultiSelector from '../../components/mirror/WearableItemMultiSelector';
import OutfitPicker from '../../components/mirror/OutfitPicker';
import StylePromptInput from '../../components/mirror/StylePromptInput';
import TryOnButton from '../../components/mirror/TryOnButton';
import ResultArea from '../../components/mirror/ResultArea';
import VtoHistorySection from '../../components/mirror/VtoHistorySection';
import useVtoGeneration from '../../hooks/useVtoGeneration';
import { useGetUsersMe } from '../../api/endpoints/users/users';

type SelectionMode = 'outfit' | 'items';

export default function MirrorPage() {
  const [mode, setMode] = useState<SelectionMode>('items');
  const [selectedBasePhotoId, setSelectedBasePhotoId] = useState<string | null>(null);
  const [selectedOutfitId, setSelectedOutfitId] = useState<string | null>(null);
  const [selectedWearableItemIds, setSelectedWearableItemIds] = useState<string[]>([]);
  const [outfitName, setOutfitName] = useState('');
  const [prompt, setPrompt] = useState('');

  const { generate, result, errorMessage, isPolling, isStarting, vtoId } = useVtoGeneration();
  const { data: user } = useGetUsersMe();

  const credits = user?.dailyCredits ?? 0;

  const hasItems = mode === 'outfit' ? !!selectedOutfitId : selectedWearableItemIds.length > 0;
  const canGenerate = !!selectedBasePhotoId && hasItems && credits > 0 && !isStarting && !isPolling;

  const handleGenerate = useCallback(() => {
    if (!selectedBasePhotoId) return;

    if (mode === 'outfit' && selectedOutfitId) {
      generate({
        base_photo_id: selectedBasePhotoId,
        outfit_id: selectedOutfitId,
        prompt: prompt.trim() || undefined,
      });
    } else if (mode === 'items' && selectedWearableItemIds.length > 0) {
      generate({
        base_photo_id: selectedBasePhotoId,
        wearable_item_ids: selectedWearableItemIds,
        outfit_name: outfitName.trim() || undefined,
        prompt: prompt.trim() || undefined,
      });
    }
  }, [generate, selectedBasePhotoId, mode, selectedOutfitId, selectedWearableItemIds, outfitName, prompt]);

  const handleReuseOutfit = useCallback((ids: string[]) => {
    setMode('items');
    setSelectedWearableItemIds(ids);
    setSelectedOutfitId(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Outfit</h2>
              <div className="flex rounded-lg bg-gray-100 p-0.5">
                <button
                  onClick={() => { setMode('outfit'); setSelectedWearableItemIds([]); }}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${mode === 'outfit' ? 'bg-white text-gray-900 shadow' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Saved
                </button>
                <button
                  onClick={() => { setMode('items'); setSelectedOutfitId(null); }}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${mode === 'items' ? 'bg-white text-gray-900 shadow' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Select Items
                </button>
              </div>
            </div>

            {mode === 'outfit' ? (
              <OutfitPicker
                selectedOutfitId={selectedOutfitId}
                onSelect={setSelectedOutfitId}
              />
            ) : (
              <WearableItemMultiSelector
                selectedIds={selectedWearableItemIds}
                onSelectionChange={setSelectedWearableItemIds}
                outfitName={outfitName}
                onOutfitNameChange={setOutfitName}
              />
            )}
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
              {selectedBasePhotoId && !hasItems && (
                <p className="text-xs text-gray-400 text-center">
                  {mode === 'outfit' ? 'Select an outfit' : 'Select at least one wearable item'}
                </p>
              )}
              {selectedBasePhotoId && hasItems && credits === 0 && (
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
            onRate={() => {}}
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
