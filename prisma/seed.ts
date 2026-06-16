import { PrismaClient, Role, FileStatus } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

// Email is unique only via a PARTIAL index (WHERE deletedAt IS NULL), which Prisma's typed
// API can't use as a unique selector — so we find-then-create instead of upsert. The same
// pattern is used by registration in Phase 4, relying on the DB index to enforce uniqueness.
async function ensureUser(email: string, name: string, role: Role) {
  const existing = await prisma.user.findFirst({ where: { email, deletedAt: null } });
  if (existing) return existing;
  const passwordHash = await argon2.hash('Password123!', { type: argon2.argon2id });
  return prisma.user.create({
    data: { email, name, role, passwordHash, emailVerified: true },
  });
}

async function ensureFolder(userId: string, parentId: string | null, name: string, path: string) {
  const existing = await prisma.folder.findFirst({
    where: { userId, parentId, name, deletedAt: null },
  });
  if (existing) return existing;
  return prisma.folder.create({ data: { userId, parentId, name, path } });
}

async function main() {
  const admin = await ensureUser('admin@dropvault.local', 'Admin', Role.ADMIN);
  const demo = await ensureUser('demo@dropvault.local', 'Demo User', Role.USER);

  const photos = await ensureFolder(demo.id, null, 'Photos', '/Photos/');
  const y2026 = await ensureFolder(demo.id, photos.id, '2026', '/Photos/2026/');

  const sample = await prisma.file.findFirst({
    where: { userId: demo.id, name: 'welcome.txt', deletedAt: null },
  });
  if (!sample) {
    await prisma.file.create({
      data: {
        userId: demo.id,
        folderId: y2026.id,
        name: 'welcome.txt',
        originalName: 'welcome.txt',
        mimeType: 'text/plain',
        size: BigInt(1024),
        storageKey: `users/${demo.id}/files/seed-welcome/1`,
        status: FileStatus.READY,
        version: 1,
      },
    });
  }

  // eslint-disable-next-line no-console
  console.log('✅ Seed complete:', { admin: admin.email, demo: demo.email });
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
