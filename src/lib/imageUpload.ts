const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
const IMAGE_FILE_EXTENSION = /\.(?:jpe?g|png|webp|heic|heif)$/i;

export function validateImageFile(file: File): void {
  const hasImageType = file.type.startsWith('image/');
  const hasImageExtension = IMAGE_FILE_EXTENSION.test(file.name);
  if (!hasImageType && !(!file.type && hasImageExtension)) {
    throw new Error('Select an image file');
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    throw new Error('Image must be 10MB or smaller');
  }
}

export async function uploadImageToPresignedUrl(url: string, file: File): Promise<void> {
  const response = await fetch(url, {
    method: 'PUT',
    body: file,
    headers: {
      'Content-Type': file.type || 'image/jpeg',
    },
  });

  if (!response.ok) {
    throw new Error(`Image upload failed with HTTP ${response.status}`);
  }
}
