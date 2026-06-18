import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { verifyAccessToken } from '../services/jwt.service';
import { userRoom } from './events';

/**
 * Attaches Socket.IO with a Redis adapter. The adapter lets the worker (a separate
 * process) push events to connected clients via @socket.io/redis-emitter. Clients
 * authenticate with their access token and are placed in a per-user room.
 */
export function attachSocket(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: { origin: env.CORS_ORIGINS, credentials: true },
  });

  const pub = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  const sub = pub.duplicate();
  io.adapter(createAdapter(pub, sub));

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) throw new Error('missing token');
      const claims = await verifyAccessToken(token);
      socket.data.userId = claims.sub;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.data.userId as string;
    void socket.join(userRoom(userId));
  });

  logger.info('Socket.IO attached');
  return io;
}
