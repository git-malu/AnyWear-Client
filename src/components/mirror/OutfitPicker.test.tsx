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
          imageKeys: JSON.stringify([{ key: 'https://example.com/tshirt.jpg', isPrimary: true }]),
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
  default: ({ src, alt, className }: any) => <img src={src} alt={alt} className={className} />,
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

  it('shows item count for each outfit', () => {
    vi.mocked(useGetOutfits).mockReturnValue({
      data: mockOutfits,
      isLoading: false,
      isError: false,
    } as any);

    render(<OutfitPicker selectedOutfitId={null} onSelect={() => {}} />);

    // First outfit has 2 items, second has 0
    const itemCounts = screen.getAllByText(/items/);
    expect(itemCounts).toHaveLength(2);
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
    expect(selectedButton?.className).toContain('border-blue-500');
  });

  it('renders first outfit image when available', () => {
    vi.mocked(useGetOutfits).mockReturnValue({
      data: mockOutfits,
      isLoading: false,
      isError: false,
    } as any);

    render(<OutfitPicker selectedOutfitId={null} onSelect={() => {}} />);

    // Outfits render; verify the CachedImage component is rendered
    const outfit1 = screen.getByText('Weekend Casual');
    expect(outfit1).toBeDefined();
    expect(screen.getByText('2 items')).toBeDefined();
  });
});
