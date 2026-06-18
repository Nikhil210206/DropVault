import { PrismaClient } from '@prisma/client';
import { env } from './env';
import { logger } from './logger';

const createPrisma = (): PrismaClient =>
  new PrismaClient({
    // Quiet in tests (expected constraint violations are asserted, not bugs).
    log: env.isTest ? [] : env.isDevelopment ? ['warn', 'error'] : ['error'],
  });

// Reuse a single client across hot-reloads in dev to avoid exhausting DB connections.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrisma();

if (!env.isProduction) globalForPrisma.prisma = prisma;

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
  logger.info('Prisma disconnected');
}
