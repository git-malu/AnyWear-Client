import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchAuthSession } from 'aws-amplify/auth';
import Axios from 'axios';
import { customInstance } from './custom-instance';

vi.mock('aws-amplify/auth', () => ({ fetchAuthSession: vi.fn() }));

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
