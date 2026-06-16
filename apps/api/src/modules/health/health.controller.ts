import type { Request, Response } from 'express';
import { prisma } from '../../config/db';
import { redis } from '../../config/redis';

/** Liveness — the process is up. No external deps, so a Redis blip can't kill the pod. */
export function live(_req: Request, res: Response): void {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
}

/**
 * Bounds a dependency check so readiness fails fast: a slow or unreachable dependency
 * reports `down` within the timeout instead of hanging the probe.
 */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms).unref()),
  ]);
}

/** Readiness — can we actually serve traffic? Checks critical dependencies. */
export async function ready(_req: Request, res: Response): Promise<void> {
  const checks: Record<string, 'up' | 'down'> = { db: 'down', redis: 'down' };

  const [db, r] = await Promise.allSettled([
    withTimeout(prisma.$queryRaw`SELECT 1`, 2000),
    withTimeout(redis.ping(), 2000),
  ]);
  checks.db = db.status === 'fulfilled' ? 'up' : 'down';
  checks.redis = r.status === 'fulfilled' && r.value === 'PONG' ? 'up' : 'down';

  const healthy = Object.values(checks).every((s) => s === 'up');
  res.status(healthy ? 200 : 503).json({ status: healthy ? 'ready' : 'degraded', checks });
}
