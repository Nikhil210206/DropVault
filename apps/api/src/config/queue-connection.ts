import { env } from './env';

// BullMQ requires its own connection with `maxRetriesPerRequest: null` (workers block on
// the queue). Passing options (not a shared instance) lets BullMQ manage connections itself.
const url = new URL(env.REDIS_URL);

export const bullConnection = {
  host: url.hostname,
  port: Number(url.port || 6379),
  maxRetriesPerRequest: null as null,
};
