import { Emitter } from '@socket.io/redis-emitter';
import Redis from 'ioredis';
import { env } from '../config/env';
import { FILE_UPDATED, userRoom, type FileUpdatedPayload } from './events';

// The worker has no Socket.IO server of its own; the redis-emitter publishes to the same
// Redis channel the API's adapter listens on, so events reach the right user's clients.
const emitter = new Emitter(new Redis(env.REDIS_URL, { maxRetriesPerRequest: null }));

export function emitFileUpdate(userId: string, payload: FileUpdatedPayload): void {
  emitter.to(userRoom(userId)).emit(FILE_UPDATED, payload);
}
