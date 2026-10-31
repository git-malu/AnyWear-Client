/**
 * The display URL of an image list: the primary entry's `url`, or the first
 * entry's `url` when no entry is marked primary, or `null` when the list is
 * absent, empty, or the chosen entry has no URL.
 *
 * The Service signs `url` when it produces the response and returns `null` when
 * signing failed. The value is painted as it arrives: this module never tests
 * whether a string looks like a URL, because the contract - not a pattern - says
 * which member is displayable.
 */
export function getPrimaryImageUrl(
  images: readonly { imageId: string; url: string | null; isPrimary?: boolean }[] | undefined,
): string | null {
  if (!images || images.length === 0) return null;
  const primary = images.find((entry) => entry.isPrimary === true) ?? images[0];
  return primary.url ?? null;
}

/**
 * The image of a saved outfit is its completed look, never a garment.
 *
 * `look` is the Service's newest complete generation with a stored image;
 * `generationId` is part of the cache key so a regenerated look is not served
 * from the previous generation's cached file. There is no fallback to
 * `wearableItems`: an outfit without a completed look, or whose look has no
 * signed `url`, shows the empty state.
 */
export interface OutfitLook {
  generationId: string;
  url: string | null;
  createdAt?: string;
}

export interface OutfitLookImage {
  src: string;
  cacheKey: string;
}

export function getOutfitLookImage(look: OutfitLook | null | undefined): OutfitLookImage | null {
  if (!look) return null;
  if (typeof look.generationId !== 'string' || look.generationId.length === 0) return null;
  if (typeof look.url !== 'string' || look.url.length === 0) return null;
  return { src: look.url, cacheKey: `outfit-look-${look.generationId}` };
}
