import { useState, useRef } from 'react';
import {
  useGetVtoBasePhotos,
  usePostVtoBasePhotosUpload,
  usePostVtoBasePhotosUploadUrl,
  usePatchVtoBasePhotosId,
  useDeleteVtoBasePhotosId,
} from '../../api/endpoints/vto/vto';
import CachedImage from '../CachedImage';
import { useQueryClient } from '@tanstack/react-query';
import { resolveImageContentType, uploadImageWithSignedPost, validateImageFile } from '../../lib/imageUpload';

interface BasePhotoSelectorProps {
  selectedPhotoId: string | null;
  onSelect: (id: string) => void;
}

export default function BasePhotoSelector({ selectedPhotoId, onSelect }: BasePhotoSelectorProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const { data: photos, isLoading } = useGetVtoBasePhotos();
  const { mutateAsync: reservePhotoUpload } = usePostVtoBasePhotosUploadUrl();
  const { mutateAsync: confirmPhotoUpload } = usePostVtoBasePhotosUpload();
  const { mutate: setDefault } = usePatchVtoBasePhotosId();
  const { mutate: deletePhoto } = useDeleteVtoBasePhotosId();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);
    try {
      validateImageFile(file);

      // Reserve, upload through the signed policy, then confirm. The photo only
      // exists after the confirmation has read the stored object, so it cannot
      // appear in the list before its bytes are there.
      const reservation = await reservePhotoUpload({
        data: { contentType: resolveImageContentType(file) },
      });

      if (!reservation.upload?.url) throw new Error('Failed to reserve the upload');
      await uploadImageWithSignedPost(reservation.upload, file);

      const photo = await confirmPhotoUpload({
        data: { reservationId: reservation.reservationId },
      });

      queryClient.invalidateQueries({ queryKey: ['/vto/base-photos'] as const });
      if (!selectedPhotoId && photo.id) {
        onSelect(photo.id);
      }
    } catch (err) {
      console.error('Failed to upload base photo:', err);
      setUploadError(err instanceof Error ? err.message : 'Failed to upload base photo');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSetDefault = (id: string) => {
    setDefault({ id, data: { is_default: true } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['/vto/base-photos'] as const });
      },
    });
  };

  const handleDelete = (id: string) => {
    if (!window.confirm('Remove this base photo?')) return;
    deletePhoto({ id }, {
      onSuccess: () => {
        if (selectedPhotoId === id) onSelect('');
        queryClient.invalidateQueries({ queryKey: ['/vto/base-photos'] as const });
      },
    });
  };

  const photoList = Array.isArray(photos) ? photos : [];

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse bg-gray-200 rounded-lg aspect-[3/4]" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500 disabled:opacity-50"
        >
          <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {isUploading ? 'Uploading...' : 'Upload'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleFileChange}
        />
        {photoList.length > 0 && (
          <span className="text-xs text-gray-500">{photoList.length} photo{photoList.length !== 1 ? 's' : ''}</span>
        )}
      </div>
      {uploadError && (
        <p className="mb-3 text-sm text-red-600" role="alert">{uploadError}</p>
      )}

      {photoList.length === 0 ? (
        <div className="bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 p-6 text-center">
          <svg className="mx-auto h-10 w-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="mt-2 text-sm text-gray-500">Upload your first mannequin photo to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photoList.map((photo, index) => (
            <article
              key={photo.id}
              className={`relative group overflow-hidden rounded-xl border transition-colors ${
                selectedPhotoId === photo.id
                  ? 'border-indigo-600 ring-1 ring-indigo-600'
                  : 'border-gray-200 hover:border-gray-400'
              }`}
            >
              <button type="button" aria-pressed={selectedPhotoId === photo.id} aria-label={`${selectedPhotoId === photo.id ? 'Selected' : 'Select'} base photo ${index + 1}${photo.isDefault ? ', default' : ''}`} onClick={() => onSelect(photo.id)} className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-600">
                <CachedImage
                  src={photo.thumbnailUrl || photo.imageKey}
                  cacheKey={`vto-base-${photo.id}`}
                  alt=""
                  className="aspect-[4/5] w-full object-cover"
                />
                <span className="absolute left-2 top-2 rounded-full bg-white/95 px-2 py-1 text-xs font-medium text-gray-800 shadow-sm">
                  {photo.isDefault ? 'Default photo' : 'Base photo'}{selectedPhotoId === photo.id ? ' · Selected' : ''}
                </span>
              </button>
              {photo.isDefault && (
                <span className="sr-only">Default photo</span>
              )}
              <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                {!photo.isDefault && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleSetDefault(photo.id); }}
                    aria-label="Set this photo as default"
                    className="rounded bg-white px-2 py-1 text-xs text-gray-800 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
                  >
                    Set Default
                  </button>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(photo.id); }}
                    aria-label="Delete this base photo"
                    className="rounded bg-red-700 px-2 py-1 text-xs text-white hover:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <svg className="w-3 h-3 inline mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
