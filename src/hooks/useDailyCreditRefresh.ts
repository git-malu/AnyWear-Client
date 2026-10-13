import { useEffect } from 'react';
import { useGetUsersMe } from '../api/endpoints/users/users';

/**
 * Milliseconds until the next local midnight, which is the day boundary the
 * Service uses when it replenishes daily credits. The value is always
 * strictly positive so a boundary that has just passed schedules the next day
 * instead of firing in a tight loop.
 */
export function msUntilNextLocalMidnight(now: Date = new Date()): number {
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return Math.max(next.getTime() - now.getTime(), 1000);
}

/**
 * Revalidates the authenticated profile across the local day boundary so the
 * displayed balance shows the replenished credits without waiting for a
 * generation request. The Service owns the reset semantics; the Client only
 * asks for fresh profile data when the boundary passes.
 */
export default function useDailyCreditRefresh(): void {
  const { data: user, refetch } = useGetUsersMe();
  const lastCreditRecharge = user?.lastCreditRecharge ?? null;

  useEffect(() => {
    if (!user) return;

    let timeout: ReturnType<typeof setTimeout>;

    const schedule = () => {
      timeout = setTimeout(() => {
        void refetch().finally(schedule);
      }, msUntilNextLocalMidnight());
    };

    schedule();

    return () => clearTimeout(timeout);
  }, [user, lastCreditRecharge, refetch]);
}
