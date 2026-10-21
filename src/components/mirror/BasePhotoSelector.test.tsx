// @vitest-environment jsdom
import { vi, describe, it, expect, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../../api/endpoints/vto/vto', () => ({
  useGetVtoBasePhotos: vi.fn(),
  usePostVtoBasePhotosUploadUrl: vi.fn(),
  usePostVtoBasePhotosUpload: vi.fn(),
  usePatchVtoBasePhotosId: vi.fn(),
  useDeleteVtoBasePhotosId: vi.fn(),
}));

vi.mock('../../components/CachedImage', () => ({
  default: ({ src, cacheKey, alt, className, ...rest }: any) => (
    <img src={src} alt={alt} className={className} data-cache-key={cacheKey} {...rest} />
  ),
}));

import BasePhotoSelector from './BasePhotoSelector';
import { HEIC_UNSUPPORTED_MESSAGE } from '../../lib/imageUpload';
import {
  useDeleteVtoBasePhotosId,
  useGetVtoBasePhotos,
  usePatchVtoBasePhotosId,
  usePostVtoBasePhotosUpload,
  usePostVtoBasePhotosUploadUrl,
} from '../../api/endpoints/vto/vto';

describe('BasePhotoSelector', () => {
  const reservePhotoUpload = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
    vi.mocked(useGetVtoBasePhotos).mockReturnValue({ data: [], isLoading: false } as any);
    vi.mocked(usePostVtoBasePhotosUploadUrl).mockReturnValue({ mutateAsync: reservePhotoUpload } as any);
    vi.mocked(usePostVtoBasePhotosUpload).mockReturnValue({ mutateAsync: vi.fn() } as any);
    vi.mocked(usePatchVtoBasePhotosId).mockReturnValue({ mutate: vi.fn() } as any);
    vi.mocked(useDeleteVtoBasePhotosId).mockReturnValue({ mutate: vi.fn() } as any);
  });

  it('narrows the picker and reports the HEIC guidance in an alert before reserving', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <BasePhotoSelector selectedPhotoId={null} onSelect={() => {}} />
      </QueryClientProvider>,
    );

    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input).not.toBeNull();
    expect(input).toHaveAttribute('accept', 'image/jpeg,image/png,image/webp');

    // The browser omits the MIME type, so only the filename identifies the format.
    fireEvent.change(input!, { target: { files: [new File(['x'], 'photo.heic')] } });

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(HEIC_UNSUPPORTED_MESSAGE);
    expect(reservePhotoUpload).not.toHaveBeenCalled();
  });
});
