import type { ErrorCode } from './error-codes';

/** A single field-level validation issue. */
export interface ApiErrorDetail {
  path: string;
  message: string;
}

/** The canonical error envelope returned by every endpoint on failure. */
export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    details?: ApiErrorDetail[];
    requestId: string;
  };
}

/** Cursor-based pagination metadata. */
export interface PageInfo {
  nextCursor: string | null;
  hasMore: boolean;
}

/** A paginated list response. */
export interface Paginated<T> {
  data: T[];
  pageInfo: PageInfo;
}
