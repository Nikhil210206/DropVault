import { FileStatus, UploadStatus } from '@prisma/client';
import { prisma } from '../config/db';
import { logger } from '../config/logger';
import { storage } from '../services/storage.service';
import { quota } from '../services/quota.service';

const STUCK_MS = 60 * 60 * 1000; // files stuck > 1h → FAILED
const PURGE_MS = 30 * 24 * 60 * 60 * 1000; // soft-deleted > 30d → hard purge

export interface CleanupResult {
  expiredSessions: number;
  failedFiles: number;
  purgedFiles: number;
}

/**
 * Periodic maintenance:
 *  1. Expire abandoned upload sessions (abort the S3 multipart, release the reservation).
 *  2. Fail files stuck in UPLOADING/SCANNING (so failures never go silent).
 *  3. Hard-purge long soft-deleted files (delete the S3 object + the row).
 */
export async function processCleanup(now: Date = new Date()): Promise<CleanupResult> {
  const stale = await prisma.uploadSession.findMany({
    where: { status: UploadStatus.IN_PROGRESS, expiresAt: { lt: now } },
  });
  for (const s of stale) {
    await storage.abortMultipartUpload(s.storageKey, s.s3UploadId).catch(() => undefined);
    await quota.release(s.userId, Number(s.reservedBytes));
    await prisma.uploadSession.update({ where: { id: s.id }, data: { status: UploadStatus.EXPIRED } });
  }

  const { count: failedFiles } = await prisma.file.updateMany({
    where: {
      status: { in: [FileStatus.UPLOADING, FileStatus.SCANNING] },
      updatedAt: { lt: new Date(now.getTime() - STUCK_MS) },
      deletedAt: null,
    },
    data: { status: FileStatus.FAILED },
  });

  const toPurge = await prisma.file.findMany({
    where: { deletedAt: { lt: new Date(now.getTime() - PURGE_MS) } },
  });
  for (const f of toPurge) {
    await storage.deleteObject(f.storageKey).catch(() => undefined);
    await prisma.file.delete({ where: { id: f.id } });
  }

  const result = { expiredSessions: stale.length, failedFiles, purgedFiles: toPurge.length };
  logger.info('Cleanup run', result);
  return result;
}
