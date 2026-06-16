import { createServer } from 'node:http';
import { createApp } from './app';
import { env, logger, disconnectPrisma, disconnectRedis } from './config';

const app = createApp();
const server = createServer(app);

server.listen(env.PORT, () => {
  logger.info('DropVault API listening', {
    port: env.PORT,
    env: env.NODE_ENV,
    prefix: env.API_PREFIX,
  });
});

// ── Graceful shutdown ──────────────────────────────────────────────────
let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`Received ${signal}, shutting down gracefully`);

  // Stop accepting new connections, then drain and release resources.
  server.close(() => {
    void (async () => {
      try {
        await disconnectPrisma();
        await disconnectRedis();
        logger.info('Shutdown complete');
        process.exit(0);
      } catch (err) {
        logger.error('Error during shutdown', { err: (err as Error).message });
        process.exit(1);
      }
    })();
  });

  // Hard limit so a hung connection can't block shutdown forever.
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason: String(reason) });
});
process.on('uncaughtException', (err: Error) => {
  logger.error('Uncaught exception', { err: err.message, stack: err.stack });
  process.exit(1);
});
