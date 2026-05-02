export interface ImageEntry {
  url: string;
  view?: string;
  isPrimary?: boolean;
}

export function parseImageUrls(raw: unknown): ImageEntry[] {
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

export function getPrimaryImage(imageUrls: unknown): string | null {
  const images = parseImageUrls(imageUrls);
  if (images.length === 0) return null;
  const primary = images.find((e) => e.isPrimary === true);
  return primary?.url ?? images[0]?.url ?? null;
}

export function getAllImages(imageUrls: unknown): ImageEntry[] {
  return parseImageUrls(imageUrls);
}
