import { prisma } from '../config/db';

/**
 * Atomic storage-quota accounting. Each operation is a single conditional UPDATE so
 * concurrent uploads can't collectively exceed the quota (closes the TOCTOU gap).
 *
 * Reservation model: bytes are reserved at upload init, committed to `storageUsed` on
 * complete, and released on abort/failure. File sizes (< 5 GiB) are well within 2^53,
 * so passing them as JS numbers is precision-safe.
 */
export const quota = {
  /** Reserve bytes if they fit; returns false when the quota would be exceeded. */
  async reserve(userId: string, bytes: number): Promise<boolean> {
    const n = await prisma.$executeRaw`
      UPDATE "users"
      SET "storageReserved" = "storageReserved" + ${bytes}
      WHERE "id" = ${userId}::uuid
        AND "storageUsed" + "storageReserved" + ${bytes} <= "storageQuota"`;
    return n === 1;
  },

  /** Move reserved bytes into used (on successful upload completion). */
  async commit(userId: string, actualBytes: number, reservedBytes: number): Promise<void> {
    await prisma.$executeRaw`
      UPDATE "users"
      SET "storageUsed" = "storageUsed" + ${actualBytes},
          "storageReserved" = GREATEST(0::bigint, "storageReserved" - ${reservedBytes})
      WHERE "id" = ${userId}::uuid`;
  },

  /** Release a reservation (abort/failure). */
  async release(userId: string, bytes: number): Promise<void> {
    await prisma.$executeRaw`
      UPDATE "users"
      SET "storageReserved" = GREATEST(0::bigint, "storageReserved" - ${bytes})
      WHERE "id" = ${userId}::uuid`;
  },

  /** Add bytes directly to used if they fit (e.g. server-side copy). */
  async addUsed(userId: string, bytes: number): Promise<boolean> {
    const n = await prisma.$executeRaw`
      UPDATE "users"
      SET "storageUsed" = "storageUsed" + ${bytes}
      WHERE "id" = ${userId}::uuid
        AND "storageUsed" + "storageReserved" + ${bytes} <= "storageQuota"`;
    return n === 1;
  },

  /** Subtract bytes from used (e.g. delete), clamped at zero. */
  async subUsed(userId: string, bytes: number): Promise<void> {
    await prisma.$executeRaw`
      UPDATE "users"
      SET "storageUsed" = GREATEST(0::bigint, "storageUsed" - ${bytes})
      WHERE "id" = ${userId}::uuid`;
  },
};
