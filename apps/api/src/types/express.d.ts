import type { Logger } from 'winston';

declare global {
  namespace Express {
    interface Request {
      /** Correlation id assigned per request and echoed in the X-Request-Id header. */
      id: string;
      /** Request-scoped child logger pre-tagged with the request id. */
      log: Logger;
      /** Authenticated principal, set by the `authenticate` middleware. */
      user?: { id: string; role: string; email: string };
      /** Parsed query from `validate({ query })` (Express 5 makes `req.query` read-only). */
      validatedQuery?: unknown;
    }
  }
}

export {};
