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
 * Cache key for an outfit thumbnail. Outfit cards must not share a cache file
 * with the wardrobe item they mirror, otherwise renaming or reordering an
 * outfit serves the previously cached image.
 */
export function getOutfitThumbnailCacheKey(outfitId: string, itemId?: string | null): string {
  return itemId ? `outfit-${outfitId}-${itemId}` : `outfit-${outfitId}`;
}

export function getOutfitPrimaryImage(wearableItems: unknown): {
  src: string | null;
  itemId: string | null;
} {
  if (!Array.isArray(wearableItems)) return { src: null, itemId: null };
  for (const item of wearableItems as Array<Record<string, unknown>>) {
    const src = getPrimaryImageUrl(item.imageKeys);
    if (src) {
      const itemId = typeof item.id === 'string' ? item.id : null;
      return { src, itemId };
    }
  }
  return { src: null, itemId: null };
}

export function getAllImages(imageKeys: unknown): ImageEntry[] {
  return parseImageKeys(imageKeys);
}
