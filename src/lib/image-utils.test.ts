import { describe, it, expect } from 'vitest';
import {
  getOutfitPrimaryImage,
  getOutfitThumbnailCacheKey,
  getPrimaryImage,
  getPrimaryImageUrl,
} from './image-utils';

const SIGNED = 'https://anywear-beta.s3.amazonaws.com/wardrobe/item.jpg?X-Amz-Signature=abc';

describe('getPrimaryImageUrl', () => {
  it('accepts signed and unsigned https URLs from either payload shape', () => {
    expect(getPrimaryImageUrl([{ key: SIGNED, isPrimary: true }])).toBe(SIGNED);
    expect(getPrimaryImageUrl(JSON.stringify([{ key: SIGNED, isPrimary: true }]))).toBe(SIGNED);
    expect(getPrimaryImageUrl('https://cdn.example.com/a.png')).toBe('https://cdn.example.com/a.png');
    expect(getPrimaryImageUrl('http://localhost:3000/a.png')).toBe('http://localhost:3000/a.png');
  });

  it('rejects raw storage keys so callers show the intentional empty state', () => {
    expect(getPrimaryImageUrl([{ key: 'wardrobe/1234/item.jpg', isPrimary: true }])).toBeNull();
    expect(getPrimaryImageUrl(JSON.stringify([{ key: 'wardrobe/1234/item.jpg' }]))).toBeNull();
  });

  it('returns null for empty or unparsable payloads', () => {
    expect(getPrimaryImageUrl(null)).toBeNull();
    expect(getPrimaryImageUrl(undefined)).toBeNull();
    expect(getPrimaryImageUrl('not json')).toBeNull();
    expect(getPrimaryImageUrl([])).toBeNull();
  });

  it('keeps getPrimaryImage behaviour unchanged for wardrobe callers', () => {
    expect(getPrimaryImage([{ key: 'wardrobe/raw.jpg', isPrimary: true }])).toBe('wardrobe/raw.jpg');
  });
});

describe('getOutfitPrimaryImage', () => {
  it('uses the first nested wearable item that has a loadable image', () => {
    expect(
      getOutfitPrimaryImage([
        { id: 'item-1', imageKeys: null },
        { id: 'item-2', imageKeys: [{ key: SIGNED, isPrimary: true }] },
      ]),
    ).toEqual({ src: SIGNED, itemId: 'item-2' });
  });

  it('returns no source for empty outfits or items without images', () => {
    expect(getOutfitPrimaryImage([])).toEqual({ src: null, itemId: null });
    expect(getOutfitPrimaryImage(null)).toEqual({ src: null, itemId: null });
    expect(
      getOutfitPrimaryImage([{ id: 'item-1', imageKeys: null }, { id: 'item-2', imageKeys: [] }]),
    ).toEqual({ src: null, itemId: null });
  });

  it('does not leak raw storage keys to the browser', () => {
    expect(getOutfitPrimaryImage([{ id: 'item-1', imageKeys: [{ key: 'wardrobe/raw.jpg' }] }])).toEqual({
      src: null,
      itemId: null,
    });
  });
});

describe('getOutfitThumbnailCacheKey', () => {
  it('namespaces the outfit thumbnail so it cannot collide with the wardrobe item cache', () => {
    expect(getOutfitThumbnailCacheKey('outfit-1', 'item-1')).not.toBe('item-1');
    expect(getOutfitThumbnailCacheKey('outfit-1', 'item-1')).toBe('outfit-outfit-1-item-1');
    expect(getOutfitThumbnailCacheKey('outfit-1')).toBe('outfit-outfit-1');
  });
});
