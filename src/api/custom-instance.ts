import Axios, { AxiosError, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';
import { fetchAuthSession } from 'aws-amplify/auth';
import { useAuthStore } from '../store/authStore';

export const AXIOS_INSTANCE = Axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000' });

interface RetriableRequestConfig extends InternalAxiosRequestConfig {
  anywearNetworkRetry?: boolean;
}

function isAsyncTaskCreationRequest(config: InternalAxiosRequestConfig): boolean {
  if (config.method?.toUpperCase() !== 'POST' || !config.url) return false;
  const path = new URL(config.url, 'http://anywear.local').pathname;
  return path === '/vto/generations'
    || path === '/wardrobe/upload'
    || /^\/wardrobe\/items\/[^/]+\/retag$/.test(path);
}

function hasIdempotencyKey(config: InternalAxiosRequestConfig): boolean {
  return typeof config.headers.get('Idempotency-Key') === 'string';
}

/**
 * The 401 path must redirect even if the SDK sign-out never settles, so its wait on `logout()` is
 * bounded. Exported so the bound can be asserted instead of duplicated in tests.
 */
export const LOGOUT_REDIRECT_CEILING_MS = 10_000;

/** Resolve when the operation settles or when the ceiling elapses, whichever happens first. */
function settleWithin(operation: Promise<unknown>, timeoutMs: number): Promise<void> {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, timeoutMs);
    const finish = () => {
      clearTimeout(timer);
      resolve();
    };
    void operation.then(finish, finish);
  });
}

AXIOS_INSTANCE.interceptors.request.use(
  async (config) => {
    if (isAsyncTaskCreationRequest(config) && !hasIdempotencyKey(config)) {
      config.headers.set('Idempotency-Key', crypto.randomUUID());
    }
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.accessToken?.toString();
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.debug('No active auth session', error);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

AXIOS_INSTANCE.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      const currentPath = window.location.pathname;
      if (currentPath !== '/login' && currentPath !== '/register') {
        // logout() now waits for the SDK sign-out and its verification before it reports the session
        // as gone, so this path bounds that wait: a stalled sign-out must never keep a 401 response
        // from redirecting. A sign-out that cannot be verified stays in the store's logoutError.
        await settleWithin(useAuthStore.getState().logout(), LOGOUT_REDIRECT_CEILING_MS);
        window.location.href = '/login';
      }
    }
    const config = error.config as RetriableRequestConfig | undefined;
    if (
      !error.response
      && config
      && hasIdempotencyKey(config)
      && !config.anywearNetworkRetry
      && !Axios.isCancel(error)
    ) {
      config.anywearNetworkRetry = true;
      return AXIOS_INSTANCE.request(config);
    }
    return Promise.reject(error);
  }
);

export const customInstance = <T>(
  config: AxiosRequestConfig,
  options?: AxiosRequestConfig,
): Promise<T> => {
  const source = Axios.CancelToken.source();
  const promise = AXIOS_INSTANCE({
    ...config,
    ...options,
    cancelToken: source.token,
  }).then((response) => response.data as unknown as T);

  // @ts-expect-error cancel property on promise
  promise.cancel = () => {
    source.cancel('Query was cancelled');
  };

  return promise;
};
