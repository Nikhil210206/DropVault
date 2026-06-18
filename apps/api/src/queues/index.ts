import { Queue } from 'bullmq';
import { bullConnection } from '../config/queue-connection';

export const QUEUES = {
  scan: 'scan',
  thumbnail: 'thumbnail',
  cleanup: 'cleanup',
} as const;

export interface FileJob {
  fileId: string;
}

export const scanQueue = new Queue<FileJob>(QUEUES.scan, { connection: bullConnection });
export const thumbnailQueue = new Queue<FileJob>(QUEUES.thumbnail, { connection: bullConnection });
export const cleanupQueue = new Queue(QUEUES.cleanup, { connection: bullConnection });
