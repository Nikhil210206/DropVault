import type { ErrorRequestHandler, Response } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { ErrorCode } from '@dropvault/shared';
import type { ApiErrorBody, ApiErrorDetail } from '@dropvault/shared';
import { AppError } from '../utils/app-error';
import { env } from '../config/env';

function send(
  res: Response,
  requestId: string,
  status: number,
  code: ErrorCode,
  message: string,
  details?: ApiErrorDetail[],
): void {
  const body: ApiErrorBody = {
    error: { code, message, requestId, ...(details ? { details } : {}) },
  };
  res.status(status).json(body);
}

/**
 * Central error handler. Maps known error shapes to the canonical envelope and
 * hides internal details for unexpected errors in production.
 */
// The 4-arg signature is what marks this as Express' error handler (_next is required).
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const requestId = req.id;

  if (err instanceof AppError) {
    send(res, requestId, err.statusCode, err.code, err.message, err.details);
    return;
  }

  if (err instanceof ZodError) {
    const details: ApiErrorDetail[] = err.issues.map((i) => ({
      path: i.path.join('.'),
      message: i.message,
    }));
    send(res, requestId, 422, ErrorCode.VALIDATION_ERROR, 'Validation failed', details);
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      send(res, requestId, 409, ErrorCode.CONFLICT, 'Resource already exists');
      return;
    }
    if (err.code === 'P2025') {
      send(res, requestId, 404, ErrorCode.NOT_FOUND, 'Resource not found');
      return;
    }
  }

  // Unexpected: log full detail, return a generic message.
  req.log?.error('Unhandled error', {
    err:
      err instanceof Error
        ? { name: err.name, message: err.message, stack: err.stack }
        : String(err),
  });

  const message = env.isProduction
    ? 'Internal server error'
    : String((err as Error)?.message ?? err);
  send(res, requestId, 500, ErrorCode.INTERNAL, message);
};
