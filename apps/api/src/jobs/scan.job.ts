import { createHash } from 'node:crypto';
import { FileStatus } from '@prisma/client';
import { prisma } from '../config/db';
import { logger } from '../config/logger';
import { storage } from '../services/storage.service';
import { scanBuffer } from '../services/scanner';
import { quota } from '../services/quota.service';
import { thumbnailQueue } from '../queues';
import { emitFileUpdate } from '../realtime/emitter';

/**
 * Virus-scan gate. A freshly-uploaded file sits in SCANNING and is NOT downloadable/
 * shareable (those paths require READY) until this clears it. Infected files are deleted
 * from storage, quarantined, and their quota refunded.
 */
export async function processScan(fileId: string): Promise<void> {
  const file = await prisma.file.findUnique({ where: { id: fileId } });
  if (!file || file.status !== FileStatus.SCANNING) return;

  const data = await storage.getObjectBuffer(file.storageKey);
  const result = await scanBuffer(data);

  if (result.clean) {
    const checksum = createHash('sha256').update(data).digest('hex');
    await prisma.file.update({ where: { id: fileId }, data: { status: FileStatus.READY, checksum } });
    emitFileUpdate(file.userId, { fileId, status: FileStatus.READY });
    if (file.mimeType.startsWith('image/')) await thumbnailQueue.add('thumbnail', { fileId });
    logger.info('Scan clean → READY', { fileId });
  } else {
    await storage.deleteObject(file.storageKey).catch(() => undefined);
    await prisma.file.update({ where: { id: fileId }, data: { status: FileStatus.QUARANTINED } });
    await quota.subUsed(file.userId, Number(file.size));
    emitFileUpdate(file.userId, { fileId, status: FileStatus.QUARANTINED, signature: result.signature });
    logger.warn('Scan detected threat → QUARANTINED', { fileId, signature: result.signature });
  }
}
