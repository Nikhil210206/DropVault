import './utils/bigint';

import { Worker } from 'bullmq';
import { bullConnection } from './config/queue-connection';
import { env, logger, disconnectPrisma, disconnectRedis } from './config';
import { QUEUES, cleanupQueue, type FileJob } from './queues';
import { processScan } from './jobs/scan.job';
import { processThumbnail } from './jobs/thumbnail.job';
import { processCleanup } from './jobs/cleanup.job';

const workers = [
  new Worker<FileJob>(QUEUES.scan, (job) => processScan(job.data.fileId), {
    connection: bullConnection,
    concurrency: 3,
  }),
  new Worker<FileJob>(QUEUES.thumbnail, (job) => processThumbnail(job.data.fileId), {
    connection: bullConnection,
    concurrency: 3,
  }),
  new Worker(QUEUES.cleanup, () => processCleanup(), { connection: bullConnection }),
];

for (const w of workers) {
  w.on('failed', (job, err) =>
    logger.error('Job failed', { queue: w.name, jobId: job?.id, attempt: job?.attemptsMade, err: err.message }),
  );
}

// Run cleanup hourly (a single repeatable job, deduped by jobId across restarts).
await cleanupQueue.add('cleanup', {}, { repeat: { every: 60 * 60 * 1000 }, jobId: 'cleanup-cron' });

logger.info('DropVault worker started', { queues: Object.values(QUEUES), scanProvider: env.SCAN_PROVIDER });

async function shutdown(signal: string): Promise<void> {
  logger.info(`Worker received ${signal}, shutting down`);
  await Promise.all(workers.map((w) => w.close()));
  await disconnectPrisma();
  await disconnectRedis();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
