import { randomUUID } from 'node:crypto';
import { FileStatus, type File } from '@prisma/client';
import type { ListFilesQuery, Paginated, PublicFile, UpdateFileInput } from '@dropvault/shared';
import { prisma } from '../../config/db';
import { AppError } from '../../utils/app-error';
import { quota } from '../../services/quota.service';
import { storage } from '../../services/storage.service';
import { foldersRepository } from '../folders/folders.repository';
import { filesRepository } from './files.repository';

export interface RequestContext {
  ip?: string;
  userAgent?: string;
}

export function toPublicFile(f: File): PublicFile {
  return {
    id: f.id,
    name: f.name,
    originalName: f.originalName,
    mimeType: f.mimeType,
    size: f.size.toString(),
    status: f.status,
    folderId: f.folderId,
    thumbnailKey: f.thumbnailKey,
    createdAt: f.createdAt.toISOString(),
    updatedAt: f.updatedAt.toISOString(),
  };
}

export const filesService = {
  async list(userId: string, query: ListFilesQuery): Promise<Paginated<PublicFile>> {
    const rows = await filesRepository.list({
      userId,
      folderId: query.folderId ?? null,
      q: query.q,
      cursor: query.cursor,
      limit: query.limit,
    });
    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    return {
      data: page.map(toPublicFile),
      pageInfo: { hasMore, nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null },
    };
  },

  async get(userId: string, id: string): Promise<PublicFile> {
    const file = await filesRepository.findById(userId, id);
    if (!file) throw AppError.notFound('File not found');
    return toPublicFile(file);
  },

  async update(userId: string, id: string, input: UpdateFileInput): Promise<PublicFile> {
    const file = await filesRepository.findById(userId, id);
    if (!file) throw AppError.notFound('File not found');

    const data: { name?: string; folderId?: string | null } = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.folderId !== undefined) {
      if (input.folderId === null) {
        data.folderId = null;
      } else {
        const folder = await foldersRepository.findById(userId, input.folderId);
        if (!folder) throw AppError.notFound('Target folder not found');
        data.folderId = input.folderId;
      }
    }
    return toPublicFile(await filesRepository.update(id, data));
  },

  async copy(userId: string, id: string): Promise<PublicFile> {
    const file = await filesRepository.findById(userId, id);
    if (!file) throw AppError.notFound('File not found');
    if (file.status !== FileStatus.READY) throw AppError.badRequest('File is not ready to copy');

    const size = Number(file.size);
    if (!(await quota.addUsed(userId, size))) throw AppError.payloadTooLarge('Storage quota exceeded');

    const newKey = `users/${userId}/files/${randomUUID()}/source`;
    try {
      await storage.copyObject(file.storageKey, newKey);
    } catch (e) {
      await quota.subUsed(userId, size);
      throw e;
    }

    const created = await filesRepository.create({
      userId,
      folderId: file.folderId,
      name: `${file.name} (copy)`,
      originalName: file.originalName,
      mimeType: file.mimeType,
      size: file.size,
      storageKey: newKey,
      status: FileStatus.READY,
      version: 1,
    });
    return toPublicFile(created);
  },

  async remove(userId: string, id: string): Promise<void> {
    const file = await filesRepository.findById(userId, id);
    if (!file) throw AppError.notFound('File not found');
    await filesRepository.softDelete(id);
    await quota.subUsed(userId, Number(file.size));
    // The S3 object is retained for trash/restore; the cleanup job purges it (Phase 8).
  },

  async getDownloadUrl(userId: string, id: string, ctx: RequestContext): Promise<{ url: string }> {
    const file = await filesRepository.findById(userId, id);
    if (!file) throw AppError.notFound('File not found');
    if (file.status !== FileStatus.READY) throw AppError.badRequest('File is not ready for download');

    const url = await storage.presignGetObject(file.storageKey, {
      fileName: file.name,
      contentType: file.mimeType,
      inline: false,
    });
    await prisma.download.create({
      data: { fileId: file.id, actorUserId: userId, ip: ctx.ip, userAgent: ctx.userAgent },
    });
    return { url };
  },

  async getPreviewUrl(userId: string, id: string): Promise<{ url: string }> {
    const file = await filesRepository.findById(userId, id);
    if (!file) throw AppError.notFound('File not found');
    if (file.status !== FileStatus.READY) throw AppError.badRequest('File is not ready');

    const url = await storage.presignGetObject(file.storageKey, {
      fileName: file.name,
      contentType: file.mimeType,
      inline: true,
    });
    return { url };
  },
};
