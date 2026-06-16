import Redis from 'ioredis';
import { env } from './env';
import { logger } from './logger';

/**
 * Shared Redis connection for caching and rate limiting.
 * A per-command timeout means a prolonged outage fails fast (the failOpen rate-limit
 * wrapper then allows the request) instead of hanging, while brief blips still queue and
 * recover. BullMQ (Phase 8) requires `maxRetriesPerRequest: null` and gets its own
 * dedicated connection.
 */
export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  commandTimeout: 1000,
});

redis.on('error', (err: Error) => logger.error('Redis error', { err: err.message }));
redis.on('connect', () => logger.info('Redis connected'));

export async function disconnectRedis(): Promise<void> {
  await redis.quit();
  logger.info('Redis disconnected');
}
