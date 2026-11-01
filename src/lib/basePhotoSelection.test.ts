import { describe, it, expect } from 'vitest';
import { resolveBasePhotoSelection } from './basePhotoSelection';
import type { GetVtoBasePhotos200Item } from '../api/model/getVtoBasePhotos200Item';

function photo(
  overrides: Partial<GetVtoBasePhotos200Item> & Pick<GetVtoBasePhotos200Item, 'id'>,
): GetVtoBasePhotos200Item {
  return {
    userId: 'user-1',
    imageId: `image-${overrides.id}`,
    url: `https://signed.example.com/${overrides.id}.jpg`,
    isDefault: false,
    source: 'user',
    createdAt: '2026-06-01T00:00:00.000Z',
    ...overrides,
  };
}

const systemPhoto = photo({
  id: 'photo-system',
  userId: null,
  source: 'system',
  isDefault: true,
});

describe('resolveBasePhotoSelection', () => {
  it('keeps the photo chosen during the visit when another photo is flagged default', () => {
    expect(resolveBasePhotoSelection(
      [photo({ id: 'photo-chosen' }), photo({ id: 'photo-default', isDefault: true })],
      'photo-chosen',
    )).toEqual({ photoId: 'photo-chosen', source: 'chosen' });
  });

  it('falls back to the flagged default when the chosen photo is no longer listed', () => {
    expect(resolveBasePhotoSelection(
      [photo({ id: 'photo-default', isDefault: true }), photo({ id: 'photo-other' })],
      'photo-deleted',
    )).toEqual({ photoId: 'photo-default', source: 'default' });
  });

  it('selects the flagged shared system photo when nothing was chosen', () => {
    expect(resolveBasePhotoSelection(
      [photo({ id: 'photo-own' }), systemPhoto],
      null,
    )).toEqual({ photoId: 'photo-system', source: 'default' });
  });

  it('selects nothing when no photo is flagged as default', () => {
    expect(resolveBasePhotoSelection(
      [photo({ id: 'photo-own' }), photo({ id: 'photo-other' })],
      null,
    )).toEqual({ photoId: null, source: 'none' });
  });

  it('resolves several flagged photos to the first in list order', () => {
    // Own photos precede system photos in the API response, so the caller's own
    // pointer target wins a malformed double flag.
    expect(resolveBasePhotoSelection(
      [photo({ id: 'photo-own', isDefault: true }), systemPhoto],
      null,
    )).toEqual({ photoId: 'photo-own', source: 'default' });

    // The rule is positional: a list flagging the system row first selects it.
    expect(resolveBasePhotoSelection(
      [systemPhoto, photo({ id: 'photo-own', isDefault: true })],
      null,
    )).toEqual({ photoId: 'photo-system', source: 'default' });
  });

  it('selects nothing for an empty list', () => {
    expect(resolveBasePhotoSelection([], null)).toEqual({ photoId: null, source: 'none' });
  });

  it('selects nothing before the list loads or after the query errors', () => {
    expect(resolveBasePhotoSelection(undefined, null)).toEqual({ photoId: null, source: 'none' });
    expect(resolveBasePhotoSelection(null, null)).toEqual({ photoId: null, source: 'none' });
  });
});
