const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
const IMAGE_FILE_EXTENSION = /\.(?:jpe?g|png|webp|heic|heif)$/i;

/** The signed S3 POST policy the service issues for one upload. */
export interface SignedUploadPost {
  url: string;
  fields: Record<string, string>;
}

/**
 * Feedback only. The limits that matter are enforced by the service and by the
 * signed upload policy: a body larger than the policy's range, or of a
 * different content type, is refused by S3 whatever this browser does.
 */
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

/**
 * The content type to reserve.
 *
 * The service only accepts its allow-listed types and derives the object
 * extension from the declared type, so a camera file with an empty MIME type has
 * to be named from its extension rather than defaulted to JPEG — otherwise the
 * bytes and the declared type would disagree and the confirmation would refuse
 * the upload.
 */
export function resolveImageContentType(file: File): string {
  if (file.type) return file.type;
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'heic') return 'image/heic';
  if (extension === 'heif') return 'image/heif';
  return 'image/jpeg';
}

/**
 * Upload the file through the signed POST policy.
 *
 * The policy's fields must be sent verbatim and the file part must come last;
 * S3 rejects a form that omits or alters a signed field, a body outside the
 * policy's size range, and a part whose content type differs from the signed
 * one. There is no client-side call that can relax those conditions.
 */
export async function uploadImageWithSignedPost(upload: SignedUploadPost, file: File): Promise<void> {
  const form = new FormData();
  for (const [name, value] of Object.entries(upload.fields)) {
    form.append(name, value);
  }
  form.append('file', file);

  const response = await fetch(upload.url, { method: 'POST', body: form });

  if (!response.ok) {
    throw new Error(`Image upload failed with HTTP ${response.status}`);
  }
}
