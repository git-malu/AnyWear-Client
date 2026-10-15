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
  const signingOut = useAuthStore((state) => state.isSigningOut);
  return <div>{authenticated ? 'Protected content' : signingOut ? 'Signing out' : 'Login content'}</div>;
}

function startup() {
  return render(<StrictMode><AuthListener /><AuthGate><RouteContent /></AuthGate></StrictMode>);
}

describe('AuthGate startup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ isAuthenticated: false, isSigningOut: false, logoutError: null });
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

  it('lets explicit logout win before its SDK sign-out finishes without reporting it as complete', async () => {
    const lookup = deferredUser();
    vi.mocked(getCurrentUser).mockReturnValue(lookup.promise);
    let finishSignOut!: () => void;
    vi.mocked(signOut).mockReturnValue(new Promise<void>((resolve) => { finishSignOut = resolve; }));
    startup();

    let logout!: Promise<void>;
    act(() => { logout = useAuthStore.getState().logout(); });
    await act(async () => lookup.resolve(user));

    // The explicit logout beats the slower startup lookup, but the session is only reported as gone
    // once the SDK sign-out settles, so the UI cannot advertise a logout that is not durable yet.
    expect(screen.queryByText('Protected content')).toBeNull();
    expect(screen.getByText('Signing out')).toBeTruthy();
    expect(useAuthStore.getState().isSigningOut).toBe(true);

    await act(async () => { finishSignOut(); await logout; });

    expect(screen.getByText('Login content')).toBeTruthy();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().isSigningOut).toBe(false);
    expect(signOut).toHaveBeenCalledTimes(1);
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
