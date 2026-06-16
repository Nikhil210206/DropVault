import type { Request, Response, NextFunction } from 'express';
import type { ZodTypeAny } from 'zod';

interface Schemas {
  body?: ZodTypeAny;
  params?: ZodTypeAny;
  query?: ZodTypeAny;
}

/**
 * Validates + coerces request parts against Zod schemas. On success the parsed values
 * replace the originals (body/params are writable); validated query is attached to
 * `req.validatedQuery` because Express 5 makes `req.query` read-only. A ZodError
 * propagates to the central error handler, which renders it as a 422 envelope.
 */
export function validate(schemas: Schemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (schemas.params) req.params = schemas.params.parse(req.params) as typeof req.params;
      if (schemas.body) req.body = schemas.body.parse(req.body);
      if (schemas.query) req.validatedQuery = schemas.query.parse(req.query);
      next();
    } catch (err) {
      next(err);
    }
  };
}
