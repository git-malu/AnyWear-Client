// @vitest-environment jsdom
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';

vi.mock('../../api/endpoints/wardrobe/wardrobe', () => ({
  usePatchWardrobeItemsId: vi.fn(),
  useDeleteWardrobeItemsId: vi.fn(),
  usePostWardrobeItemsItemIdRetag: vi.fn(),
}));

vi.mock('../../api/custom-instance', () => ({
  AXIOS_INSTANCE: { post: vi.fn() },
}));

vi.mock('../../components/CachedImage', () => ({
  default: ({ src, cacheKey, alt, className, ...rest }: any) => (
    <img src={src} alt={alt} className={className} data-cache-key={cacheKey} {...rest} />
  ),
}));

import ItemDetailsModal from './ItemDetailsModal';
import { AXIOS_INSTANCE } from '../../api/custom-instance';
import { HEIC_UNSUPPORTED_MESSAGE } from '../../lib/imageUpload';
import {
  useDeleteWardrobeItemsId,
  usePatchWardrobeItemsId,
  usePostWardrobeItemsItemIdRetag,
} from '../../api/endpoints/wardrobe/wardrobe';
import type { GetWardrobe200Item } from '../../api/model/getWardrobe200Item';

const postMock = vi.mocked(AXIOS_INSTANCE.post);

function makeItem(overrides: Partial<GetWardrobe200Item> = {}): GetWardrobe200Item {
  return {
    id: 'item-1',
    ownerId: 'user-1',
    name: 'Black Hoodie',
    // The add-image input renders only when the item already has a gallery.
    imageKeys: '[{"key":"k.jpg","isPrimary":true}]',
    category: 'Top',
    taggingStatus: 'complete',
    taggingStateVersion: 1,
    taggingErrorCode: null,
    taggingErrorMessage: null,
    weatherTags: null,
    styleAttributes: null,
    isPublic: null,
    imageEmbedding: null,
    createdAt: '2026-05-05T00:00:00.000Z',
    updatedAt: '2026-05-05T00:00:00.000Z',
    ...overrides,
  };
}

function renderModal(item: GetWardrobe200Item) {
  return render(<ItemDetailsModal item={item} isOpen onClose={vi.fn()} onSuccess={vi.fn()} />);
}

describe('ItemDetailsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
    vi.mocked(usePatchWardrobeItemsId).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any);
    vi.mocked(useDeleteWardrobeItemsId).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any);
    vi.mocked(usePostWardrobeItemsItemIdRetag).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any);
    vi.spyOn(window, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('narrows the add-image picker and alerts the HEIC guidance before any network call', async () => {
    const { container } = renderModal(makeItem());
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');

    expect(input).not.toBeNull();
    expect(input).toHaveAttribute('accept', 'image/jpeg,image/png,image/webp');

    fireEvent.change(input!, { target: { files: [new File(['x'], 'photo.heic')] } });

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith(expect.stringContaining(HEIC_UNSUPPORTED_MESSAGE));
    });
    expect(postMock).not.toHaveBeenCalled();
  });

  it('renders the server message for a terminal unsupported-format failure and offers no Re-tag', () => {
    renderModal(makeItem({
      taggingStatus: 'failed',
      taggingErrorCode: 'input_image_unsupported_format',
      taggingErrorMessage: 'Image format image/heic cannot be sent to the provider',
    }));

    expect(screen.getByRole('alert'))
      .toHaveTextContent('Image format image/heic cannot be sent to the provider');
    expect(screen.getByText('Tagging Failed')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /re-tag/i })).toBeNull();
  });

  it('keeps the Re-tag action when the failure is not the terminal format code', () => {
    renderModal(makeItem({
      taggingStatus: 'failed',
      taggingErrorCode: null,
      taggingErrorMessage: 'Auto-tagging failed unexpectedly',
    }));

    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText('Auto-tagging failed unexpectedly')).toBeNull();
    expect(screen.getByRole('button', { name: /re-tag/i })).toBeInTheDocument();
  });
});
