import { FileStatus, type Share } from '@prisma/client';
import type {
  CreateShareInput,
  PublicShare,
  ShareResolution,
  ShareTargetDetails,
  ShareVerifyResponse,
} from '@dropvault/shared';
import { prisma } from '../../config/db';
import { env } from '../../config/env';
import { AppError } from '../../utils/app-error';
import { generateToken } from '../../utils/tokens';
import { cache } from '../../services/cache.service';
import { hashPassword, verifyPassword } from '../../utils/password';
import { signShareGrant, verifyShareGrant } from '../../services/jwt.service';
import { storage } from '../../services/storage.service';
import { filesRepository } from '../files/files.repository';
import { foldersRepository } from '../folders/folders.repository';
import { sharesRepository } from './shares.repository';

interface RequestContext {
  ip?: string;
  userAgent?: string;
}

interface DownloadParams {
  grant?: string;
  fileId?: string;
}

const resolveCacheKey = (token: string) => `cache:share:resolve:${token}`;

function toPublicShare(share: Share, targetName: string): PublicShare {
  return {
    id: share.id,
    token: share.token,
    url: `${env.WEB_URL}/s/${share.token}`,
    type: share.fileId ? 'file' : 'folder',
    targetId: (share.fileId ?? share.folderId) as string,
    targetName,
    hasPassword: share.passwordHash !== null,
    expiresAt: share.expiresAt?.toISOString() ?? null,
    maxDownloads: share.maxDownloads,
    downloadCount: share.downloadCount,
    oneTime: share.oneTime,
    allowDownload: share.allowDownload,
    revoked: share.revokedAt !== null,
    createdAt: share.createdAt.toISOString(),
  };
}

function ensureLive(share: Share | null): asserts share is Share {
  if (!share || share.revokedAt) throw AppError.notFound('Share not found');
  if (share.expiresAt && share.expiresAt.getTime() < Date.now()) {
    throw AppError.gone('This share has expired');
  }
}

/** Loads the publicly-exposable details of a share's target (no storage keys, no owner info). */
async function targetDetails(share: Share): Promise<ShareTargetDetails> {
  if (share.fileId) {
    const file = await filesRepository.findById(share.ownerId, share.fileId);
    if (!file) throw AppError.notFound('Shared file not found');
    return { file: { name: file.name, mimeType: file.mimeType, size: file.size.toString() } };
  }
  const folder = await foldersRepository.findById(share.ownerId, share.folderId as string);
  if (!folder) throw AppError.notFound('Shared folder not found');
  const ids = (await foldersRepository.subtreeFolderIds(share.ownerId, folder.path)).map((r) => r.id);
  const files = await prisma.file.findMany({
    where: { userId: share.ownerId, folderId: { in: ids }, deletedAt: null, status: FileStatus.READY },
    orderBy: { name: 'asc' },
    take: 500,
  });
  return {
    folder: { name: folder.name },
    files: files.map((f) => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      size: f.size.toString(),
    })),
  };
}

