import { Prisma } from '@prisma/client';
import { prisma } from '../../config/db';

interface ListArgs {
  userId: string;
  folderId: string | null;
  q?: string;
  cursor?: string;
  limit: number;
}

export const filesRepository = {
  findById: (userId: string, id: string) =>
    prisma.file.findFirst({ where: { id, userId, deletedAt: null } }),

  list: ({ userId, folderId, q, cursor, limit }: ListArgs) =>
    prisma.file.findMany({
      where: {
        userId,
        deletedAt: null,
        folderId,
        ...(q ? { name: { contains: q, mode: Prisma.QueryMode.insensitive } } : {}),
      },
      orderBy: { id: 'desc' }, // uuid v7 is time-ordered, so id desc ≈ newest first
      take: limit + 1, // fetch one extra to detect the next page
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    }),

  create: (data: Prisma.FileUncheckedCreateInput) => prisma.file.create({ data }),

  update: (id: string, data: Prisma.FileUncheckedUpdateInput) =>
    prisma.file.update({ where: { id }, data }),

  softDelete: (id: string) =>
    prisma.file.update({ where: { id }, data: { deletedAt: new Date() } }),
};
