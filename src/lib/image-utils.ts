export interface ImageEntry {
  key: string;
  view?: string;
  isPrimary?: boolean;
}

export function parseImageKeys(raw: unknown): ImageEntry[] {
  if (Array.isArray(raw)) return raw as ImageEntry[];
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as ImageEntry[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function getPrimaryImage(imageKeys: unknown): string | null {
  const images = parseImageKeys(imageKeys);
  if (images.length === 0) return null;
  const primary = images.find((e) => e.isPrimary === true);
  return primary?.key ?? images[0]?.key ?? null;
}

/**
 * Resolves the thumbnail source for a nested wearable item.
 *
 * Outfit responses embed wearable items that carry signed image URLs in the
 * same `imageKeys` field wardrobe items use, but the field can also arrive as
 * a raw S3 key, a JSON string, or a plain array depending on the route that
 * produced the payload. Treat anything that is not a loadable URL as "no
 * image" so callers fall back to their intentional empty state instead of
 * handing a bare key to `CachedImage`.
 */
export function getPrimaryImageUrl(imageKeys: unknown): string | null {
  // Some routes return the signed URL as a bare string rather than a JSON
  // array of entries.
  if (typeof imageKeys === 'string' && isLoadableImageUrl(imageKeys)) {
    return imageKeys;
  }
  const primary = getPrimaryImage(imageKeys);
  if (!primary) return null;
  return isLoadableImageUrl(primary) ? primary : null;
}

function isLoadableImageUrl(value: string): boolean {
  return /^https?:\/\//i.test(value) || value.startsWith('data:') || value.startsWith('blob:');
}

/**
 * The image of a saved outfit is its completed look, never a garment.
 *
 * `look` is the Service's newest complete generation with a stored image;
 * `generationId` is part of the cache key so a regenerated look is not served
 * from the previous generation's cached file. There is no fallback to
 * `wearableItems`: an outfit without a completed look shows the empty state.
 */
export interface OutfitLook {
  generationId: string;
  url: string;
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

export function getAllImages(imageKeys: unknown): ImageEntry[] {
  return parseImageKeys(imageKeys);
}
