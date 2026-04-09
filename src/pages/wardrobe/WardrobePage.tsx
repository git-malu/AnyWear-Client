import { useState } from 'react';
import { useGetWardrobe, useDeleteWardrobeId } from '../../api/endpoints/wardrobe/wardrobe';
import AddItemModal from './AddItemModal';
import ItemDetailsModal from './ItemDetailsModal';
import CachedImage from '../../components/CachedImage';
import { GetWardrobe200Item } from '../../api/model/getWardrobe200Item';

export default function WardrobePage() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<GetWardrobe200Item | null>(null);
  const { data: wardrobeResponse, isLoading, refetch } = useGetWardrobe();
  const { mutate: deleteItem } = useDeleteWardrobeId();

  const wardrobeData = Array.isArray(wardrobeResponse) ? wardrobeResponse : (wardrobeResponse as any)?.data && Array.isArray((wardrobeResponse as any).data) ? (wardrobeResponse as any).data : [];

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

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Wardrobe</h1>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Add Item
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-12">Loading...</div>
      ) : wardrobeData.length === 0 ? (
        <div className="text-center py-12 bg-white shadow sm:rounded-lg">
          <p className="text-gray-500">Your wardrobe is empty.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {(wardrobeData as GetWardrobe200Item[]).map((item) => (
            <div 
              key={item.id} 
              className="relative group bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setSelectedItem(item)}
            >
              <div className="aspect-w-3 aspect-h-4 bg-gray-200">
                {item.originalImageUrl ? (
                  <CachedImage src={item.originalImageUrl} cacheKey={item.id} alt={item.category || 'Wardrobe item'} className="object-cover" />
                ) : (
                  <div className="flex items-center justify-center h-48 w-full bg-gray-100 text-gray-400">
                    No Image
                  </div>
                )}
              </div>
              <div className="p-3">
                <h3 className="text-sm font-medium text-gray-900">{item.category || 'Uncategorized'}</h3>
                <p className="text-xs text-gray-500 capitalize">{item.color} • {item.material}</p>
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
          ))}
        </div>
      )}

      {isAddModalOpen && (
        <AddItemModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onSuccess={() => {
            setIsAddModalOpen(false);
            refetch();
          }}
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
