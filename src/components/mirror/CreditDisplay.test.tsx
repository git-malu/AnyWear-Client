// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';

import CreditDisplay from './CreditDisplay';

vi.mock('../../api/endpoints/users/users', () => ({
  useGetUsersMe: vi.fn(),
}));

vi.mock('../../hooks/useDailyCreditRefresh', () => ({
  default: vi.fn(),
}));

import { useGetUsersMe } from '../../api/endpoints/users/users';
import useDailyCreditRefresh from '../../hooks/useDailyCreditRefresh';

describe('CreditDisplay', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders the balance returned by the profile query', () => {
    vi.mocked(useGetUsersMe).mockReturnValue({ data: { dailyCredits: 8 } } as any);
    render(<CreditDisplay />);
    expect(screen.getByRole('status')).toHaveTextContent('8/10 today');
  });

  it('shows the replenished balance after the boundary revalidation', () => {
    vi.mocked(useGetUsersMe)
      .mockReturnValueOnce({ data: { dailyCredits: 8 } } as any)
      .mockReturnValue({ data: { dailyCredits: 10 } } as any);

    const { rerender } = render(<CreditDisplay />);
    expect(screen.getByRole('status')).toHaveTextContent('8/10 today');

    // A refetch at the day boundary returns the replenished value.
    rerender(<CreditDisplay />);
    expect(screen.getByRole('status')).toHaveTextContent('10/10 today');
    expect(screen.getByRole('status')).toHaveAttribute(
      'aria-label',
      '10 of 10 daily credits remaining'
    );
    expect(useDailyCreditRefresh).toHaveBeenCalled();
  });
});
