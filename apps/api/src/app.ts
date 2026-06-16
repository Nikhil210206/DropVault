import './utils/bigint';

import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { ErrorCode } from '@dropvault/shared';

import { env } from './config/env';
import { requestId } from './middleware/request-id';
import { requestLogger } from './middleware/request-logger';
import { globalRateLimiter } from './middleware/rate-limit';
import { errorHandler } from './middleware/error-handler';
import { notFound } from './middleware/not-found';
import { healthRouter } from './modules/health/health.routes';
import { apiRouter } from './routes';
import { mountSwagger } from './docs/swagger';
import { AppError } from './utils/app-error';

export function createApp(): Express {
  const app = express();

  // Behind a proxy (Render/Vercel) so req.ip and rate-limit see the real client IP.
  app.set('trust proxy', env.TRUST_PROXY);
  app.disable('x-powered-by');

  // Security headers.
  app.use(helmet());

  // CORS: exact-origin allowlist with credentials (refresh-token cookie).
  app.use(
    cors({
      origin(origin, cb) {
        // Allow non-browser clients (no Origin header) and configured origins only.
        if (!origin || env.CORS_ORIGINS.includes(origin)) return cb(null, true);
        cb(new AppError(403, ErrorCode.FORBIDDEN, 'Origin not allowed by CORS'));
      },
      credentials: true,
    }),
  );

  // Body parsing with a sane limit — file bytes never flow through here (they go to S3).
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser());

  // Observability.
  app.use(requestId);
  app.use(requestLogger);

  // Health checks live outside the versioned API and are not rate-limited.
  app.use('/health', healthRouter);

  // Interactive API docs.
  mountSwagger(app);

  // Versioned API surface, rate-limited.
  app.use(env.API_PREFIX, globalRateLimiter, apiRouter);

  // Fallbacks (order matters: 404 before the error handler).
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
