import type { AuthResponse, LoginInput, RegisterInput } from '@dropvault/shared';
import { api } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';

export async function login(input: LoginInput): Promise<void> {
  const res = await api.post<AuthResponse>('/auth/login', input, { auth: false });
  useAuthStore.getState().setSession(res.user, res.accessToken);
}

export async function register(input: RegisterInput): Promise<void> {
  const res = await api.post<AuthResponse>('/auth/register', input, { auth: false });
  useAuthStore.getState().setSession(res.user, res.accessToken);
}

export async function logout(): Promise<void> {
  await api.post('/auth/logout', undefined, { auth: false }).catch(() => undefined);
  useAuthStore.getState().clear();
}

/** Restore the session on app load using the httpOnly refresh cookie. */
export async function bootstrap(): Promise<void> {
  const store = useAuthStore.getState();
  try {
    const res = await api.post<AuthResponse>('/auth/refresh', undefined, { auth: false });
    store.setSession(res.user, res.accessToken);
  } catch {
    store.clear();
  }
}
