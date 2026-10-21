import axios, { AxiosError, type AxiosRequestConfig } from 'axios';

/**
 * API client.
 *
 * - The access token lives only in memory (never localStorage); the refresh token is an
 *   HttpOnly cookie the browser sends to /api/auth/ automatically.
 * - Unsafe requests carry the CSRF token from the csrftoken cookie.
 * - On a 401 for an expired access token, one refresh is attempted (shared by all
 *   concurrent requests) and the original request is retried once.
 */

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: { Accept: 'application/json' },
});

let accessToken: string | null = null;
let onSessionLost: (() => void) | null = null;
let refreshInFlight: Promise<string | null> | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function onSessionExpired(handler: () => void) {
  onSessionLost = handler;
}

export function readCookie(name: string): string | null {
  const match = document.cookie.split('; ').find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split('=')[1]) : null;
}

const UNSAFE = new Set(['post', 'put', 'patch', 'delete']);

api.interceptors.request.use((config) => {
  if (accessToken && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  if (UNSAFE.has((config.method ?? 'get').toLowerCase())) {
    const csrf = readCookie('csrftoken');
    if (csrf) config.headers['X-CSRFToken'] = csrf;
  }
  return config;
});

export async function ensureCsrfCookie() {
  if (!readCookie('csrftoken')) await api.get('/auth/csrf/');
}

/** Exchange the refresh cookie for a new access token. Returns null when there is no valid session. */
export function refreshSession(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        await ensureCsrfCookie();
        const { data } = await api.post('/auth/refresh/', null, { headers: { Authorization: '' }, _skipRefresh: true } as AxiosRequestConfig);
        setAccessToken(data.access);
        return data.access as string;
      } catch {
        setAccessToken(null);
        return null;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

declare module 'axios' {
  interface AxiosRequestConfig {
    _skipRefresh?: boolean;
    _retried?: boolean;
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<{ code?: string }>) => {
    const config = error.config;
    const code = error.response?.data?.code;
    const expired = error.response?.status === 401 && (code === 'token_invalid' || code === 'not_authenticated');
    if (config && expired && accessToken && !config._skipRefresh && !config._retried) {
      const token = await refreshSession();
      if (token) {
        config._retried = true;
        config.headers.Authorization = `Bearer ${token}`;
        return api.request(config);
      }
      onSessionLost?.();
    }
    return Promise.reject(error);
  },
);
