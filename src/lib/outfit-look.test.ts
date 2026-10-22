import { describe, it, expect } from 'vitest';
import {
  OUTFIT_LOOK_POLL_INTERVAL_MS,
  outfitHasActiveGeneration,
  outfitLookRefetchInterval,
  outfitsHaveActiveGeneration,
} from './outfit-look';

describe('outfit look polling', () => {
  it('keeps polling while any returned generation is Pending or Processing', () => {
    const data = {
      outfits: [
        { latestGeneration: { status: 'Complete' } },
        { latestGeneration: { status: 'Processing' } },
      ],
    };

    expect(outfitLookRefetchInterval(data)).toBe(OUTFIT_LOOK_POLL_INTERVAL_MS);
    expect(outfitsHaveActiveGeneration(data.outfits)).toBe(true);
  });

  it('stops polling at a terminal status', () => {
    expect(outfitLookRefetchInterval({
      outfits: [
        { latestGeneration: { status: 'Complete' } },
        { latestGeneration: { status: 'Failed' } },
      ],
    })).toBe(false);
    expect(outfitLookRefetchInterval({
      outfits: [{ latestGeneration: null }, {}],
    })).toBe(false);
    expect(outfitLookRefetchInterval({ outfits: [] })).toBe(false);
    expect(outfitLookRefetchInterval(undefined)).toBe(false);
  });

  it('treats only Pending and Processing as active', () => {
    expect(outfitHasActiveGeneration({ latestGeneration: { status: 'Pending' } })).toBe(true);
    expect(outfitHasActiveGeneration({ latestGeneration: { status: 'Processing' } })).toBe(true);
    expect(outfitHasActiveGeneration({ latestGeneration: { status: 'Complete' } })).toBe(false);
    expect(outfitHasActiveGeneration({ latestGeneration: { status: 'Failed' } })).toBe(false);
    expect(outfitHasActiveGeneration(null)).toBe(false);
  });
});
