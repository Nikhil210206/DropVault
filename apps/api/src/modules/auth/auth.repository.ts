import type { VerificationTokenType } from '@prisma/client';
import { prisma } from '../../config/db';

interface NewRefreshToken {
  userId: string;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
  userAgent?: string;
  ip?: string;
}

/** All Prisma access for the auth module lives here (repository pattern). */
export const authRepository = {
  findActiveUserByEmail: (email: string) =>
    prisma.user.findFirst({ where: { email, deletedAt: null } }),

  findUserById: (id: string) => prisma.user.findUnique({ where: { id } }),

  createUser: (data: { email: string; name: string; passwordHash: string }) =>
    prisma.user.create({ data }),

  markEmailVerified: (id: string) =>
    prisma.user.update({ where: { id }, data: { emailVerified: true } }),

  updatePassword: (id: string, passwordHash: string) =>
    prisma.user.update({ where: { id }, data: { passwordHash } }),

  createRefreshToken: (data: NewRefreshToken) => prisma.refreshToken.create({ data }),

  findRefreshToken: (tokenHash: string) =>
    prisma.refreshToken.findUnique({ where: { tokenHash } }),

  /** Atomically create the successor token and revoke the old one (rotation). */
  rotateRefreshToken: (oldId: string, next: NewRefreshToken) =>
    prisma.$transaction(async (tx) => {
      const created = await tx.refreshToken.create({ data: next });
      await tx.refreshToken.update({
        where: { id: oldId },
        data: { revokedAt: new Date(), replacedByTokenId: created.id },
      });
      return created;
    }),

  revokeRefreshToken: (id: string) =>
    prisma.refreshToken.update({ where: { id }, data: { revokedAt: new Date() } }),

  revokeFamily: (familyId: string) =>
    prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),

  revokeAllUserTokens: (userId: string) =>
    prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),

  createVerificationToken: (data: {
    userId: string;
    type: VerificationTokenType;
    tokenHash: string;
    expiresAt: Date;
  }) => prisma.verificationToken.create({ data }),

  findVerificationToken: (tokenHash: string, type: VerificationTokenType) =>
    prisma.verificationToken.findFirst({ where: { tokenHash, type } }),

  markVerificationTokenUsed: (id: string) =>
    prisma.verificationToken.update({ where: { id }, data: { usedAt: new Date() } }),
};
