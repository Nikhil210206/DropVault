import { redis } from '../config/redis';

/**
 * Cache-aside helpers over Redis. Treated as best-effort: any Redis error degrades to a
 * cache miss rather than failing the request. Authoritative data always lives in Postgres.
 */
export const cache = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await redis.get(key);
      return value ? (JSON.parse(value) as T) : null;
    } catch {
      return null;
    }
  },

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch {
      /* best-effort */
    }
  },

  async del(key: string): Promise<void> {
    try {
      await redis.del(key);
    } catch {
      /* best-effort */
    }
  },
};
