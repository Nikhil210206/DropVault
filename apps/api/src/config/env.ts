import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

// Load .env from the current working directory (apps/api during dev).
loadEnv();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  API_PREFIX: z.string().startsWith('/').default('/api/v1'),

  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url().optional(),

  REDIS_URL: z.string().url(),

  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000')
    .transform((s) =>
      s
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean),
    ),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),

  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'debug']).default('info'),

  // ── Auth (JWT, EdDSA) — keys are base64-encoded PEM ──
  JWT_PRIVATE_KEY: z.string().min(1),
  JWT_PUBLIC_KEY: z.string().min(1),
  JWT_KID: z.string().default('dev-1'),
  JWT_ISSUER: z.string().default('dropvault'),
  JWT_AUDIENCE: z.string().default('dropvault-api'),
  ACCESS_TOKEN_TTL: z.coerce.number().int().positive().default(900), // seconds
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),

  // ── Email + web ──
  WEB_URL: z.string().url().default('http://localhost:3000'),
  MAIL_FROM: z.string().min(1).default('DropVault <no-reply@dropvault.local>'),
  MAIL_TRANSPORT: z.enum(['smtp', 'resend']).default('smtp'),
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  RESEND_API_KEY: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Fail fast and loud — a misconfigured service must never boot.
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('\n');
  console.error(`\n❌ Invalid environment variables:\n${issues}\n`);
  process.exit(1);
}

export const env = {
  ...parsed.data,
  isProduction: parsed.data.NODE_ENV === 'production',
  isDevelopment: parsed.data.NODE_ENV === 'development',
  isTest: parsed.data.NODE_ENV === 'test',
};

export type Env = typeof env;
