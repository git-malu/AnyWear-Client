// @vitest-environment jsdom
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import CachedImage from './CachedImage';
import { isTauri, convertFileSrc } from '@tauri-apps/api/core';
import { exists, mkdir, writeFile } from '@tauri-apps/plugin-fs';

// Mock Tauri APIs
vi.mock('@tauri-apps/api/core', () => ({
  isTauri: vi.fn(),
  convertFileSrc: vi.fn((path) => `http://asset.localhost/${path}`),
}));

vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn(async () => '/mock/appdata'),
  join: vi.fn(async (...args) => args.join('/')),
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: vi.fn(),
  mkdir: vi.fn(),
  writeFile: vi.fn(),
}));

describe('CachedImage Component', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('renders with original src if not running in Tauri', async () => {
    vi.mocked(isTauri).mockReturnValue(false);

    render(<CachedImage src="https://example.com/image.jpg" cacheKey="test-key-1" alt="Test 1" />);

    const img = await screen.findByRole('img');
    expect(img).toHaveAttribute('src', 'https://example.com/image.jpg');
    expect(exists).not.toHaveBeenCalled();
  });

  it('uses locally cached image if it already exists', async () => {
    vi.mocked(isTauri).mockReturnValue(true);
    // Mock that the file exists
    vi.mocked(exists).mockImplementation(async (path) => {
      if (typeof path === 'string' && path.endsWith('test-key-2.jpg')) return true;
      return false;
    });

    render(<CachedImage src="https://example.com/image.jpg" cacheKey="test-key-2" alt="Test 2" />);

    const img = await screen.findByRole('img');
    
    // It should convert the local file path to an asset URL
    expect(convertFileSrc).toHaveBeenCalledWith('/mock/appdata/cache/images/test-key-2.jpg');
    expect(img).toHaveAttribute('src', 'http://asset.localhost//mock/appdata/cache/images/test-key-2.jpg');
    
    // Should not try to download
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('downloads and saves the image if it does not exist locally', async () => {
    vi.mocked(isTauri).mockReturnValue(true);
    
    // Mock file does NOT exist initially, but directory exists check
    vi.mocked(exists).mockImplementation(async (path) => {
      // Return true for directory check to simplify test, false for file
      if (typeof path === 'string' && path.endsWith('cache/images')) return true;
      return false; // File doesn't exist
    });

    // Mock successful fetch
    const mockArrayBuffer = new ArrayBuffer(8);
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      arrayBuffer: async () => mockArrayBuffer,
    } as Response);

    render(<CachedImage src="https://example.com/image.jpg" cacheKey="test-key-3" alt="Test 3" />);

    const img = await waitFor(() => screen.getByRole('img'));

    // Verify it fetched the image
    expect(global.fetch).toHaveBeenCalledWith('https://example.com/image.jpg');
    
    // Verify it wrote the file
    expect(writeFile).toHaveBeenCalledWith(
      '/mock/appdata/cache/images/test-key-3.jpg',
      new Uint8Array(mockArrayBuffer)
    );

    // Verify it set the correct local asset source
    expect(convertFileSrc).toHaveBeenCalledWith('/mock/appdata/cache/images/test-key-3.jpg');
    expect(img).toHaveAttribute('src', 'http://asset.localhost//mock/appdata/cache/images/test-key-3.jpg');
  });

  it('falls back to network src if download fails', async () => {
    vi.mocked(isTauri).mockReturnValue(true);
    vi.mocked(exists).mockResolvedValue(false);

    // Mock failed fetch
    vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'));

    // Suppress console.error for this specific test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<CachedImage src="https://example.com/image.jpg" cacheKey="test-key-4" alt="Test 4" />);

    const img = await waitFor(() => screen.getByRole('img'));

    // Since download failed, it should fallback to the original src
    expect(img).toHaveAttribute('src', 'https://example.com/image.jpg');
    
    // File shouldn't have been written
    expect(writeFile).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});
