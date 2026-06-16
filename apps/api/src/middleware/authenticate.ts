import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/app-error';
import { verifyAccessToken } from '../services/jwt.service';

/** Requires a valid Bearer access token; attaches the principal to `req.user`. */
export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.header('authorization');
    if (!header?.startsWith('Bearer ')) {
      throw AppError.unauthorized('Missing or malformed Authorization header');
    }
    const claims = await verifyAccessToken(header.slice('Bearer '.length).trim());
    req.user = { id: claims.sub, role: claims.role, email: claims.email };
    next();
  } catch (err) {
    if (err instanceof AppError) return next(err);
    next(AppError.unauthorized('Invalid or expired access token'));
  }
}
