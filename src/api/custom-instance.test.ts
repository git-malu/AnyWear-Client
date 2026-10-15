import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchAuthSession, signOut } from 'aws-amplify/auth';
import Axios from 'axios';
import { customInstance } from './custom-instance';
import { useAuthStore } from '../store/authStore';

vi.mock('aws-amplify/auth', () => ({ fetchAuthSession: vi.fn(), signOut: vi.fn() }));

function response(config: InternalAxiosRequestConfig): AxiosResponse<{ ok: true }> {
  return {
    data: { ok: true },
    status: 202,
    statusText: 'Accepted',
    headers: {},
    config,
  };
}

describe('customInstance idempotency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchAuthSession).mockResolvedValue({} as Awaited<ReturnType<typeof fetchAuthSession>>);
  });

  it('reuses one key for an automatic network retry', async () => {
    const keys: string[] = [];
    const adapter: AxiosAdapter = async (config) => {
      keys.push(String(config.headers.get('Idempotency-Key')));
      if (keys.length === 1) {
        throw new Axios.AxiosError('connection reset', 'ERR_NETWORK', config);
      }
      return response(config);
    };

    await expect(customInstance<{ ok: true }>({
      url: '/vto/generations',
      method: 'POST',
      data: { outfit_id: 'outfit-1' },
    }, { adapter })).resolves.toEqual({ ok: true });

    expect(keys).toHaveLength(2);
    expect(keys[0]).toMatch(/^[0-9a-f-]{36}$/);
    expect(keys[1]).toBe(keys[0]);
  });

  it('creates a new key for each new logical operation', async () => {
    const keys: string[] = [];
    const adapter: AxiosAdapter = async (config) => {
      keys.push(String(config.headers.get('Idempotency-Key')));
      return response(config);
    };

    await customInstance({ url: '/wardrobe/upload', method: 'POST' }, { adapter });
    await customInstance({ url: '/wardrobe/upload', method: 'POST' }, { adapter });

    expect(keys[0]).not.toBe(keys[1]);
  });

  it('does not add a key to unrelated requests', async () => {
    let key: unknown;
    const adapter: AxiosAdapter = async (config) => {
      key = config.headers.get('Idempotency-Key');
      return response(config);
    };

    await customInstance({ url: '/wardrobe', method: 'GET' }, { adapter });

    expect(key).toBeUndefined();
  });
});

describe('customInstance authentication', () => {
  const persistedSessionKey = 'CognitoIdentityServiceProvider.mock-client-id.test-user.accessToken';

  it('finishes SDK sign-out before a 401 forces navigation', async () => {
    vi.clearAllMocks();
    vi.mocked(fetchAuthSession).mockResolvedValue({});
    let finishSignOut!: () => void;
    vi.mocked(signOut).mockReturnValue(new Promise<void>(resolve => { finishSignOut = resolve; }));
    const location = { pathname: '/wardrobe', href: '' };
    vi.stubGlobal('window', { location });
    useAuthStore.getState().setAuthenticated(true);
    localStorage.setItem(persistedSessionKey, 'access-token');
    const adapter: AxiosAdapter = async (config) => {
      throw new Axios.AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, undefined, {
        ...response(config), status: 401,
      });
    };
    try {
      const request = customInstance({ url: '/users/me', method: 'GET' }, { adapter });
      const rejection = expect(request).rejects.toThrow('Unauthorized');
      await vi.waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
      // The session is only reported as gone once the persisted tokens are gone and navigation runs.
      expect(useAuthStore.getState().isSigningOut).toBe(true);
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      expect(localStorage.getItem(persistedSessionKey)).toBe('access-token');
      expect(location.href).toBe('');
      finishSignOut();
      await rejection;
      expect(localStorage.getItem(persistedSessionKey)).toBeNull();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(location.href).toBe('/login');
    } finally {
      vi.unstubAllGlobals();
      localStorage.clear();
    }
  });

  it('clears the persisted session and still navigates when the 401 sign-out rejects', async () => {
    vi.clearAllMocks();
    vi.mocked(fetchAuthSession).mockResolvedValue({});
    vi.mocked(signOut).mockRejectedValue(new Error('SDK sign-out failed'));
    const location = { pathname: '/wardrobe', href: '' };
    vi.stubGlobal('window', { location });
    useAuthStore.getState().setAuthenticated(true);
    localStorage.setItem(persistedSessionKey, 'access-token');
    const adapter: AxiosAdapter = async (config) => {
      throw new Axios.AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, undefined, {
        ...response(config), status: 401,
      });
    };
    try {
      await expect(customInstance({ url: '/users/me', method: 'GET' }, { adapter }))
        .rejects.toThrow('Unauthorized');
      expect(signOut).toHaveBeenCalledTimes(1);
      expect(localStorage.getItem(persistedSessionKey)).toBeNull();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useAuthStore.getState().logoutError).toBe('SDK sign-out failed');
      expect(location.href).toBe('/login');
    } finally {
      vi.unstubAllGlobals();
      localStorage.clear();
      useAuthStore.setState({ isAuthenticated: false, isSigningOut: false, logoutError: null });
    }
  });

  it('resolves the current SDK token for every request instead of caching it', async () => {
    vi.clearAllMocks();
    const session = (token: string) => ({
      tokens: { accessToken: { toString: () => token } },
    }) as Awaited<ReturnType<typeof fetchAuthSession>>;
    vi.mocked(fetchAuthSession)
      .mockResolvedValueOnce(session('first-token'))
      .mockResolvedValueOnce(session('refreshed-token'));
    const headers: unknown[] = [];
    const adapter: AxiosAdapter = async (config) => {
      headers.push(config.headers.get('Authorization'));
      return response(config);
    };
    await customInstance({ url: '/users/me', method: 'GET' }, { adapter });
    await customInstance({ url: '/wardrobe', method: 'GET' }, { adapter });
    expect(fetchAuthSession).toHaveBeenCalledTimes(2);
    expect(headers).toEqual(['Bearer first-token', 'Bearer refreshed-token']);
  });
});
