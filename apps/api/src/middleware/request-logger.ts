import type { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

/** Structured access logging. Logs only safe fields — never headers or bodies. */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  req.log = logger.child({ requestId: req.id });
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'http';
    req.log.log(level, 'request', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
      ip: req.ip,
    });
  });

  next();
}
