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
      <div className="space-y-6 sm:space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-indigo-700">Your fitting room</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-gray-900">The Mirror</h1>
            <p className="mt-1 text-sm text-gray-600">Choose a photo and pieces from your wardrobe.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Step 1</p>
              <h2 className="mt-1 text-lg font-semibold text-gray-900">Choose a base photo</h2>
            </div>
            <BasePhotoSelector
              selectedPhotoId={selectedBasePhotoId}
              onSelect={setSelectedBasePhotoId}
            />
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Step 2</p>
                <h2 className="mt-1 text-lg font-semibold text-gray-900">Choose an outfit</h2>
              </div>
              <div className="flex rounded-lg bg-gray-100 p-0.5" role="group" aria-label="Outfit selection mode">
                <button
                  onClick={() => { setMode('outfit'); setSelectedWearableItemIds([]); }}
                  aria-pressed={mode === 'outfit'}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${mode === 'outfit' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  Saved
                </button>
                <button
                  onClick={() => { setMode('items'); setSelectedOutfitId(null); }}
                  aria-pressed={mode === 'items'}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${mode === 'items' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
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

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Style Prompt <span className="text-sm font-normal text-gray-500">(optional)</span></h2>
            <StylePromptInput value={prompt} onChange={setPrompt} />
          </div>

          <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4 sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Step 3</p>
                <h2 className="mt-1 text-lg font-semibold text-gray-900">Create your preview</h2>
              </div>
              <CreditDisplay />
            </div>
            <div className="space-y-3">
              <TryOnButton
                onGenerate={handleGenerate}
                disabled={!canGenerate}
                isLoading={isStarting || isPolling}
                credits={credits}
              />
              {!selectedBasePhotoId && (
                <p className="text-xs text-gray-600 text-center">Select a base photo to start</p>
              )}
              {selectedBasePhotoId && !hasItems && (
                <p className="text-xs text-gray-600 text-center">
                  {mode === 'outfit' ? 'Select an outfit' : 'Select at least one wearable item'}
                </p>
              )}
              {selectedBasePhotoId && hasItems && credits === 0 && (
                <p className="text-xs text-red-500 text-center">Out of daily credits. Credits reset at midnight.</p>
              )}
              {errorMessage && (
                <p role="alert" className="text-sm text-red-700 text-center">{errorMessage}</p>
              )}
            </div>
          </div>
        </div>

        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6" aria-labelledby="mirror-result-heading">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Step 4</p>
          <h2 id="mirror-result-heading" className="mb-4 mt-1 text-lg font-semibold text-gray-900">Your try-on result</h2>
          <ResultArea
            vtoId={vtoId}
            result={result}
            onRetry={handleGenerate}
            onRate={() => {}}
            currentRating={result?.image_key ? null : null}
          />
        </section>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">History</h2>
          <VtoHistorySection onReuseOutfit={handleReuseOutfit} />
        </div>
      </div>
    </MirrorErrorBoundary>
  );
}
