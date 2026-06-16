import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

const HEADER = 'x-request-id';

/** Assigns a stable correlation id to each request and echoes it back. */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header(HEADER);
  req.id = incoming && incoming.length <= 200 ? incoming : randomUUID();
  res.setHeader(HEADER, req.id);
  next();
}
