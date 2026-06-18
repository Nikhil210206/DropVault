import sharp from 'sharp';
import { prisma } from '../config/db';
import { logger } from '../config/logger';
import { storage } from '../services/storage.service';
import { emitFileUpdate } from '../realtime/emitter';

/**
 * Generates a WebP thumbnail for image files. Runs only on clean files (it's enqueued
 * after the scan passes). In production this worker must be sandboxed — it decodes
 * attacker-controlled images (decompression-bomb guards via sharp limits).
 */
export async function processThumbnail(fileId: string): Promise<void> {
  const file = await prisma.file.findUnique({ where: { id: fileId } });
  if (!file || !file.mimeType.startsWith('image/')) return;

  const data = await storage.getObjectBuffer(file.storageKey);
  const thumbnail = await sharp(data, { limitInputPixels: 100_000_000 })
    .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();

  const thumbnailKey = file.storageKey.replace(/\/source$/, '/thumb.webp');
  await storage.putObject(thumbnailKey, thumbnail, 'image/webp');
  await prisma.file.update({ where: { id: fileId }, data: { thumbnailKey } });

  emitFileUpdate(file.userId, { fileId, status: file.status, thumbnailKey });
  logger.info('Thumbnail generated', { fileId });
}
