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
};
