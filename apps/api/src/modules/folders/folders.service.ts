import { Prisma, type Folder } from '@prisma/client';
import type { CreateFolderInput, PublicFolder } from '@dropvault/shared';
import { prisma } from '../../config/db';
import { AppError } from '../../utils/app-error';
import { quota } from '../../services/quota.service';
import { foldersRepository } from './folders.repository';

function toPublic(f: Folder): PublicFolder {
  return {
    id: f.id,
    name: f.name,
    parentId: f.parentId,
    path: f.path,
    createdAt: f.createdAt.toISOString(),
    updatedAt: f.updatedAt.toISOString(),
  };
}

function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
}

export const foldersService = {
  async create(userId: string, input: CreateFolderInput): Promise<PublicFolder> {
    const parentId = input.parentId ?? null;
    let parentPath = '/';
    if (parentId) {
      const parent = await foldersRepository.findById(userId, parentId);
      if (!parent) throw AppError.notFound('Parent folder not found');
      parentPath = parent.path;
    }
    try {
      const folder = await foldersRepository.create({
        userId,
        name: input.name,
        parentId,
        path: `${parentPath}${input.name}/`,
      });
      return toPublic(folder);
    } catch (e) {
      if (isUniqueViolation(e)) throw AppError.conflict('A folder with that name already exists here');
      throw e;
    }
  },

  async get(userId: string, id: string): Promise<PublicFolder> {
    const folder = await foldersRepository.findById(userId, id);
    if (!folder) throw AppError.notFound('Folder not found');
    return toPublic(folder);
  },

  async listChildren(userId: string, parentId: string | null): Promise<PublicFolder[]> {
    const rows = await foldersRepository.listChildren(userId, parentId);
    return rows.map(toPublic);
  },

  /** Renames a folder and rewrites the materialized path of every descendant in one transaction. */
  async rename(userId: string, id: string, name: string): Promise<PublicFolder> {
    const folder = await foldersRepository.findById(userId, id);
    if (!folder) throw AppError.notFound('Folder not found');

    const oldPath = folder.path;
    const parentPath = oldPath.slice(0, oldPath.length - (folder.name.length + 1));
    const newPath = `${parentPath}${name}/`;

    try {
      await prisma.$transaction([
        prisma.folder.update({ where: { id }, data: { name } }),
        prisma.$executeRaw`
          UPDATE "folders"
          SET "path" = ${newPath} || substring("path" FROM ${oldPath.length + 1}::int)
          WHERE "userId" = ${userId}::uuid
            AND left("path", ${oldPath.length}::int) = ${oldPath}
            AND "deletedAt" IS NULL`,
      ]);
    } catch (e) {
      if (isUniqueViolation(e)) throw AppError.conflict('A folder with that name already exists here');
      throw e;
    }

    const updated = await foldersRepository.findById(userId, id);
    return toPublic(updated as Folder);
  },

  /** Soft-deletes a folder subtree (folders + contained files) and frees their storage. */
  async remove(userId: string, id: string): Promise<void> {
    const folder = await foldersRepository.findById(userId, id);
    if (!folder) throw AppError.notFound('Folder not found');

    const prefix = folder.path;
    const subtree = await prisma.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "folders"
      WHERE "userId" = ${userId}::uuid
        AND left("path", ${prefix.length}::int) = ${prefix}
        AND "deletedAt" IS NULL`;
    const folderIds = subtree.map((r) => r.id);

    const agg = await prisma.file.aggregate({
      _sum: { size: true },
      where: { userId, folderId: { in: folderIds }, deletedAt: null },
    });
    const freed = Number(agg._sum.size ?? 0n);

    const now = new Date();
    await prisma.$transaction([
      prisma.file.updateMany({
        where: { userId, folderId: { in: folderIds }, deletedAt: null },
        data: { deletedAt: now },
      }),
      prisma.folder.updateMany({ where: { id: { in: folderIds } }, data: { deletedAt: now } }),
    ]);

    if (freed > 0) await quota.subUsed(userId, freed);
  },
};
