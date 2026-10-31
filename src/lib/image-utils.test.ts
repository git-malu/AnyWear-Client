import { describe, it, expect } from 'vitest';
import { getOutfitLookImage, getPrimaryImageUrl } from './image-utils';

const SIGNED = 'https://anywear-beta.s3.amazonaws.com/wardrobe/item.jpg?X-Amz-Signature=abc';

describe('getPrimaryImageUrl', () => {
  it('returns the primary entry URL, not the first entry', () => {
    expect(getPrimaryImageUrl([
      { imageId: 'image-1', url: 'https://example.com/first.jpg', isPrimary: false },
      { imageId: 'image-2', url: SIGNED, isPrimary: true },
    ])).toBe(SIGNED);
  });

  it('falls back to the first entry when none is marked primary', () => {
    expect(getPrimaryImageUrl([
      { imageId: 'image-1', url: SIGNED, isPrimary: false },
      { imageId: 'image-2', url: 'https://example.com/second.jpg' },
    ])).toBe(SIGNED);
  });

  it('returns null when the chosen entry has no URL', () => {
    expect(getPrimaryImageUrl([{ imageId: 'image-1', url: null, isPrimary: true }])).toBeNull();
    expect(getPrimaryImageUrl([
      { imageId: 'image-1', url: null, isPrimary: true },
      { imageId: 'image-2', url: SIGNED, isPrimary: false },
    ])).toBeNull();
  });

  it('returns null for an absent or empty list', () => {
    expect(getPrimaryImageUrl(undefined)).toBeNull();
    expect(getPrimaryImageUrl([])).toBeNull();
  });

  it('paints the value the Service sent without testing its shape', () => {
    // The contract names `url` as the displayable member; the Client does not
    // re-derive that from a URL pattern, so an unexpected value is passed on
    // unchanged rather than silently replaced by an empty state.
    expect(getPrimaryImageUrl([{ imageId: 'image-1', url: 'wardrobe/1234/item.jpg', isPrimary: true }]))
      .toBe('wardrobe/1234/item.jpg');
  });
});

describe('getOutfitLookImage', () => {
  const LOOK_URL = 'https://anywear-beta.s3.amazonaws.com/outfit-generations/user/outfit/gen.png?X-Amz-Signature=signed';

  it('uses the completed look URL and namespaces the cache by generation', () => {
    const first = getOutfitLookImage({
      generationId: 'generation-1',
      url: LOOK_URL,
      createdAt: '2026-06-01T00:00:00.000Z',
    });
    const second = getOutfitLookImage({
      generationId: 'generation-2',
      url: LOOK_URL,
      createdAt: '2026-06-02T00:00:00.000Z',
    });

    expect(first).toEqual({ src: LOOK_URL, cacheKey: 'outfit-look-generation-1' });
    expect(second?.cacheKey).toBe('outfit-look-generation-2');
    expect(second?.cacheKey).not.toBe(first?.cacheKey);
  });

  it('returns the empty state for an outfit with no completed look', () => {
    expect(getOutfitLookImage(null)).toBeNull();
    expect(getOutfitLookImage(undefined)).toBeNull();
    expect(getOutfitLookImage({ generationId: '', url: LOOK_URL })).toBeNull();
    expect(getOutfitLookImage({ generationId: 'generation-1', url: '' })).toBeNull();
    expect(getOutfitLookImage({ generationId: 'generation-1', url: null })).toBeNull();
  });
});
