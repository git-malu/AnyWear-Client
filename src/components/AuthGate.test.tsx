import { StrictMode } from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getCurrentUser, signOut } from 'aws-amplify/auth';
import { Hub } from 'aws-amplify/utils';
import { AuthListener } from '../App';
import { useAuthStore } from '../store/authStore';
import AuthGate from './AuthGate';

vi.mock('aws-amplify/auth', () => ({ getCurrentUser: vi.fn(), signOut: vi.fn() }));

const user = { username: 'test-user', userId: 'test-user-id' };

function deferredUser() {
  let resolve!: (value: typeof user) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<typeof user>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function RouteContent() {
  const authenticated = useAuthStore((state) => state.isAuthenticated);
  return <div>{authenticated ? 'Protected content' : 'Login content'}</div>;
}

function startup() {
  return render(<StrictMode><AuthListener /><AuthGate><RouteContent /></AuthGate></StrictMode>);
}

describe('AuthGate startup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().clearLocalAuth();
    vi.mocked(signOut).mockResolvedValue();
  });
  afterEach(cleanup);

  it('holds routes until Amplify resolves and queries once during StrictMode replay', async () => {
    const lookup = deferredUser();
    vi.mocked(getCurrentUser).mockReturnValue(lookup.promise);
    startup();
    expect(screen.queryByText('Login content')).toBeNull();
    expect(screen.queryByText('Protected content')).toBeNull();
    expect(getCurrentUser).toHaveBeenCalledTimes(1);
    await act(async () => lookup.resolve(user));
    expect(screen.getByText('Protected content')).toBeTruthy();
    expect(screen.queryByText('Login content')).toBeNull();
  });

  it('releases unauthenticated routes when no SDK session exists', async () => {
    vi.mocked(getCurrentUser).mockRejectedValue(new Error('No authenticated user'));
    startup();
    expect(await screen.findByText('Login content')).toBeTruthy();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it.each(['signedOut', 'tokenRefresh_failure'] as const)('does not restore a session destroyed by %s while startup is pending', async (event) => {
    const lookup = deferredUser();
    vi.mocked(getCurrentUser).mockReturnValue(lookup.promise);
    startup();
    act(() => Hub.dispatch('auth', { event }));
    await act(async () => lookup.resolve(user));
    expect(screen.getByText('Login content')).toBeTruthy();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('lets explicit logout win before its SDK sign-out finishes', async () => {
    const lookup = deferredUser();
    vi.mocked(getCurrentUser).mockReturnValue(lookup.promise);
    vi.mocked(signOut).mockReturnValue(new Promise(() => {}));
    startup();
    act(() => { void useAuthStore.getState().logout(); });
    await act(async () => lookup.resolve(user));
    expect(screen.getByText('Login content')).toBeTruthy();
  });

  it('ignores a lookup that resolves after the gate unmounts', async () => {
    const lookup = deferredUser();
    vi.mocked(getCurrentUser).mockReturnValue(lookup.promise);
    const view = startup();
    view.unmount();
    await act(async () => lookup.resolve(user));
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('does not clear a newer sign-in when an older lookup rejects', async () => {
    const lookup = deferredUser();
    vi.mocked(getCurrentUser).mockReturnValue(lookup.promise);
    startup();
    act(() => useAuthStore.getState().setAuthenticated(true));
    await act(async () => lookup.reject(new Error('Older session expired')));
    expect(screen.getByText('Protected content')).toBeTruthy();
  });

  it.each(['signedOut', 'tokenRefresh_failure'] as const)('clears a resolved session on runtime %s', async (event) => {
    vi.mocked(getCurrentUser).mockResolvedValue(user);
    startup();
    expect(await screen.findByText('Protected content')).toBeTruthy();
    act(() => {
      Hub.dispatch('auth', { event });
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });
    expect(await screen.findByText('Login content')).toBeTruthy();
  });
});
