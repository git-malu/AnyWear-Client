import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signOut } from 'aws-amplify/auth';

vi.mock('aws-amplify/auth', () => ({ signOut: vi.fn() }));

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

  it('clears the mirror immediately and remains signed out if SDK sign-out fails', async () => {
    const { useAuthStore } = await import('./authStore');
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(signOut).mockRejectedValue(new Error('SDK sign-out failed'));
    useAuthStore.getState().setAuthenticated(true);
    const logout = useAuthStore.getState().logout();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    await logout;
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    error.mockRestore();
  });
});
