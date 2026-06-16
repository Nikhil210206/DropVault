import Redis from 'ioredis';
import { env } from './env';
import { logger } from './logger';

/**
 * Shared Redis connection for caching and rate limiting.
 * `enableOfflineQueue: false` + finite retries make commands fail fast when Redis is
 * unreachable, so an outage can't hang requests. BullMQ (Phase 8) requires different
 * settings (`maxRetriesPerRequest: null`) and will create its own dedicated connection.
 */
export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableOfflineQueue: false,
});

redis.on('error', (err: Error) => logger.error('Redis error', { err: err.message }));
redis.on('connect', () => logger.info('Redis connected'));

export async function disconnectRedis(): Promise<void> {
  await redis.quit();
  logger.info('Redis disconnected');
}
