// @vitest-environment jsdom
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../../api/endpoints/vto/vto', () => ({
  useGetVtoBasePhotos: vi.fn(),
  usePostVtoBasePhotosUploadUrl: vi.fn(),
  usePostVtoBasePhotosUpload: vi.fn(),
  usePatchVtoBasePhotosId: vi.fn(),
  useDeleteVtoBasePhotosId: vi.fn(),
}));

vi.mock('../../api/endpoints/users/users', () => ({
  useGetUsersMe: vi.fn(),
}));

vi.mock('../../hooks/useVtoGeneration', () => ({ default: vi.fn() }));

vi.mock('../../components/mirror/WearableItemMultiSelector', () => ({
  default: ({ onSelectionChange }: { onSelectionChange: (ids: string[]) => void }) => (
    <button type="button" onClick={() => onSelectionChange(['item-1'])}>Select a wearable item</button>
  ),
}));

vi.mock('../../components/mirror/VtoHistorySection', () => ({ default: () => null }));
vi.mock('../../components/mirror/CreditDisplay', () => ({ default: () => <span>5/10 today</span> }));

vi.mock('../../lib/imageUpload', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/imageUpload')>();
  return { ...actual, uploadImageWithSignedPost: vi.fn() };
});

vi.mock('../../components/CachedImage', () => ({
  default: ({ src, cacheKey, alt, className, ...rest }: any) => (
    <img src={src} alt={alt} className={className} data-cache-key={cacheKey} {...rest} />
  ),
}));

import MirrorPage from './MirrorPage';
import {
  useDeleteVtoBasePhotosId,
  useGetVtoBasePhotos,
  usePatchVtoBasePhotosId,
  usePostVtoBasePhotosUpload,
  usePostVtoBasePhotosUploadUrl,
} from '../../api/endpoints/vto/vto';
import { useGetUsersMe } from '../../api/endpoints/users/users';
import useVtoGeneration from '../../hooks/useVtoGeneration';
import { uploadImageWithSignedPost } from '../../lib/imageUpload';

const generate = vi.fn();
const reservePhotoUpload = vi.fn();
const confirmPhotoUpload = vi.fn();
const deletePhoto = vi.fn();

function photo(overrides: Record<string, unknown>) {
  return {
    id: 'photo-own',
    userId: 'user-1',
    imageKey: 'https://signed.example.com/own.jpg',
    isDefault: false,
    source: 'user',
    createdAt: '2026-06-01T00:00:00.000Z',
    thumbnailUrl: null,
    ...overrides,
  };
}

const ownDefaultPhoto = photo({ id: 'photo-own', isDefault: true });
const otherOwnPhoto = photo({ id: 'photo-other', imageKey: 'https://signed.example.com/other.jpg' });
const systemPhoto = photo({
  id: 'photo-system',
  userId: null,
  source: 'system',
  imageKey: 'https://signed.example.com/system.jpg',
  createdAt: '2026-05-01T00:00:00.000Z',
});
const uploadedPhoto = photo({
  id: 'photo-new',
  imageKey: 'https://signed.example.com/new.jpg',
  createdAt: '2026-06-02T00:00:00.000Z',
});

function mockPhotos(photos: unknown[], isLoading = false) {
  vi.mocked(useGetVtoBasePhotos).mockReturnValue({ data: photos, isLoading } as any);
}

