import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCurrentUser, signOut } from 'aws-amplify/auth';

vi.mock('aws-amplify/auth', () => ({ getCurrentUser: vi.fn(), signOut: vi.fn() }));

const PERSISTED_SESSION_KEYS = [
  'CognitoIdentityServiceProvider.mock-client-id.LastAuthUser',
  'CognitoIdentityServiceProvider.mock-client-id.test-user.accessToken',
  'CognitoIdentityServiceProvider.mock-client-id.test-user.idToken',
];

const user = { username: 'test-user', userId: 'test-user-id' };

function seedPersistedSession() {
  for (const key of PERSISTED_SESSION_KEYS) localStorage.setItem(key, 'persisted-value');
}

function persistedSessionKeys(): string[] {
  return PERSISTED_SESSION_KEYS.filter((key) => localStorage.getItem(key) !== null);
}

/** The SDK still finds a session: destruction cannot be verified. */
function sessionStillAvailable() {
  vi.mocked(getCurrentUser).mockResolvedValue(user);
}

/** The SDK finds no session: destruction is verified without any network call. */
function sessionDestroyed() {
  vi.mocked(getCurrentUser).mockRejectedValue(new Error('User needs to be authenticated to call this API.'));
}

describe('memory-only auth mirror', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('ignores a stale persisted UI flag without reading or writing storage', async () => {
    localStorage.setItem('isAuthenticated', 'true');
    const read = vi.spyOn(Storage.prototype, 'getItem');
    const write = vi.spyOn(Storage.prototype, 'setItem');
    const remove = vi.spyOn(Storage.prototype, 'removeItem');
    const { useAuthStore } = await import('./authStore');
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    useAuthStore.getState().setAuthenticated(true);
    useAuthStore.getState().clearLocalAuth();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(read).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('publishes no unauthenticated state until the SDK sign-out has destroyed the session', async () => {
    const { useAuthStore } = await import('./authStore');
    sessionDestroyed();
    useAuthStore.getState().setAuthenticated(true);
    seedPersistedSession();
    let finishSignOut!: () => void;
    vi.mocked(signOut).mockReturnValue(new Promise<void>((resolve) => { finishSignOut = resolve; }));

    const published: Array<{ isAuthenticated: boolean; isSigningOut: boolean }> = [];
    const unsubscribe = useAuthStore.subscribe((state) => {
      published.push({ isAuthenticated: state.isAuthenticated, isSigningOut: state.isSigningOut });
    });

    const logout = useAuthStore.getState().logout();
    let settled = false;
    void logout.then(() => { settled = true; });
    await Promise.resolve();

    // The mirror announces a pending sign-out and keeps reporting the session.
    expect(useAuthStore.getState().isSigningOut).toBe(true);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(settled).toBe(false);
    expect(published.every((state) => state.isAuthenticated)).toBe(true);
    expect(persistedSessionKeys()).toEqual(PERSISTED_SESSION_KEYS);

    finishSignOut();
    await logout;
    unsubscribe();

    expect(settled).toBe(true);
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(signOut).toHaveBeenNthCalledWith(1, { global: false });
    // The published logout is gated on the verification of the persisted session, not on the promise.
    expect(getCurrentUser).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().isSigningOut).toBe(false);
    expect(useAuthStore.getState().logoutError).toBeNull();
  });

  it('stays authenticated, reports the failure and never touches Amplify storage when destruction cannot be verified', async () => {
    const { useAuthStore } = await import('./authStore');
    sessionStillAvailable();
    useAuthStore.getState().setAuthenticated(true);
    seedPersistedSession();
    localStorage.setItem('unrelated-app-state', 'keep-me');
    vi.mocked(signOut).mockRejectedValue(new Error('SDK sign-out failed'));

    await expect(useAuthStore.getState().logout()).rejects.toThrow(/Sign-out could not be verified/);

    // One bounded retry, both attempts on the local scope: a global sign-out is a product change.
    expect(signOut).toHaveBeenCalledTimes(2);
    expect(signOut).toHaveBeenNthCalledWith(1, { global: false });
    expect(signOut).toHaveBeenNthCalledWith(2, { global: false });
    expect(getCurrentUser).toHaveBeenCalledTimes(2);

    // No logged-out UI on an unverified sign-out, and no storage surgery either: the SDK owns the
    // session keys, and the failure is surfaced instead of being swallowed.
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().isSigningOut).toBe(false);
    expect(useAuthStore.getState().logoutError).toContain('still signed in');
    expect(useAuthStore.getState().logoutError).toContain('SDK sign-out failed');
    expect(persistedSessionKeys()).toEqual(PERSISTED_SESSION_KEYS);
    expect(localStorage.getItem('unrelated-app-state')).toBe('keep-me');
  });

  it('retries once on the local scope and reports the logout only after the retry destroyed the session', async () => {
    const { useAuthStore } = await import('./authStore');
    useAuthStore.getState().setAuthenticated(true);
    vi.mocked(signOut).mockResolvedValue();
    vi.mocked(getCurrentUser)
      .mockResolvedValueOnce(user)
      .mockRejectedValue(new Error('User needs to be authenticated to call this API.'));

    await useAuthStore.getState().logout();

    expect(signOut).toHaveBeenCalledTimes(2);
    expect(signOut).toHaveBeenNthCalledWith(2, { global: false });
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().isSigningOut).toBe(false);
    expect(useAuthStore.getState().logoutError).toBeNull();
  });

  it('drops a stale sign-out failure once a new session is established', async () => {
    const { useAuthStore } = await import('./authStore');
    sessionStillAvailable();
    vi.mocked(signOut).mockRejectedValue(new Error('SDK sign-out failed'));
    await expect(useAuthStore.getState().logout()).rejects.toThrow(/Sign-out could not be verified/);
    expect(useAuthStore.getState().logoutError).not.toBeNull();

    useAuthStore.getState().setAuthenticated(true);

    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().logoutError).toBeNull();
  });
});
