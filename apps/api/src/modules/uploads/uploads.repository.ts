import type { Prisma, UploadStatus } from '@prisma/client';
import { prisma } from '../../config/db';
import type { S3Part } from '../../services/storage.service';

export const uploadsRepository = {
  create: (data: Prisma.UploadSessionUncheckedCreateInput) =>
    prisma.uploadSession.create({ data }),

  findById: (userId: string, id: string) =>
    prisma.uploadSession.findFirst({ where: { id, userId } }),

  updateStatus: (id: string, status: UploadStatus, fileId?: string) =>
    prisma.uploadSession.update({
      where: { id },
      data: { status, ...(fileId ? { fileId } : {}) },
    }),

  recordParts: (sessionId: string, parts: S3Part[]) =>
    prisma.uploadPart.createMany({
      data: parts.map((p) => ({
        sessionId,
        partNumber: p.partNumber,
        etag: p.etag,
        size: BigInt(p.size),
      })),
      skipDuplicates: true,
    }),
};
