import { useState, useRef } from 'react';
import { useGetVtoBasePhotos, usePostVtoBasePhotos, usePatchVtoBasePhotosId, useDeleteVtoBasePhotosId } from '../../api/endpoints/vto/vto';
import CachedImage from '../CachedImage';
import { useQueryClient } from '@tanstack/react-query';
import { uploadImageToPresignedUrl, validateImageFile } from '../../lib/imageUpload';
import { getStringProperty } from '../../lib/errors';

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
  const { mutateAsync: uploadPhoto } = usePostVtoBasePhotos();
  const { mutate: setDefault } = usePatchVtoBasePhotosId();
  const { mutate: deletePhoto } = useDeleteVtoBasePhotosId();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);
    try {
      validateImageFile(file);

      const ext = file.name.split('.').pop() || 'jpg';
      const uploadResult = await uploadPhoto({
        data: { contentType: file.type || 'image/jpeg', extension: ext },
      });

      const presignedUrl = getStringProperty(uploadResult, 'uploadUrl');
      const photoId = uploadResult.id;

      if (!presignedUrl) throw new Error('Failed to get upload URL');
      await uploadImageToPresignedUrl(presignedUrl, file);

      queryClient.invalidateQueries({ queryKey: ['/vto/base-photos'] as const });
      if (!selectedPhotoId && photoId) {
        onSelect(photoId);
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
          accept="image/*"
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
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {photoList.map((photo) => (
            <div
              key={photo.id}
              className={`relative group rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${
                selectedPhotoId === photo.id
                  ? 'border-indigo-500 ring-2 ring-indigo-500'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => onSelect(photo.id)}
            >
              <CachedImage
                src={photo.thumbnailUrl || photo.imageKey}
                cacheKey={`vto-base-${photo.id}`}
                alt="Base photo"
                className="w-full aspect-[3/4] object-cover"
              />
              {photo.isDefault && (
                <span className="absolute top-1.5 left-1.5 bg-indigo-600 text-white text-xs px-1.5 py-0.5 rounded font-medium">
                  ★ Default
                </span>
              )}
              <div className="absolute inset-x-0 bottom-0 p-1.5 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 justify-center">
                {!photo.isDefault && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleSetDefault(photo.id); }}
                    className="text-xs bg-white/90 text-gray-800 px-2 py-0.5 rounded hover:bg-white"
                  >
                    Set Default
                  </button>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(photo.id); }}
                  className="text-xs bg-red-600 text-white px-2 py-0.5 rounded hover:bg-red-700"
                >
                  <svg className="w-3 h-3 inline mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
