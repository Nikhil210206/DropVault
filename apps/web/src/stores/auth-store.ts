import { create } from 'zustand';
import type { PublicUser } from '@dropvault/shared';

type Status = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthState {
  user: PublicUser | null;
  accessToken: string | null;
  status: Status;
  setSession: (user: PublicUser, accessToken: string) => void;
  setToken: (accessToken: string) => void;
  setUser: (user: PublicUser) => void;
  setStatus: (status: Status) => void;
  clear: () => void;
}

// Access token lives in memory only (never localStorage) — it's restored on load via the
// httpOnly refresh cookie, which keeps it out of reach of XSS.
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  status: 'loading',
  setSession: (user, accessToken) => set({ user, accessToken, status: 'authenticated' }),
  setToken: (accessToken) => set({ accessToken }),
  setUser: (user) => set({ user }),
  setStatus: (status) => set({ status }),
  clear: () => set({ user: null, accessToken: null, status: 'unauthenticated' }),
}));
