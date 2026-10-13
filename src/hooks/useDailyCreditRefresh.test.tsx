// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, render } from '@testing-library/react';

import useDailyCreditRefresh, { msUntilNextUtcMidnight } from './useDailyCreditRefresh';

const refetch = vi.fn().mockResolvedValue({ data: undefined });

vi.mock('../api/endpoints/users/users', () => ({
  useGetUsersMe: vi.fn(),
}));

import { useGetUsersMe } from '../api/endpoints/users/users';

function Probe() {
  useDailyCreditRefresh();
  return null;
}

describe('msUntilNextUtcMidnight', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the remaining time until the next UTC midnight', () => {
    vi.setSystemTime(new Date(Date.UTC(2026, 4, 13, 23, 30, 0, 0)));
    expect(msUntilNextUtcMidnight()).toBe(30 * 60 * 1000);
  });

  it('never returns zero or a negative delay right after the boundary', () => {
    vi.setSystemTime(new Date(Date.UTC(2026, 4, 13, 0, 0, 0, 1)));
    expect(msUntilNextUtcMidnight()).toBeGreaterThan(0);
  });
});

describe('useDailyCreditRefresh', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    refetch.mockClear();
  });

  it('revalidates the profile when the day boundary is crossed', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 4, 13, 23, 59, 30, 0)));
    vi.mocked(useGetUsersMe).mockReturnValue({
      data: { dailyCredits: 8, lastCreditRecharge: '2026-05-13T10:00:00.000Z' },
      refetch,
    } as any);

    render(<Probe />);
    expect(refetch).not.toHaveBeenCalled();

    vi.advanceTimersByTime(30 * 1000);
    await Promise.resolve();
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('does not revalidate before data is available', () => {
    vi.useFakeTimers();
    vi.mocked(useGetUsersMe).mockReturnValue({ data: undefined, refetch } as any);

    render(<Probe />);
    vi.advanceTimersByTime(25 * 60 * 60 * 1000);
    expect(refetch).not.toHaveBeenCalled();
  });
});