describe('MirrorPage base-photo selection', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mockPhotos([]);
    vi.mocked(useGetUsersMe).mockReturnValue({ data: { dailyCredits: 5 } } as any);
    vi.mocked(useVtoGeneration).mockReturnValue({
      generate,
      result: null,
      errorMessage: null,
      isPolling: false,
      isStarting: false,
      vtoId: null,
    } as any);
    vi.mocked(usePostVtoBasePhotosUploadUrl).mockReturnValue({ mutateAsync: reservePhotoUpload } as any);
    vi.mocked(usePostVtoBasePhotosUpload).mockReturnValue({ mutateAsync: confirmPhotoUpload } as any);
    vi.mocked(usePatchVtoBasePhotosId).mockReturnValue({ mutate: vi.fn() } as any);
    vi.mocked(useDeleteVtoBasePhotosId).mockReturnValue({ mutate: deletePhoto } as any);
    vi.mocked(uploadImageWithSignedPost).mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  function renderPage() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const element = () => (
      <QueryClientProvider client={queryClient}>
        <MirrorPage />
      </QueryClientProvider>
    );
    const rendered = render(element());
    return { ...rendered, queryClient, rerenderPage: () => rendered.rerender(element()) };
  }

  async function uploadFile(container: HTMLElement) {
    reservePhotoUpload.mockResolvedValue({
      reservationId: 'reservation-1',
      upload: { url: 'https://upload.example.com', fields: { key: 'base-photos/new.jpg' } },
    });
    confirmPhotoUpload.mockResolvedValue(uploadedPhoto);
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input).not.toBeNull();
    fireEvent.change(input!, {
      target: { files: [new File(['bytes'], 'photo.jpg', { type: 'image/jpeg' })] },
    });
    await waitFor(() => expect(confirmPhotoUpload).toHaveBeenCalledTimes(1));
    // Flush the confirmed-upload continuation, which reports the photo to the
    // page and updates its selection state.
    await act(async () => {});
  }

  // Starts an upload and returns the resolver for its confirm response, so a
  // test can act while the upload is still in flight.
  function startPendingUpload(container: HTMLElement) {
    reservePhotoUpload.mockResolvedValue({
      reservationId: 'reservation-1',
      upload: { url: 'https://upload.example.com', fields: { key: 'base-photos/new.jpg' } },
    });
    let resolveConfirm!: (value: unknown) => void;
    confirmPhotoUpload.mockReturnValue(new Promise((resolve) => { resolveConfirm = resolve; }));
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input).not.toBeNull();
    fireEvent.change(input!, {
      target: { files: [new File(['bytes'], 'photo.jpg', { type: 'image/jpeg' })] },
    });
    return { resolveConfirm };
  }

  it('preselects the pointer default and generates with its id', () => {
    mockPhotos([ownDefaultPhoto, systemPhoto]);
    renderPage();

    const card = screen.getByRole('button', { name: 'Selected base photo 1, default' });
    expect(card).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText('Select a base photo to start')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Select a wearable item' }));

    const generateButton = screen.getByRole('button', { name: 'Generate try-on' });
    expect(generateButton).toBeEnabled();
    fireEvent.click(generateButton);

    expect(generate).toHaveBeenCalledWith(expect.objectContaining({
      base_photo_id: 'photo-own',
      wearable_item_ids: ['item-1'],
    }));
  });

  it('preselects the shared system photo for a caller who never chose a default', () => {
    mockPhotos([photo({ id: 'photo-own' }), { ...systemPhoto, isDefault: true }]);
    renderPage();

    const card = screen.getByRole('button', { name: 'Selected base photo 2, default, shared system photo' });
    expect(card).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText('Select a base photo to start')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Select a wearable item' }));
    fireEvent.click(screen.getByRole('button', { name: 'Generate try-on' }));

    expect(generate).toHaveBeenCalledWith(expect.objectContaining({
      base_photo_id: 'photo-system',
      wearable_item_ids: ['item-1'],
    }));
  });

  it('keeps the photo chosen during the visit when a refetch flags another photo', () => {
    mockPhotos([ownDefaultPhoto, otherOwnPhoto]);
    const { rerenderPage } = renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Select base photo 2' }));
    expect(screen.getByRole('button', { name: 'Selected base photo 2' }))
      .toHaveAttribute('aria-pressed', 'true');

    // A refetch replaces the list: the chosen photo keeps its id while its flag
    // is gone, and the default has moved to a different photo.
    mockPhotos([photo({ id: 'photo-own' }), otherOwnPhoto, { ...systemPhoto, isDefault: true }]);
    rerenderPage();

    expect(screen.getByRole('button', { name: 'Selected base photo 2' }))
      .toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Select base photo 3, default, shared system photo' }))
      .toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(screen.getByRole('button', { name: 'Select a wearable item' }));
    fireEvent.click(screen.getByRole('button', { name: 'Generate try-on' }));

    expect(generate).toHaveBeenCalledWith(expect.objectContaining({
      base_photo_id: 'photo-other',
      wearable_item_ids: ['item-1'],
    }));
  });

  it('returns to the refreshed effective default after the selected photo is deleted', () => {
    mockPhotos([ownDefaultPhoto, systemPhoto]);
    const { rerenderPage } = renderPage();
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    fireEvent.click(screen.getByRole('button', { name: 'Delete this base photo' }));
    expect(deletePhoto).toHaveBeenCalledTimes(1);
    const [variables, options] = deletePhoto.mock.calls[0];
    expect(variables).toEqual({ id: 'photo-own' });

    // The pointer was ON DELETE SET NULL: the refetch flags the system photo.
    mockPhotos([{ ...systemPhoto, isDefault: true }]);
    act(() => options.onSuccess());
    rerenderPage();

    const card = screen.getByRole('button', { name: 'Selected base photo 1, default, shared system photo' });
    expect(card).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText('Select a base photo to start')).toBeNull();
  });

  it('keeps a photo clicked while a delete is in flight', () => {
    mockPhotos([ownDefaultPhoto, otherOwnPhoto, systemPhoto]);
    const { rerenderPage } = renderPage();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    expect(screen.getByRole('button', { name: 'Selected base photo 1, default' })).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Delete this base photo' })[0]);
    expect(deletePhoto).toHaveBeenCalledTimes(1);
    const [variables, options] = deletePhoto.mock.calls[0];
    expect(variables).toEqual({ id: 'photo-own' });

    // The user clicks another card while the DELETE request is still running.
    fireEvent.click(screen.getByRole('button', { name: 'Select base photo 2' }));
    expect(screen.getByRole('button', { name: 'Selected base photo 2' }))
      .toHaveAttribute('aria-pressed', 'true');

    // The delete resolves and the refetch flags the system photo; the clicked
    // photo must stay selected instead of being cleared by the resolution.
    mockPhotos([otherOwnPhoto, { ...systemPhoto, isDefault: true }]);
    act(() => options.onSuccess());
    rerenderPage();

    expect(screen.getByRole('button', { name: 'Selected base photo 1' }))
      .toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Select base photo 2, default, shared system photo' }))
      .toHaveAttribute('aria-pressed', 'false');
  });

  it('leaves nothing selected when the list flags no default photo', () => {
    mockPhotos([photo({ id: 'photo-own' }), systemPhoto]);
    renderPage();

    expect(screen.queryByRole('button', { name: /^Selected base photo/ })).toBeNull();
    expect(screen.getByText('Select a base photo to start')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generate try-on' })).toBeDisabled();
  });

  it('suppresses the hint while the photo list is still loading', () => {
    mockPhotos([], true);
    renderPage();

    expect(screen.queryByText('Select a base photo to start')).toBeNull();
    expect(screen.queryByRole('button', { name: /^Selected base photo/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Generate try-on' })).toBeDisabled();
  });

  it('adopts an uploaded photo when the selection is default-derived', async () => {
    mockPhotos([ownDefaultPhoto]);
    const { container, rerenderPage } = renderPage();
    expect(screen.getByRole('button', { name: 'Selected base photo 1, default' })).toBeInTheDocument();

    await uploadFile(container);

    // The refetch lists the new own photo first, newest-first, without the flag.
    mockPhotos([uploadedPhoto, ownDefaultPhoto]);
    rerenderPage();

    expect(screen.getByRole('button', { name: 'Selected base photo 1' }))
      .toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Select base photo 2, default' }))
      .toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Select a wearable item' }));
    fireEvent.click(screen.getByRole('button', { name: 'Generate try-on' }));

    expect(generate).toHaveBeenCalledWith(expect.objectContaining({
      base_photo_id: 'photo-new',
      wearable_item_ids: ['item-1'],
    }));
  });

  it('does not replace a photo chosen during the visit with an upload', async () => {
    mockPhotos([ownDefaultPhoto, otherOwnPhoto]);
    const { container, rerenderPage } = renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Select base photo 2' }));
    await uploadFile(container);

    mockPhotos([uploadedPhoto, ownDefaultPhoto, otherOwnPhoto]);
    rerenderPage();

    expect(screen.getByRole('button', { name: 'Selected base photo 3' }))
      .toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Select base photo 1' }))
      .toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(screen.getByRole('button', { name: 'Select a wearable item' }));
    fireEvent.click(screen.getByRole('button', { name: 'Generate try-on' }));

    expect(generate).toHaveBeenCalledWith(expect.objectContaining({
      base_photo_id: 'photo-other',
      wearable_item_ids: ['item-1'],
    }));
  });

  it('keeps a photo clicked while an upload is in flight', async () => {
    mockPhotos([ownDefaultPhoto, otherOwnPhoto]);
    const { container, rerenderPage } = renderPage();
    expect(screen.getByRole('button', { name: 'Selected base photo 1, default' })).toBeInTheDocument();

    const { resolveConfirm } = startPendingUpload(container);
    await waitFor(() => expect(confirmPhotoUpload).toHaveBeenCalledTimes(1));

    // The user clicks another card before the confirmation resolves.
    fireEvent.click(screen.getByRole('button', { name: 'Select base photo 2' }));
    expect(screen.getByRole('button', { name: 'Selected base photo 2' }))
      .toHaveAttribute('aria-pressed', 'true');

    await act(async () => {
      resolveConfirm(uploadedPhoto);
    });
    await act(async () => {});

    // The refetch lists the confirmed photo first; the clicked photo must stay
    // selected instead of being overwritten by the upload.
    mockPhotos([uploadedPhoto, ownDefaultPhoto, otherOwnPhoto]);
    rerenderPage();

    expect(screen.getByRole('button', { name: 'Selected base photo 3' }))
      .toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Select base photo 1' }))
      .toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(screen.getByRole('button', { name: 'Select a wearable item' }));
    fireEvent.click(screen.getByRole('button', { name: 'Generate try-on' }));

    expect(generate).toHaveBeenCalledWith(expect.objectContaining({
      base_photo_id: 'photo-other',
      wearable_item_ids: ['item-1'],
    }));
  });
});
