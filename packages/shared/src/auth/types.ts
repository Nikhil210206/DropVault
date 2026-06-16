/** User shape safe to return to clients. Byte counters are strings (BigInt in the DB). */
export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: 'USER' | 'ADMIN';
  emailVerified: boolean;
  storageUsed: string;
  storageQuota: string;
  createdAt: string;
}

/** Returned by register/login/refresh. The refresh token rides in an httpOnly cookie. */
export interface AuthResponse {
  user: PublicUser;
  accessToken: string;
}
