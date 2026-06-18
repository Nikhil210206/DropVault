import type { ApiErrorBody, PublicUser } from '@dropvault/shared';
import { API_URL } from './config';
import { useAuthStore } from '@/stores/auth-store';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  /** Skip the access token + refresh retry (used by the auth endpoints themselves). */
  auth?: boolean;
}

// Single in-flight refresh shared across concurrent 401s.
let refreshing: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, { method: 'POST', credentials: 'include' });
      if (!res.ok) return null;
      const data = (await res.json()) as { accessToken: string; user: PublicUser };
      useAuthStore.getState().setSession(data.user, data.accessToken);
      return data.accessToken;
    } catch {
      return null;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

async function parse<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = (data as ApiErrorBody | null)?.error;
    throw new ApiError(res.status, err?.code ?? 'UNKNOWN', err?.message ?? 'Request failed');
  }
  return data as T;
}

async function raw(path: string, opts: RequestOptions, token: string | null): Promise<Response> {
  return fetch(`${API_URL}${path}`, {
    method: opts.method ?? 'GET',
    credentials: 'include',
    headers: {
      ...(opts.body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

export async function apiFetch<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const useAuth = opts.auth !== false;
  let token = useAuth ? useAuthStore.getState().accessToken : null;

  let res = await raw(path, opts, token);

  // Transparently refresh the access token once on 401, then retry.
  if (res.status === 401 && useAuth) {
    token = await refreshAccessToken();
    if (!token) {
      useAuthStore.getState().clear();
      throw new ApiError(401, 'UNAUTHORIZED', 'Session expired');
    }
    res = await raw(path, opts, token);
  }

  return parse<T>(res);
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, body?: unknown, opts?: RequestOptions) => apiFetch<T>(path, { ...opts, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: 'PATCH', body }),
  del: <T>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
};