export const sharesService = {
  async create(userId: string, input: CreateShareInput): Promise<PublicShare> {
    let fileId: string | null = null;
    let folderId: string | null = null;
    let targetName = '';

    if (input.fileId) {
      const file = await filesRepository.findById(userId, input.fileId);
      if (!file) throw AppError.notFound('File not found');
      fileId = file.id;
      targetName = file.name;
    } else {
      const folder = await foldersRepository.findById(userId, input.folderId as string);
      if (!folder) throw AppError.notFound('Folder not found');
      folderId = folder.id;
      targetName = folder.name;
    }

    const oneTime = input.oneTime ?? false;
    const share = await sharesRepository.create({
      ownerId: userId,
      fileId,
      folderId,
      token: generateToken(16), // 128-bit, URL-safe
      passwordHash: input.password ? await hashPassword(input.password) : null,
      expiresAt: input.expiresInHours
        ? new Date(Date.now() + input.expiresInHours * 3_600_000)
        : null,
      maxDownloads: oneTime ? 1 : (input.maxDownloads ?? null),
      oneTime,
      allowDownload: input.allowDownload ?? true,
    });
    return toPublicShare(share, targetName);
  },

  async listMine(userId: string): Promise<PublicShare[]> {
    const shares = await sharesRepository.listByOwner(userId);
    return shares.map((s) => toPublicShare(s, s.file?.name ?? s.folder?.name ?? '(deleted)'));
  },

  async revoke(userId: string, id: string): Promise<void> {
    const share = await prisma.share.findFirst({ where: { id, ownerId: userId } });
    if (!share) throw AppError.notFound('Share not found');
    await sharesRepository.revoke(userId, id);
    await cache.del(resolveCacheKey(share.token));
  },

  async resolve(token: string): Promise<ShareResolution> {
    // Hot anonymous path → cache the resolution (short TTL; invalidated on revoke).
    const cacheKey = resolveCacheKey(token);
    const cached = await cache.get<ShareResolution>(cacheKey);
    if (cached) return cached;

    const share = await sharesRepository.findByToken(token);
    ensureLive(share);

    const base = {
      type: (share.fileId ? 'file' : 'folder') as 'file' | 'folder',
      needsPassword: share.passwordHash !== null,
      allowDownload: share.allowDownload,
      expiresAt: share.expiresAt?.toISOString() ?? null,
      oneTime: share.oneTime,
    };
    // Don't reveal the target (filename) until the password is verified.
    const resolution = share.passwordHash ? base : { ...base, ...(await targetDetails(share)) };
    await cache.set(cacheKey, resolution, 60);
    return resolution;
  },

  async verify(token: string, password: string): Promise<ShareVerifyResponse> {
    const share = await sharesRepository.findByToken(token);
    ensureLive(share);
    if (!share.passwordHash) throw AppError.badRequest('This share is not password protected');
    if (!(await verifyPassword(share.passwordHash, password))) {
      throw AppError.unauthorized('Incorrect password');
    }
    return { grant: await signShareGrant(share.id), ...(await targetDetails(share)) };
  },

  async download(token: string, params: DownloadParams, ctx: RequestContext): Promise<{ url: string }> {
    const share = await sharesRepository.findByToken(token);
    ensureLive(share);
    if (!share.allowDownload) throw AppError.forbidden('Downloads are disabled for this share');

    if (share.passwordHash) {
      if (!params.grant) throw AppError.unauthorized('Password required');
      const sid = await verifyShareGrant(params.grant).catch(() => '');
      if (sid !== share.id) throw AppError.unauthorized('Invalid or expired password session');
    }

    // Resolve the file being requested and confirm it belongs to this share.
    let file = null;
    if (share.fileId) {
      file = await filesRepository.findById(share.ownerId, share.fileId);
    } else {
      if (!params.fileId) throw AppError.badRequest('fileId is required for folder shares');
      file = await filesRepository.findById(share.ownerId, params.fileId);
      if (file) {
        const folder = await foldersRepository.findById(share.ownerId, share.folderId as string);
        const ids = folder
          ? (await foldersRepository.subtreeFolderIds(share.ownerId, folder.path)).map((r) => r.id)
          : [];
        if (!file.folderId || !ids.includes(file.folderId)) file = null;
      }
    }
    if (!file || file.status !== FileStatus.READY) throw AppError.notFound('File not available');

    // Atomic limit check happens last, only when we're about to serve.
    if (!(await sharesRepository.consume(share.id))) {
      throw AppError.gone('This share is no longer available');
    }

    const url = await storage.presignGetObject(file.storageKey, {
      fileName: file.name,
      contentType: file.mimeType,
      inline: false,
    });
    await sharesRepository.recordDownload({
      fileId: file.id,
      shareId: share.id,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
    return { url };
  },
};
