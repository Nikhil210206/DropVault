import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/db';

interface DownloadRecord {
  fileId: string;
  shareId: string;
  ip?: string;
  userAgent?: string;
}

export const sharesRepository = {
  create: (data: Prisma.ShareUncheckedCreateInput) => prisma.share.create({ data }),

  findByToken: (token: string) => prisma.share.findUnique({ where: { token } }),

  listByOwner: (ownerId: string) =>
    prisma.share.findMany({
      where: { ownerId, revokedAt: null },
      include: { file: true, folder: true },
      orderBy: { id: 'desc' },
    }),

  revoke: (ownerId: string, id: string) =>
    prisma.share.updateMany({ where: { id, ownerId, revokedAt: null }, data: { revokedAt: new Date() } }),

  /**
   * Atomically consume one download against the link's limits. Returns true only if the
   * row was updated — a single conditional UPDATE, so two concurrent requests on a
   * one-time link cannot both succeed (the race-safe enforcement from the review).
   */
  async consume(id: string): Promise<boolean> {
    const n = await prisma.$executeRaw`
      UPDATE "shares"
      SET "downloadCount" = "downloadCount" + 1
      WHERE "id" = ${id}::uuid
        AND "revokedAt" IS NULL
        AND ("expiresAt" IS NULL OR "expiresAt" > now())
        AND "allowDownload" = true
        AND ("maxDownloads" IS NULL OR "downloadCount" < "maxDownloads")`;
    return n === 1;
  },

  recordDownload: (data: DownloadRecord) => prisma.download.create({ data }),
};
