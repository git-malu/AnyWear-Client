import { useEffect } from 'react';
import { useGetUsersMe } from '../api/endpoints/users/users';

/**
 * Milliseconds until the next UTC midnight, which is the day boundary the
 * Service uses when it replenishes daily credits. The value is always
 * strictly positive so a boundary that has just passed schedules the next day
 * instead of firing in a tight loop.
 */
export function msUntilNextUtcMidnight(now: Date = new Date()): number {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return Math.max(next - now.getTime(), 1000);
}

/**
 * Revalidates the authenticated profile across the UTC day boundary so the
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
      }, msUntilNextUtcMidnight());
    };

    schedule();

    return () => clearTimeout(timeout);
  }, [user, lastCreditRecharge, refetch]);
}
