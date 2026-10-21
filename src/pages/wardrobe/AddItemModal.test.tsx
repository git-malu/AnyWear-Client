// @vitest-environment jsdom
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, fireEvent, cleanup, waitFor } from '@testing-library/react';

vi.mock('../../api/endpoints/wardrobe/wardrobe', () => ({
  usePostWardrobeUploadUrl: vi.fn(),
  usePostWardrobeUpload: vi.fn(),
}));

import AddItemModal from './AddItemModal';
import { HEIC_UNSUPPORTED_MESSAGE } from '../../lib/imageUpload';
import { usePostWardrobeUpload, usePostWardrobeUploadUrl } from '../../api/endpoints/wardrobe/wardrobe';

describe('AddItemModal', () => {
  const onClose = vi.fn();
  const onSuccess = vi.fn();
  const getUploadUrl = vi.fn();
  const confirmUpload = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
    vi.mocked(usePostWardrobeUploadUrl).mockReturnValue({ mutateAsync: getUploadUrl } as any);
    vi.mocked(usePostWardrobeUpload).mockReturnValue({ mutateAsync: confirmUpload } as any);
    vi.spyOn(window, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('narrows the picker and rejects a HEIC photo before reserving an upload', async () => {
    const { container } = render(<AddItemModal isOpen onClose={onClose} onSuccess={onSuccess} />);
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');

    expect(input).not.toBeNull();
    expect(input).toHaveAttribute('accept', 'image/jpeg,image/png,image/webp');

    // The browser omits the MIME type, so only the filename identifies the format.
    fireEvent.change(input!, { target: { files: [new File(['x'], 'photo.heic')] } });
    fireEvent.submit(container.querySelector('form')!);

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith(expect.stringContaining(HEIC_UNSUPPORTED_MESSAGE));
    });
    expect(getUploadUrl).not.toHaveBeenCalled();
    expect(confirmUpload).not.toHaveBeenCalled();
  });
});
