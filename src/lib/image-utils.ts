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

export function getAllImages(imageKeys: unknown): ImageEntry[] {
  return parseImageKeys(imageKeys);
}
