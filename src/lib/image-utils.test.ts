import { describe, it, expect } from 'vitest';
import {
  getOutfitLookImage,
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
  });
});
