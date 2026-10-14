// @vitest-environment jsdom
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import WardrobePage from './WardrobePage';

const SIGNED = 'https://anywear-beta.s3.amazonaws.com/wardrobe/coat.jpg?X-Amz-Signature=signed';

vi.mock('../../api/endpoints/wardrobe/wardrobe', () => ({
  useGetWardrobe: vi.fn(),
  useGetWardrobeCategories: vi.fn(),
  useDeleteWardrobeItemsId: vi.fn(),
}));

vi.mock('../../api/endpoints/outfits/outfits', () => ({
  useGetOutfits: vi.fn(),
}));

vi.mock('../../components/CachedImage', () => ({
  default: ({ src, cacheKey, alt, className, ...rest }: any) => (
    <img src={src} alt={alt} className={className} data-cache-key={cacheKey} {...rest} />
  ),
}));

vi.mock('./AddItemModal', () => ({ default: () => null }));
vi.mock('./CreateOutfitModal', () => ({ default: () => null }));
vi.mock('./ItemDetailsModal', () => ({ default: () => null }));
vi.mock('../../lib/sse', () => ({ connectSse: () => ({ close: () => {} }) }));

import { useGetOutfits } from '../../api/endpoints/outfits/outfits';
import {
  useGetWardrobe,
  useGetWardrobeCategories,
  useDeleteWardrobeItemsId,
} from '../../api/endpoints/wardrobe/wardrobe';

function outfitResponse(wearableItems: unknown[]) {
  return {
    outfits: [
      {
        id: 'outfit-1',
        name: 'Rainy Day',
        userId: 'user-1',
        createdAt: '2026-05-05T00:00:00.000Z',
        wearableItems,
      },
    ],
  };
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <WardrobePage />
    </QueryClientProvider>,
  );
}

describe('WardrobePage saved outfit cards', () => {
  beforeEach(() => {
    cleanup();
    vi.mocked(useGetWardrobe).mockReturnValue({ data: [], isLoading: false } as any);
    vi.mocked(useGetWardrobeCategories).mockReturnValue({ data: { categories: [] } } as any);
    vi.mocked(useDeleteWardrobeItemsId).mockReturnValue({ mutate: vi.fn() } as any);
    vi.mocked(useGetOutfits).mockReturnValue({ data: outfitResponse([]), isLoading: false } as any);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders the primary thumbnail from the first nested item with an image', () => {
    vi.mocked(useGetOutfits).mockReturnValue({
      data: outfitResponse([
        { id: 'item-1', name: 'Coat', category: 'Outerwear', imageKeys: [{ key: SIGNED, isPrimary: true }] },
        { id: 'item-2', name: 'Scarf', category: 'Accessory', imageKeys: null },
      ]),
      isLoading: false,
    } as any);

    renderPage();

    const image = screen.getByTestId('outfit-thumbnail-outfit-1');
    expect(image).toHaveAttribute('src', SIGNED);
    expect(image).toHaveAttribute('alt', 'Rainy Day');
    expect(image).toHaveAttribute('data-cache-key', 'outfit-outfit-1-item-1');
  });

  it('keeps the intentional "No image" state for empty outfits and raw storage keys', () => {
    vi.mocked(useGetOutfits).mockReturnValue({
      data: outfitResponse([
        { id: 'item-1', name: 'Coat', category: 'Outerwear', imageKeys: [{ key: 'wardrobe/raw-key.jpg', isPrimary: true }] },
      ]),
      isLoading: false,
    } as any);

    renderPage();

    expect(screen.queryByTestId('outfit-thumbnail-outfit-1')).toBeNull();
    expect(screen.getByText('No image')).toBeInTheDocument();
    expect(document.querySelector('img[src*="wardrobe/raw-key.jpg"]')).toBeNull();
  });
});
