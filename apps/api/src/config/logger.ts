import winston from 'winston';
import { env } from './env';

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'token',
  'tokenhash',
  'accesstoken',
  'refreshtoken',
  'authorization',
  'cookie',
  'set-cookie',
  'secret',
  'apikey',
]);

/** Recursively redact sensitive values; never log secrets or signed S3 URLs. */
function redactValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.includes('X-Amz-Signature') ? '[REDACTED_SIGNED_URL]' : value;
  }
  if (Array.isArray(value)) return value.map(redactValue);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = SENSITIVE_KEYS.has(k.toLowerCase()) ? '[REDACTED]' : redactValue(v);
    }
    return out;
  }
  return value;
}

// Mutates the winston info object in place (preserves its internal symbols).
const redactFormat = winston.format((info) => {
  const record = info as unknown as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (key === 'level' || key === 'message') continue;
    record[key] = SENSITIVE_KEYS.has(key.toLowerCase()) ? '[REDACTED]' : redactValue(record[key]);
  }
  return info;
})();

const devFormat = winston.format.combine(
  redactFormat,
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss.SSS' }),
  winston.format.printf((info) => {
    const { timestamp, level, message, ...meta } = info;
    const rest = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp as string} ${level} ${message as string}${rest}`;
  }),
);

const prodFormat = winston.format.combine(
  redactFormat,
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

export const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  format: env.isProduction ? prodFormat : devFormat,
  transports: [new winston.transports.Console()],
});

export type Logger = winston.Logger;
