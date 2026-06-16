import rateLimit, { type Options } from 'express-rate-limit';
import type { RequestHandler, NextFunction } from 'express';
import { RedisStore } from 'rate-limit-redis';
import { ErrorCode } from '@dropvault/shared';
import { env } from '../config/env';
import { redis } from '../config/redis';

/**
 * Factory for Redis-backed rate limiters so counters are shared across every API
 * instance (in-memory limits would reset per pod and be trivially bypassed).
 */
export function createRateLimiter(name: string, overrides: Partial<Options> = {}): RequestHandler {
  return rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    limit: env.RATE_LIMIT_MAX,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    store: new RedisStore({
      // Forward raw commands to ioredis. The runtime spreads all args; the cast
      // satisfies ioredis' overloaded `call` signature.
      sendCommand: (...args: string[]) => redis.call(...(args as [string])) as Promise<never>,
      // Distinct prefix per limiter, so independent limiters never share a counter
      // (a shared key would make the strictest limit apply to the combined traffic).
      prefix: `rl:${name}:`,
    }),
    handler: (req, res) => {
      res.status(429).json({
        error: {
          code: ErrorCode.RATE_LIMITED,
          message: 'Too many requests, please try again later.',
          requestId: req.id,
        },
      });
    },
    ...overrides,
  });
}

/**
 * Wraps a limiter so a store (Redis) outage fails OPEN: rate limiting is best-effort,
 * so if the backing store is unreachable we log and allow the request through rather
 * than 500-ing the entire API. The limiter only calls `next(err)` on store errors —
 * over-limit requests are answered by `handler` and never reach here.
 */
export function failOpen(limiter: RequestHandler): RequestHandler {
  return (req, res, next) => {
    const onDone: NextFunction = (err?: unknown) => {
      if (err) {
        req.log?.warn('Rate limiter store unavailable; allowing request (fail-open)', {
          err: err instanceof Error ? err.message : String(err),
        });
        next();
        return;
      }
      next();
    };
    limiter(req, res, onDone);
  };
}

/** Global limiter applied to the whole versioned API surface (fail-open on store errors). */
export const globalRateLimiter: RequestHandler = failOpen(createRateLimiter('global'));
