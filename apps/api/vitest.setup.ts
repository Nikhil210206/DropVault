import { config } from 'dotenv';
import { afterAll, beforeEach } from 'vitest';

// Point every module at the test DB/Redis before app code reads env.
config({ path: '.env.test', override: true });

// Reset state before each test. Imports are deferred so they read the test env above.
beforeEach(async () => {
  const { resetDb } = await import('./src/tests/helpers');
  await resetDb();
});

afterAll(async () => {
  const { prisma } = await import('./src/config/db');
  const { redis } = await import('./src/config/redis');
  await prisma.$disconnect();
  redis.disconnect();
});
