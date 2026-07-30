import { afterEach, describe, expect, it, vi } from 'vitest';
import { uploadImageToPresignedUrl, validateImageFile } from './imageUpload';

describe('imageUpload', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects non-image and oversized files before upload', () => {
    expect(() => validateImageFile(new File(['text'], 'notes.txt', { type: 'text/plain' })))
      .toThrow('Select an image file');

    const oversized = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'large.jpg', {
      type: 'image/jpeg',
    });
    expect(() => validateImageFile(oversized)).toThrow('Image must be 10MB or smaller');
  });

  it('accepts camera images when the browser omits the MIME type', () => {
    expect(() => validateImageFile(new File(['image'], 'camera.heic'))).not.toThrow();
  });

  it('throws when S3 returns an HTTP error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 403 })));
    const file = new File(['image'], 'photo.jpg', { type: 'image/jpeg' });

    await expect(uploadImageToPresignedUrl('https://upload.example.com', file))
      .rejects.toThrow('Image upload failed with HTTP 403');
  });

  it('uploads the file with its content type', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const file = new File(['image'], 'photo.png', { type: 'image/png' });

    await uploadImageToPresignedUrl('https://upload.example.com', file);

    expect(fetchMock).toHaveBeenCalledWith('https://upload.example.com', {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': 'image/png' },
    });
  });
});
