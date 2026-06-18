import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { Express } from 'express';
import { FileStatus } from '@prisma/client';
import { prisma } from '../config/db';
import { redis } from '../config/redis';

// Child tables first so TRUNCATE … CASCADE has nothing dangling; RESTART IDENTITY resets seqs.
const TABLES = [
  'downloads',
  'audit_logs',
  'upload_parts',
  'upload_sessions',
  'shares',
  'files',
  'folders',
  'verification_tokens',
  'refresh_tokens',
  'users',
];

/** Wipe all app data and the test Redis logical DB between tests. */
export async function resetDb(): Promise<void> {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${TABLES.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`,
  );
  await redis.flushdb();
}

/** Registers a user through the real endpoint and returns the token, user, and refresh cookie. */
export async function registerUser(
  app: Express,
  email = `u_${randomUUID()}@dropvault.test`,
): Promise<{ token: string; user: { id: string; email: string }; cookie: string }> {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ email, name: 'Test User', password: 'Secret123' });
  const setCookie = (res.headers['set-cookie'] as unknown as string[] | undefined) ?? [];
  return {
    token: res.body.accessToken as string,
    user: res.body.user as { id: string; email: string },
    cookie: (setCookie[0] ?? '').split(';')[0] ?? '',
  };
}

/** Inserts a READY file row directly (no S3) for tests that only need a shareable target. */
export function createReadyFile(userId: string, folderId: string | null = null, name = 'file.bin') {
  return prisma.file.create({
    data: {
      userId,
      folderId,
      name,
      originalName: name,
      mimeType: 'application/octet-stream',
      size: 1024n,
      storageKey: `users/${userId}/files/${randomUUID()}/source`,
      status: FileStatus.READY,
    },
  });
}
