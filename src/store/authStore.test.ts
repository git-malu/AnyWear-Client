import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signOut } from 'aws-amplify/auth';

vi.mock('aws-amplify/auth', () => ({ signOut: vi.fn() }));

const PERSISTED_SESSION_KEYS = [
  'CognitoIdentityServiceProvider.mock-client-id.LastAuthUser',
  'CognitoIdentityServiceProvider.mock-client-id.test-user.accessToken',
  'CognitoIdentityServiceProvider.mock-client-id.test-user.idToken',
];

function seedPersistedSession() {
  for (const key of PERSISTED_SESSION_KEYS) localStorage.setItem(key, 'persisted-value');
}

function persistedSessionKeys(): string[] {
  return PERSISTED_SESSION_KEYS.filter((key) => localStorage.getItem(key) !== null);
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

  it('resolves only after sign-out settled, with the persisted session removed', async () => {
    const { useAuthStore } = await import('./authStore');
    useAuthStore.getState().setAuthenticated(true);
    seedPersistedSession();
    let finishSignOut!: () => void;
    vi.mocked(signOut).mockReturnValue(new Promise<void>((resolve) => { finishSignOut = resolve; }));

    const logout = useAuthStore.getState().logout();
    let settled = false;
    void logout.then(() => { settled = true; });

    // The mirror reports an in-flight sign-out instead of a completed logout.
    expect(useAuthStore.getState().isSigningOut).toBe(true);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(persistedSessionKeys()).toEqual(PERSISTED_SESSION_KEYS);

    finishSignOut();
    await logout;

    expect(settled).toBe(true);
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(persistedSessionKeys()).toEqual([]);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().isSigningOut).toBe(false);
    expect(useAuthStore.getState().logoutError).toBeNull();
  });

  it('clears the persisted session and reports the failure when sign-out rejects', async () => {
    const { useAuthStore } = await import('./authStore');
    useAuthStore.getState().setAuthenticated(true);
    seedPersistedSession();
    localStorage.setItem('unrelated-app-state', 'keep-me');
    vi.mocked(signOut).mockRejectedValue(new Error('SDK sign-out failed'));

    await expect(useAuthStore.getState().logout()).rejects.toThrow('SDK sign-out failed');

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(persistedSessionKeys()).toEqual([]);
    expect(localStorage.getItem('unrelated-app-state')).toBe('keep-me');
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().isSigningOut).toBe(false);
    expect(useAuthStore.getState().logoutError).toBe('SDK sign-out failed');
  });

  it('drops a stale sign-out failure once a new session is established', async () => {
    const { useAuthStore } = await import('./authStore');
    vi.mocked(signOut).mockRejectedValue(new Error('SDK sign-out failed'));
    await expect(useAuthStore.getState().logout()).rejects.toThrow('SDK sign-out failed');
    expect(useAuthStore.getState().logoutError).toBe('SDK sign-out failed');

    useAuthStore.getState().setAuthenticated(true);

    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().logoutError).toBeNull();
  });
});
