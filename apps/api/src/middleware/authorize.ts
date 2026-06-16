import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/app-error';

/** Restricts a route to the given roles. Must run after `authenticate`. */
export function authorize(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(AppError.unauthorized());
    if (!roles.includes(req.user.role)) return next(AppError.forbidden('Insufficient permissions'));
    next();
  };
}
