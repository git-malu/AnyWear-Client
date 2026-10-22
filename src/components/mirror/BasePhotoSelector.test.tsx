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
  const setDefault = vi.fn();
  const deletePhoto = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
    vi.mocked(useGetVtoBasePhotos).mockReturnValue({ data: [], isLoading: false } as any);
    vi.mocked(usePostVtoBasePhotosUploadUrl).mockReturnValue({ mutateAsync: reservePhotoUpload } as any);
    vi.mocked(usePostVtoBasePhotosUpload).mockReturnValue({ mutateAsync: vi.fn() } as any);
    vi.mocked(usePatchVtoBasePhotosId).mockReturnValue({ mutate: setDefault } as any);
    vi.mocked(useDeleteVtoBasePhotosId).mockReturnValue({ mutate: deletePhoto } as any);
  });

  function renderSelector(photos: unknown[]) {
    vi.mocked(useGetVtoBasePhotos).mockReturnValue({ data: photos, isLoading: false } as any);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={queryClient}>
        <BasePhotoSelector selectedPhotoId={null} onSelect={() => {}} />
      </QueryClientProvider>,
    );
  }

  const ownPhoto = {
    id: 'photo-own',
    userId: 'user-1',
    imageKey: 'https://signed.example.com/own.jpg',
    isDefault: true,
    source: 'user',
    createdAt: '2026-06-01T00:00:00.000Z',
    thumbnailUrl: null,
  };
  const systemPhoto = {
    id: 'photo-system',
    userId: null,
    imageKey: 'https://signed.example.com/system.jpg',
    isDefault: false,
    source: 'system',
    createdAt: '2026-05-01T00:00:00.000Z',
    thumbnailUrl: null,
  };

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

  it('renders the effective default across own and system photos', () => {
    renderSelector([ownPhoto, systemPhoto]);

    expect(screen.getAllByText(/Default photo/).length).toBeGreaterThan(0);
    expect(screen.getByText(/System photo/)).toBeInTheDocument();
    // The shared system photo cannot be deleted; an own photo can.
    expect(screen.queryByRole('button', { name: 'Delete this base photo' })).toBeInTheDocument();
    const articles = screen.getAllByRole('article');
    const systemArticle = articles.find((article) => article.textContent?.includes('System photo'));
    expect(systemArticle?.querySelector('button[aria-label="Delete this base photo"]')).toBeNull();
  });

  it('renders the system photo as the effective default when the caller points at it', () => {
    renderSelector([{ ...ownPhoto, isDefault: false }, { ...systemPhoto, isDefault: true }]);

    const articles = screen.getAllByRole('article');
    const systemArticle = articles.find((article) => article.textContent?.includes('Default photo'));
    expect(systemArticle).toBeDefined();
    expect(screen.getAllByText(/Default photo/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/^System photo/)).toBeNull();
    expect(systemArticle?.querySelector('button[aria-label="Delete this base photo"]')).toBeNull();
  });

  it('moves the default pointer to a system photo through PATCH', () => {
    renderSelector([{ ...ownPhoto, isDefault: false }, systemPhoto]);

    const articles = screen.getAllByRole('article');
    const systemArticle = articles.find((article) => article.textContent?.includes('System photo'));
    const setDefaultButton = systemArticle?.querySelector<HTMLButtonElement>('button[aria-label="Set this photo as default"]');
    expect(setDefaultButton).not.toBeNull();

    fireEvent.click(setDefaultButton!);

    expect(setDefault).toHaveBeenCalledWith(
      { id: 'photo-system', data: { is_default: true } },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });
});
