import Axios, { AxiosError, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';
import { fetchAuthSession } from 'aws-amplify/auth';
import { CLIENT_VERSION, CLIENT_VERSION_HEADER } from '../lib/client-version';
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

AXIOS_INSTANCE.interceptors.request.use(
  async (config) => {
    // Every request states the Client version, authenticated or not, so the
    // Service can reject an incompatible Client before it does any work.
    config.headers.set(CLIENT_VERSION_HEADER, String(CLIENT_VERSION));
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
        // logout() destroys the persisted session even when the SDK sign-out rejects and records
        // that failure in the store; this interceptor still forces the redirect.
        await useAuthStore.getState().logout().catch(() => undefined);
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
