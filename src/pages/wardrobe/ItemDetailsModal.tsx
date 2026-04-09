import { useState, useEffect } from 'react';
import { usePatchWardrobeId, useDeleteWardrobeId } from '../../api/endpoints/wardrobe/wardrobe';
import { GetWardrobe200Item } from '../../api/model/getWardrobe200Item';
import CachedImage from '../../components/CachedImage';

interface Props {
  item: GetWardrobe200Item | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ItemDetailsModal({ item, isOpen, onClose, onSuccess }: Props) {
  const [category, setCategory] = useState('');
  const [color, setColor] = useState('');
  const [material, setMaterial] = useState('');
  
  const { mutateAsync: updateItem, isPending: isUpdating } = usePatchWardrobeId();
  const { mutateAsync: deleteItem, isPending: isDeleting } = useDeleteWardrobeId();

  useEffect(() => {
    if (item) {
      setCategory(item.category || '');
      setColor(item.color || '');
      setMaterial(item.material || '');
    }
  }, [item]);

  if (!isOpen || !item) return null;

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item.id) return;
    
    try {
      await updateItem({
        id: item.id,
        data: {
          category,
          color,
          material,
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

  return (
    <div className="fixed inset-0 z-10 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={onClose} />

        <div className="relative inline-block px-4 pt-5 pb-4 overflow-hidden text-left align-bottom transition-all transform bg-white rounded-lg shadow-xl sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
          <div className="absolute top-0 right-0 pt-4 pr-4">
            <button
              onClick={onClose}
              className="text-gray-400 bg-white rounded-md hover:text-gray-500 focus:outline-none"
            >
              <span className="sr-only">Close</span>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="sm:flex sm:items-start">
            <div className="w-full mt-3 text-center sm:mt-0 sm:text-left">
              <h3 className="text-lg font-medium leading-6 text-gray-900">Edit Wardrobe Item</h3>
              
              <div className="mt-4 flex justify-center">
                {item.originalImageUrl ? (
                  <CachedImage src={item.originalImageUrl} cacheKey={item.id} alt="Item" className="max-h-64 object-contain rounded-md" />
                ) : (
                  <div className="flex items-center justify-center h-48 w-full bg-gray-100 text-gray-400">
                    No Image
                  </div>
                )}
              </div>
              
              <form onSubmit={handleUpdate} className="mt-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Category</label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Color</label>
                  <input
                    type="text"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Material</label>
                  <input
                    type="text"
                    value={material}
                    onChange={(e) => setMaterial(e.target.value)}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>

                <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                  <button
                    type="submit"
                    disabled={isUpdating}
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                  >
                    {isUpdating ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={handleDelete}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                  >
                    {isDeleting ? 'Deleting...' : 'Delete Item'}
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm"
                  >
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
