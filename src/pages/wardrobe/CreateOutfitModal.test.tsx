// @vitest-environment jsdom
import { vi, describe, it, expect, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import CreateOutfitModal from '../../pages/wardrobe/CreateOutfitModal';

const mockItems = [
  { id: 'item-1', name: 'T-Shirt', category: 'Top', imageKeys: '[{"key":"test.jpg","isPrimary":true}]' },
  { id: 'item-2', name: 'Jeans', category: 'Bottom', imageKeys: '[{"key":"test2.jpg","isPrimary":true}]' },
  { id: 'item-3', name: null, category: 'Shoes', imageKeys: null },
];

vi.mock('../../api/endpoints/outfits/outfits', () => ({
  usePostOutfits: vi.fn(),
}));

vi.mock('../../api/endpoints/wardrobe/wardrobe', () => ({
  useGetWardrobe: vi.fn(),
}));

import { usePostOutfits } from '../../api/endpoints/outfits/outfits';
import { useGetWardrobe } from '../../api/endpoints/wardrobe/wardrobe';

function setupMocks(items: typeof mockItems = mockItems) {
  vi.mocked(useGetWardrobe).mockReturnValue({
    data: items,
    isLoading: false,
    isError: false,
  } as any);
  vi.mocked(usePostOutfits).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as any);
}

describe('CreateOutfitModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onSuccess: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it('renders nothing when isOpen is false', () => {
    setupMocks();
    const { container } = render(<CreateOutfitModal {...defaultProps} isOpen={false} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders modal title when open', () => {
    setupMocks();
    render(<CreateOutfitModal {...defaultProps} />);
    expect(screen.getByRole('heading', { name: 'Create Outfit' })).toBeDefined();
  });

  it('shows name input field', () => {
    setupMocks();
    render(<CreateOutfitModal {...defaultProps} />);

    const input = screen.getByPlaceholderText('e.g. Weekend Casual');
    expect(input).toBeDefined();
    expect(input).toHaveAttribute('maxLength', '200');
  });

  it('shows wardrobe items with names', () => {
    setupMocks();
    render(<CreateOutfitModal {...defaultProps} />);

    expect(screen.getByText('T-Shirt')).toBeDefined();
    expect(screen.getByText('Jeans')).toBeDefined();
    expect(screen.getByText('Shoes')).toBeDefined();
  });

  it('shows item category when name is null', () => {
    setupMocks();
    render(<CreateOutfitModal {...defaultProps} />);

    // Item-3 has null name, should show category "Shoes"
    expect(screen.getByText('Shoes')).toBeDefined();
  });

  it('shows empty state when no wardrobe items', () => {
    vi.mocked(useGetWardrobe).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as any);
    vi.mocked(usePostOutfits).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as any);

    render(<CreateOutfitModal {...defaultProps} />);

    expect(screen.getByText('No items in wardrobe yet.')).toBeDefined();
  });

  it('toggles item selection on click', () => {
    setupMocks();
    render(<CreateOutfitModal {...defaultProps} />);

    const tshirtButton = screen.getByText('T-Shirt');
    fireEvent.click(tshirtButton);

    // The selection count should update
    expect(screen.getByText(/1 selected/)).toBeDefined();

    // Click again to deselect
    fireEvent.click(tshirtButton);
    expect(screen.getByText(/0 selected/)).toBeDefined();
  });

  it('selects multiple items', () => {
    setupMocks();
    render(<CreateOutfitModal {...defaultProps} />);

    fireEvent.click(screen.getByText('T-Shirt'));
    fireEvent.click(screen.getByText('Jeans'));

    expect(screen.getByText(/2 selected/)).toBeDefined();
  });

  it('disables create button when no items selected', () => {
    setupMocks();
    render(<CreateOutfitModal {...defaultProps} />);

    const createButton = screen.getByRole('button', { name: 'Create Outfit' });
    expect(createButton).toBeDisabled();
  });

  it('enables create button when items selected', () => {
    setupMocks();
    render(<CreateOutfitModal {...defaultProps} />);

    fireEvent.click(screen.getByText('T-Shirt'));

    const createButton = screen.getByRole('button', { name: 'Create Outfit' });
    expect(createButton).not.toBeDisabled();
  });

  it('shows creating state when pending', () => {
    setupMocks();
    vi.mocked(usePostOutfits).mockReturnValue({
      mutate: vi.fn(),
      isPending: true,
    } as any);

    render(<CreateOutfitModal {...defaultProps} />);

    expect(screen.getByText('Creating...')).toBeDefined();
  });

  it('calls onClose when cancel button clicked', () => {
    const onClose = vi.fn();
    setupMocks();
    render(<CreateOutfitModal {...defaultProps} onClose={onClose} />);

    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when backdrop clicked', () => {
    const onClose = vi.fn();
    setupMocks();
    render(<CreateOutfitModal {...defaultProps} onClose={onClose} />);

    // Click the backdrop (first fixed inset div before the modal content)
    const backdrop = document.querySelector('.bg-gray-500.bg-opacity-75');
    if (backdrop) fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls mutate with correct data on create', () => {
    const mutate = vi.fn();
    const onSuccess = vi.fn();
    const onClose = vi.fn();
    setupMocks();
    vi.mocked(usePostOutfits).mockReturnValue({
      mutate,
      isPending: false,
    } as any);

    render(<CreateOutfitModal {...defaultProps} onSuccess={onSuccess} onClose={onClose} />);

    fireEvent.click(screen.getByText('T-Shirt'));

    // Set a name
    const nameInput = screen.getByPlaceholderText('e.g. Weekend Casual');
    fireEvent.change(nameInput, { target: { value: 'My Outfit' } });

    fireEvent.click(screen.getByRole('button', { name: 'Create Outfit' }));

    expect(mutate).toHaveBeenCalledWith(
      { data: { name: 'My Outfit', wearable_item_ids: ['item-1'] } },
      expect.objectContaining({
        onSuccess: expect.any(Function),
      }),
    );
  });

  it('strips whitespace from name before creating', () => {
    const mutate = vi.fn();
    setupMocks();
    vi.mocked(usePostOutfits).mockReturnValue({
      mutate,
      isPending: false,
    } as any);

    render(<CreateOutfitModal {...defaultProps} />);

    fireEvent.click(screen.getByText('T-Shirt'));

    const nameInput = screen.getByPlaceholderText('e.g. Weekend Casual');
    fireEvent.change(nameInput, { target: { value: '   ' } });

    fireEvent.click(screen.getByRole('button', { name: 'Create Outfit' }));

    // Whitespace-only name should become undefined
    expect(mutate).toHaveBeenCalledWith(
      { data: { name: undefined, wearable_item_ids: ['item-1'] } },
      expect.any(Object),
    );
  });

  it('does not call mutate when no items selected', () => {
    const mutate = vi.fn();
    setupMocks();
    vi.mocked(usePostOutfits).mockReturnValue({
      mutate,
      isPending: false,
    } as any);

    render(<CreateOutfitModal {...defaultProps} />);

    // Button is disabled, but try clicking anyway
    const createButton = screen.getByRole('button', { name: 'Create Outfit' });
    fireEvent.click(createButton);

    expect(mutate).not.toHaveBeenCalled();
  });
});
