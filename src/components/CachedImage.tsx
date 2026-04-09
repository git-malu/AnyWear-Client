import { useState, useEffect } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { appDataDir, join } from '@tauri-apps/api/path';
import { exists, mkdir, writeFile } from '@tauri-apps/plugin-fs';
import { convertFileSrc } from '@tauri-apps/api/core';

interface CachedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  cacheKey: string;
}

const activeDownloads = new Map<string, Promise<string>>();

export default function CachedImage({ src, cacheKey, ...props }: CachedImageProps) {
  const [imgSrc, setImgSrc] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadCachedImage() {
      if (!isTauri()) {
        if (isMounted) setImgSrc(src);
        return;
      }

      try {
        const baseDir = await appDataDir();
        const cacheDir = await join(baseDir, 'cache', 'images');
        const filePath = await join(cacheDir, `${cacheKey}.jpg`);

        const fileExists = await exists(filePath);

        if (fileExists) {
          if (isMounted) setImgSrc(convertFileSrc(filePath));
          return;
        }

        if (activeDownloads.has(cacheKey)) {
          const path = await activeDownloads.get(cacheKey);
          if (path && isMounted) setImgSrc(convertFileSrc(path));
          return;
        }

        const downloadPromise = (async () => {
          const dirExists = await exists(cacheDir);
          if (!dirExists) {
            await mkdir(cacheDir, { recursive: true });
          }

          const response = await fetch(src);
          if (!response.ok) throw new Error('Network response was not ok');
          const buffer = await response.arrayBuffer();
          await writeFile(filePath, new Uint8Array(buffer));
          
          return filePath;
        })();

        activeDownloads.set(cacheKey, downloadPromise);
        const downloadedPath = await downloadPromise;
        activeDownloads.delete(cacheKey);

        if (isMounted) {
          setImgSrc(convertFileSrc(downloadedPath));
        }
      } catch (error) {
        console.error('Failed to load cached image:', error);
        if (isMounted) setImgSrc(src); // Fallback to network on error
        activeDownloads.delete(cacheKey);
      }
    }

    loadCachedImage();

    return () => {
      isMounted = false;
    };
  }, [src, cacheKey]);

  if (!imgSrc) return <div className={`animate-pulse bg-gray-200 ${props.className || ''}`}></div>;

  return <img src={imgSrc} {...props} />;
}