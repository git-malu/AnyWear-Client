import { useState, useEffect } from 'react';
import { usePatchWardrobeId, useDeleteWardrobeId, usePostWardrobeItemIdRetag } from '../../api/endpoints/wardrobe/wardrobe';
import { GetWardrobe200Item } from '../../api/model/getWardrobe200Item';
import CachedImage from '../../components/CachedImage';

interface Props {
  item: GetWardrobe200Item | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface StyleAttributeFields {
  color: string;
  material: string;
  design: string;
  fit: string;
  pattern: string;
  neckline: string;
  sleeveLength: string;
  pockets: string;
  hemline: string;
  vibe: string;
  brand: string;
}

function parseStyleAttributes(raw: unknown): StyleAttributeFields {
  const defaults: StyleAttributeFields = { color: '', material: '', design: '', fit: '', pattern: '', neckline: '', sleeveLength: '', pockets: '', hemline: '', vibe: '', brand: '' };
  if (!raw) return defaults;
  try {
    const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (typeof obj !== 'object' || !obj) return defaults;
    return {
      color: String(obj.color ?? ''), material: String(obj.material ?? ''), design: String(obj.design ?? ''),
      fit: String(obj.fit ?? ''), pattern: String(obj.pattern ?? ''), neckline: String(obj.neckline ?? ''),
      sleeveLength: String(obj.sleeveLength ?? ''), pockets: String(obj.pockets ?? ''), hemline: String(obj.hemline ?? ''),
      vibe: String(obj.vibe ?? ''), brand: String(obj.brand ?? ''),
    };
  } catch {
    return defaults;
  }
}

function parseWeatherTags(raw: unknown): string[] {
  if (!raw) return [];
  try {
    const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(arr) ? arr.filter((t: unknown) => typeof t === 'string') : [];
  } catch {
    return [];
  }
}

const ATTRIBUTE_FIELDS: { key: keyof StyleAttributeFields; label: string; placeholder: string }[] = [
  { key: 'color', label: 'Color', placeholder: 'e.g. Black, White' },
  { key: 'material', label: 'Material', placeholder: 'e.g. Cotton' },
  { key: 'design', label: 'Design', placeholder: 'e.g. Short-sleeve Pullover' },
  { key: 'fit', label: 'Fit', placeholder: 'e.g. Slim, Regular, Oversized' },
  { key: 'pattern', label: 'Pattern', placeholder: 'e.g. Solid, Striped, Floral' },
  { key: 'neckline', label: 'Neckline', placeholder: 'e.g. Crew Neck, V-Neck' },
  { key: 'sleeveLength', label: 'Sleeve Length', placeholder: 'e.g. Short, Long' },
  { key: 'pockets', label: 'Pockets', placeholder: 'e.g. No Pockets, Side Pockets' },
  { key: 'hemline', label: 'Hemline', placeholder: 'e.g. Straight' },
  { key: 'vibe', label: 'Vibe', placeholder: 'e.g. Casual, Formal' },
  { key: 'brand', label: 'Brand', placeholder: 'e.g. Nike' },
];

export default function ItemDetailsModal({ item, isOpen, onClose, onSuccess }: Props) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [attrs, setAttrs] = useState<StyleAttributeFields>({ color: '', material: '', design: '', fit: '', pattern: '', neckline: '', sleeveLength: '', pockets: '', hemline: '', vibe: '', brand: '' });
  const [weatherTagsInput, setWeatherTagsInput] = useState('');

  const { mutateAsync: updateItem, isPending: isUpdating } = usePatchWardrobeId();
  const { mutateAsync: deleteItem, isPending: isDeleting } = useDeleteWardrobeId();
  const { mutateAsync: retagItem, isPending: isRetagging } = usePostWardrobeItemIdRetag();

  useEffect(() => {
    if (item) {
      setName(item.name || '');
      setCategory(item.category || '');
      setAttrs(parseStyleAttributes(item.styleAttributes));
      setWeatherTagsInput(parseWeatherTags(item.weatherTags).join(', '));
    }
  }, [item]);

