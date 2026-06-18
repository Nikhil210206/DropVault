import { randomUUID } from 'node:crypto';
import { FileStatus, UploadStatus } from '@prisma/client';
import type {
  InitUploadInput,
  PublicFile,
  UploadInitResponse,
  UploadStatusResponse,
} from '@dropvault/shared';
import { AppError } from '../../utils/app-error';
import { quota } from '../../services/quota.service';
import { storage } from '../../services/storage.service';
import { foldersRepository } from '../folders/folders.repository';
import { filesRepository } from '../files/files.repository';
import { toPublicFile } from '../files/files.service';
import { uploadsRepository } from './uploads.repository';

const CHUNK_SIZE = 8 * 1024 * 1024; // 8 MiB (> S3's 5 MiB minimum part size)
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export const uploadsService = {
  async init(userId: string, input: InitUploadInput): Promise<UploadInitResponse> {
    const folderId = input.folderId ?? null;
    if (folderId && !(await foldersRepository.findById(userId, folderId))) {
      throw AppError.notFound('Target folder not found');
    }

    // Reserve quota before touching S3; release it if anything below fails.
    if (!(await quota.reserve(userId, input.size))) {
      throw AppError.payloadTooLarge('Storage quota exceeded');
    }

    const key = `users/${userId}/files/${randomUUID()}/source`;
    let uploadId: string;
    try {
      uploadId = await storage.createMultipartUpload(key, input.mimeType);
    } catch (e) {
      await quota.release(userId, input.size);
      throw e;
    }

    const totalParts = Math.ceil(input.size / CHUNK_SIZE);
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    const session = await uploadsRepository.create({
      userId,
      folderId,
      s3UploadId: uploadId,
      storageKey: key,
      fileName: input.fileName,
      mimeType: input.mimeType,
      totalSize: BigInt(input.size),
      reservedBytes: BigInt(input.size),
      chunkSize: CHUNK_SIZE,
      totalParts,
      status: UploadStatus.IN_PROGRESS,
      expiresAt,
    });

    const parts = await Promise.all(
      Array.from({ length: totalParts }, (_, i) => i + 1).map(async (partNumber) => ({
        partNumber,
        url: await storage.presignUploadPart(key, uploadId, partNumber),
      })),
    );

    return {
      sessionId: session.id,
      chunkSize: CHUNK_SIZE,
      totalParts,
      parts,
      expiresAt: expiresAt.toISOString(),
    };
  },

  async status(userId: string, sessionId: string): Promise<UploadStatusResponse> {
    const session = await uploadsRepository.findById(userId, sessionId);
    if (!session) throw AppError.notFound('Upload session not found');

    const parts = await storage.listParts(session.storageKey, session.s3UploadId);
    return {
      status: session.status,
      totalParts: session.totalParts,
      chunkSize: session.chunkSize,
      uploadedParts: parts.map((p) => p.partNumber).sort((a, b) => a - b),
      expiresAt: session.expiresAt.toISOString(),
    };
  },

  async partUrls(
    userId: string,
    sessionId: string,
    partNumbers: number[],
  ): Promise<{ partNumber: number; url: string }[]> {
    const session = await uploadsRepository.findById(userId, sessionId);
    if (!session) throw AppError.notFound('Upload session not found');
    if (session.status !== UploadStatus.IN_PROGRESS) {
      throw AppError.badRequest('Upload session is not active');
    }
    return Promise.all(
      partNumbers.map(async (partNumber) => ({
        partNumber,
        url: await storage.presignUploadPart(session.storageKey, session.s3UploadId, partNumber),
      })),
    );
  },

  async complete(userId: string, sessionId: string): Promise<PublicFile> {
    const session = await uploadsRepository.findById(userId, sessionId);
    if (!session) throw AppError.notFound('Upload session not found');
    if (session.status !== UploadStatus.IN_PROGRESS) {
      throw AppError.conflict('Upload session is not active');
    }
    if (session.expiresAt.getTime() < Date.now()) {
      throw AppError.badRequest('Upload session expired');
    }

    // S3 ListParts is the source of truth for what was actually uploaded.
    const parts = await storage.listParts(session.storageKey, session.s3UploadId);
    if (parts.length < session.totalParts) {
      throw AppError.badRequest(
        `Upload incomplete: ${parts.length}/${session.totalParts} parts received`,
      );
    }

    const ordered = [...parts].sort((a, b) => a.partNumber - b.partNumber);
    await storage.completeMultipartUpload(
      session.storageKey,
      session.s3UploadId,
      ordered.map((p) => ({ ETag: p.etag, PartNumber: p.partNumber })),
    );

    // HEAD-verify the assembled object: the client could PUT bytes that differ from what
    // it declared, which would corrupt quota accounting. Reject mismatches.
    const head = await storage.headObject(session.storageKey);
    if (head.size !== Number(session.totalSize)) {
      await storage.deleteObject(session.storageKey).catch(() => undefined);
      await quota.release(userId, Number(session.reservedBytes));
      await uploadsRepository.updateStatus(session.id, UploadStatus.ABORTED);
      throw AppError.badRequest('Uploaded size does not match the declared size');
    }

    const file = await filesRepository.create({
      userId,
      folderId: session.folderId,
      name: session.fileName,
      originalName: session.fileName,
      mimeType: session.mimeType,
      size: BigInt(head.size),
      storageKey: session.storageKey,
      status: FileStatus.READY,
      version: 1,
    });

    await uploadsRepository.recordParts(session.id, parts);
    await uploadsRepository.updateStatus(session.id, UploadStatus.COMPLETED, file.id);
    await quota.commit(userId, head.size, Number(session.reservedBytes));

    return toPublicFile(file);
  },

  async abort(userId: string, sessionId: string): Promise<void> {
    const session = await uploadsRepository.findById(userId, sessionId);
    if (!session) throw AppError.notFound('Upload session not found');
    if (session.status !== UploadStatus.IN_PROGRESS) return;

    await storage.abortMultipartUpload(session.storageKey, session.s3UploadId).catch(() => undefined);
    await quota.release(userId, Number(session.reservedBytes));
    await uploadsRepository.updateStatus(session.id, UploadStatus.ABORTED);
  },
};
