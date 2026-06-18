import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/db';

export const foldersRepository = {
  findById: (userId: string, id: string) =>
    prisma.folder.findFirst({ where: { id, userId, deletedAt: null } }),

  listChildren: (userId: string, parentId: string | null) =>
    prisma.folder.findMany({
      where: { userId, parentId, deletedAt: null },
      orderBy: { name: 'asc' },
    }),

  create: (data: Prisma.FolderUncheckedCreateInput) => prisma.folder.create({ data }),

  /** Ids of a folder and all its live descendants, via the materialized path prefix. */
  subtreeFolderIds: (userId: string, pathPrefix: string) =>
    prisma.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "folders"
      WHERE "userId" = ${userId}::uuid
        AND left("path", ${pathPrefix.length}::int) = ${pathPrefix}
        AND "deletedAt" IS NULL`,
};