  if (!isOpen || !item) return null;

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item.id) return;

    const tags = weatherTagsInput.split(',').map((t) => t.trim()).filter(Boolean);
    const styleAttributes: Record<string, string> = {};
    for (const [k, v] of Object.entries(attrs)) {
      if (v) styleAttributes[k] = v;
    }

    try {
      await updateItem({
        id: item.id,
        data: {
          name: name || undefined,
          category: category || undefined,
          styleAttributes: Object.keys(styleAttributes).length > 0 ? styleAttributes : undefined,
          weatherTags: tags.length > 0 ? tags : undefined,
        },
      });
      onSuccess();
    } catch (error) {
      console.error('Failed to update item:', error);
      alert('Failed to update item');
    }
  };

  const handleDelete = async () => {
    if (!item.id || !window.confirm('Are you sure you want to delete this item?')) return;
    try {
      await deleteItem({ id: item.id });
      onSuccess();
    } catch (error) {
      console.error('Failed to delete item:', error);
      alert('Failed to delete item');
    }
  };

  const handleRetag = async () => {
    if (!item.id) return;
    try {
      await retagItem({ itemId: item.id });
      alert('Re-tagging started. Check back shortly.');
      onSuccess();
    } catch (error) {
      console.error('Failed to re-tag item:', error);
      alert('Failed to start re-tagging');
    }
  };

  const isProcessing = item.taggingStatus === 'processing' || item.taggingStatus === 'uploading';

  return (
    <div className="fixed inset-0 z-10 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={onClose} />

        <div className="relative inline-block px-4 pt-5 pb-4 overflow-hidden text-left align-bottom transition-all transform bg-white rounded-lg shadow-xl sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
          <div className="absolute top-0 right-0 pt-4 pr-4">
            <button onClick={onClose} className="text-gray-400 bg-white rounded-md hover:text-gray-500 focus:outline-none">
              <span className="sr-only">Close</span>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="sm:flex sm:items-start">
            <div className="w-full mt-3 text-center sm:mt-0 sm:text-left">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium leading-6 text-gray-900">Item Details</h3>
                {item.taggingStatus === 'failed' && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    Tagging Failed
                  </span>
                )}
                {isProcessing && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                    Analyzing...
                  </span>
                )}
              </div>

              <div className="mt-4 flex justify-center">
                {item.originalImageUrl ? (
                  <CachedImage src={item.originalImageUrl} cacheKey={item.id} alt="Item" className="max-h-64 object-contain rounded-md" />
                ) : (
                  <div className="flex items-center justify-center h-48 w-full bg-gray-100 text-gray-400 rounded-md">
                    No Image
                  </div>
                )}
              </div>

              <form onSubmit={handleUpdate} className="mt-6 space-y-3 max-h-[50vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700">Name</label>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. My favorite hoodie"
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-1.5 px-2 text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700">Category *</label>
                    <input type="text" value={category} onChange={(e) => setCategory(e.target.value)}
                      placeholder="e.g. Top"
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-1.5 px-2 text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
                  </div>
                </div>

                {ATTRIBUTE_FIELDS.map(({ key, label, placeholder }) => (
                  <div key={key}>
                    <label className="block text-xs font-medium text-gray-700">
                      {label}{key === 'color' || key === 'material' ? ' *' : ''}
                    </label>
                    <input type="text" value={attrs[key]} onChange={(e) => setAttrs((prev) => ({ ...prev, [key]: e.target.value }))}
                      placeholder={placeholder}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-1.5 px-2 text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
                  </div>
                ))}

                <div>
                  <label className="block text-xs font-medium text-gray-700">Weather Tags</label>
                  <input type="text" value={weatherTagsInput}
                    onChange={(e) => setWeatherTagsInput(e.target.value)}
                    placeholder="e.g. Cold, Windy, Warm"
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-1.5 px-2 text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
                  <p className="mt-0.5 text-xs text-gray-400">Comma-separated</p>
                </div>

                <div className="flex flex-wrap gap-2 pt-3 border-t">
                  <button type="submit" disabled={isUpdating || isProcessing}
                    className="inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none disabled:opacity-50">
                    {isUpdating ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button type="button" disabled={isRetagging || isProcessing}
                    onClick={handleRetag}
                    className="inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none disabled:opacity-50">
                    {isRetagging ? 'Re-tagging...' : 'Re-tag'}
                  </button>
                  <button type="button" disabled={isDeleting}
                    onClick={handleDelete}
                    className="inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-sm font-medium text-white hover:bg-red-700 focus:outline-none disabled:opacity-50">
                    {isDeleting ? 'Deleting...' : 'Delete'}
                  </button>
                  <button type="button" onClick={onClose}
                    className="inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
