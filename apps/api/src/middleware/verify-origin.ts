import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/app-error';
import { env } from '../config/env';

/**
 * CSRF defense for cookie-authenticated, state-changing routes (refresh/logout).
 * The refresh cookie is sent automatically by browsers, so we reject requests whose
 * Origin/Referer isn't in our allowlist. Non-browser clients (no Origin header, e.g.
 * curl / server-to-server) are allowed — they don't carry ambient cookies.
 */
export function verifyOrigin(req: Request, _res: Response, next: NextFunction): void {
  const source = req.get('origin') ?? req.get('referer');
  if (!source) return next();

  const allowed = env.CORS_ORIGINS.some((o) => source === o || source.startsWith(`${o}/`));
  if (!allowed) return next(AppError.forbidden('Request origin not allowed'));
  next();
}
