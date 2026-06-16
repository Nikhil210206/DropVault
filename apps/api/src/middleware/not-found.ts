import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/app-error';

/** Terminal 404 for unmatched routes — forwards to the central error handler. */
export function notFound(req: Request, _res: Response, next: NextFunction): void {
  next(AppError.notFound(`Route not found: ${req.method} ${req.path}`));
}
