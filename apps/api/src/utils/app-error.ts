import { ErrorCode } from '@dropvault/shared';
import type { ApiErrorDetail } from '@dropvault/shared';

/**
 * Operational (expected) errors. Anything thrown that is NOT an AppError is treated
 * as an unexpected bug → 500 with a generic message in production.
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCode;
  readonly details?: ApiErrorDetail[];
  readonly isOperational = true;

  constructor(statusCode: number, code: ErrorCode, message: string, details?: ApiErrorDetail[]) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace?.(this, AppError);
  }

  static badRequest(message = 'Bad request', details?: ApiErrorDetail[]): AppError {
    return new AppError(400, ErrorCode.BAD_REQUEST, message, details);
  }
  static unauthorized(message = 'Unauthorized'): AppError {
    return new AppError(401, ErrorCode.UNAUTHORIZED, message);
  }
  static forbidden(message = 'Forbidden'): AppError {
    return new AppError(403, ErrorCode.FORBIDDEN, message);
  }
  static notFound(message = 'Not found'): AppError {
    return new AppError(404, ErrorCode.NOT_FOUND, message);
  }
  static conflict(message = 'Conflict'): AppError {
    return new AppError(409, ErrorCode.CONFLICT, message);
  }
  static gone(message = 'No longer available'): AppError {
    return new AppError(410, ErrorCode.GONE, message);
  }
  static payloadTooLarge(message = 'Payload too large'): AppError {
    return new AppError(413, ErrorCode.PAYLOAD_TOO_LARGE, message);
  }
  static tooManyRequests(message = 'Too many requests'): AppError {
    return new AppError(429, ErrorCode.RATE_LIMITED, message);
  }
  static internal(message = 'Internal server error'): AppError {
    return new AppError(500, ErrorCode.INTERNAL, message);
  }
}
