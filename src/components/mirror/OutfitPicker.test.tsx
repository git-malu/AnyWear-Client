// @vitest-environment jsdom
import { vi, describe, it, expect, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import OutfitPicker from './OutfitPicker';

const mockOutfits = {
  outfits: [
    {
      id: 'outfit-1',
      name: 'Weekend Casual',
      userId: 'user-1',
      createdAt: '2026-05-05T00:00:00.000Z',
      wearableItems: [
        {
          id: 'item-1',
          name: 'T-Shirt',
          category: 'Top',
          imageKeys: JSON.stringify([
            { key: 'https://example.com/tshirt.jpg?X-Amz-Signature=signed', isPrimary: true },
          ]),
        },
        {
          id: 'item-2',
          name: 'Jeans',
          category: 'Bottom',
          imageKeys: null,
        },
      ],
    },
    {
      id: 'outfit-2',
      name: null,
      userId: 'user-1',
      createdAt: '2026-05-04T00:00:00.000Z',
      wearableItems: [],
    },
  ],
};

vi.mock('../../api/endpoints/outfits/outfits', () => ({
  useGetOutfits: vi.fn(),
}));

vi.mock('../CachedImage', () => ({
  default: ({ src, cacheKey, alt, className, ...rest }: any) => (
    <img src={src} alt={alt} className={className} data-cache-key={cacheKey} {...rest} />
  ),
}));

import { useGetOutfits } from '../../api/endpoints/outfits/outfits';

describe('OutfitPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it('shows loading state', () => {
    vi.mocked(useGetOutfits).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    } as any);

    render(<OutfitPicker selectedOutfitId={null} onSelect={() => {}} />);

    expect(screen.getByText('Loading outfits...')).toBeDefined();
  });

  it('shows empty state when no outfits exist', () => {
    vi.mocked(useGetOutfits).mockReturnValue({
      data: { outfits: [] },
      isLoading: false,
      isError: false,
    } as any);

    render(<OutfitPicker selectedOutfitId={null} onSelect={() => {}} />);

    expect(screen.getByText('No saved outfits yet.')).toBeDefined();
    expect(screen.getByText(/Select Items/)).toBeDefined();
  });

  it('renders outfits from API response', () => {
    vi.mocked(useGetOutfits).mockReturnValue({
      data: mockOutfits,
      isLoading: false,
      isError: false,
    } as any);

    render(<OutfitPicker selectedOutfitId={null} onSelect={() => {}} />);

    expect(screen.getByText('Weekend Casual')).toBeDefined();
    expect(screen.getByText('Untitled Outfit')).toBeDefined();
    expect(screen.getByText('2 items')).toBeDefined();
    expect(screen.getByText('0 items')).toBeDefined();
  });

  it('calls onSelect when an outfit is clicked', () => {
    const onSelect = vi.fn();
    vi.mocked(useGetOutfits).mockReturnValue({
      data: mockOutfits,
      isLoading: false,
      isError: false,
    } as any);

    render(<OutfitPicker selectedOutfitId={null} onSelect={onSelect} />);

    fireEvent.click(screen.getByText('Weekend Casual'));
    expect(onSelect).toHaveBeenCalledWith('outfit-1');
  });

  it('highlights selected outfit', () => {
    vi.mocked(useGetOutfits).mockReturnValue({
      data: mockOutfits,
      isLoading: false,
      isError: false,
    } as any);

    render(<OutfitPicker selectedOutfitId="outfit-1" onSelect={() => {}} />);

    const selectedButton = screen.getByText('Weekend Casual').closest('button');
    expect(selectedButton?.getAttribute('aria-pressed')).toBe('true');
    expect(selectedButton?.className).toContain('border-indigo-600');
  });

  it.each([
    ['JSON', JSON.stringify([{ key: 'https://example.com/other.jpg' }, { key: 'https://example.com/primary.jpg', isPrimary: true }])],
    ['array', [{ key: 'https://example.com/other.jpg' }, { key: 'https://example.com/primary.jpg', isPrimary: true }]],
  ])('renders the designated primary thumbnail from %s image keys', (_format, imageKeys) => {
    const data = structuredClone(mockOutfits);
    Object.assign(data.outfits[0].wearableItems[0], { imageKeys });
    vi.mocked(useGetOutfits).mockReturnValue({
      data,
      isLoading: false,
      isError: false,
    } as any);

    render(<OutfitPicker selectedOutfitId={null} onSelect={() => {}} />);

    const image = screen.getByTestId('outfit-thumbnail-outfit-1');
    expect(image).toHaveAttribute('src', 'https://example.com/primary.jpg');
    expect(image).toHaveAttribute('alt', '');
    expect(image).toHaveAttribute('data-cache-key', 'outfit-outfit-1-item-1');
  });

  it('falls back to the first nested item when the first wearable has no image', () => {
    const data = structuredClone(mockOutfits);
    Object.assign(data.outfits[0].wearableItems[0], { imageKeys: null });
    Object.assign(data.outfits[0].wearableItems[1], {
      imageKeys: [{ key: 'https://example.com/jeans.jpg?X-Amz-Signature=signed', isPrimary: true }],
    });
    vi.mocked(useGetOutfits).mockReturnValue({ data, isLoading: false, isError: false } as any);

    render(<OutfitPicker selectedOutfitId={null} onSelect={() => {}} />);

    const image = screen.getByTestId('outfit-thumbnail-outfit-1');
    expect(image).toHaveAttribute('src', 'https://example.com/jeans.jpg?X-Amz-Signature=signed');
    expect(image).toHaveAttribute('data-cache-key', 'outfit-outfit-1-item-2');
  });

  it('shows the intentional placeholder when no outfit item has a loadable image', () => {
    const data = structuredClone(mockOutfits);
    Object.assign(data.outfits[0].wearableItems[0], { imageKeys: [{ key: 'wardrobe/raw-key.jpg', isPrimary: true }] });
    vi.mocked(useGetOutfits).mockReturnValue({ data, isLoading: false, isError: false } as any);

    render(<OutfitPicker selectedOutfitId={null} onSelect={() => {}} />);

    expect(screen.queryByTestId('outfit-thumbnail-outfit-1')).toBeNull();
    expect(document.querySelector('img[src*="wardrobe/raw-key.jpg"]')).toBeNull();
  });
});
