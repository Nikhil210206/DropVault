import type { Response } from 'express';
import { env } from '../config/env';

export const REFRESH_COOKIE = 'dv_rt';

// Scope the cookie to the auth routes only, so it's never sent to other endpoints.
const REFRESH_PATH = `${env.API_PREFIX}/auth`;

// In prod the web app and API are on different sites → SameSite=None; Secure is required
// for the cookie to be sent cross-site (paired with the verifyOrigin CSRF guard).
// Locally (same-site http) we use Lax so the cookie works without HTTPS.
const sameSite = env.isProduction ? 'none' : 'lax';

export function setRefreshCookie(res: Response, token: string, maxAgeMs: number): void {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite,
    path: REFRESH_PATH,
    maxAge: maxAgeMs,
  });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite,
    path: REFRESH_PATH,
  });
}
