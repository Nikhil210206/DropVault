import { describe, it, expect } from 'vitest';
import { prisma } from '../../config/db';
import { quota } from '../quota.service';

function makeUser(quotaBytes: bigint) {
  return prisma.user.create({
    data: { email: `q_${Math.random()}@dropvault.test`, name: 'q', passwordHash: 'x', storageQuota: quotaBytes },
  });
}
const reload = (id: string) => prisma.user.findUniqueOrThrow({ where: { id } });

describe('quota', () => {
  it('reserves only what fits within the quota', async () => {
    const u = await makeUser(1000n);
    expect(await quota.reserve(u.id, 600)).toBe(true);
    expect(await quota.reserve(u.id, 600)).toBe(false); // 600 + 600 > 1000
    expect(Number((await reload(u.id)).storageReserved)).toBe(600);
  });

  it('commit moves reserved bytes into used', async () => {
    const u = await makeUser(1000n);
    await quota.reserve(u.id, 500);
    await quota.commit(u.id, 500, 500);
    const after = await reload(u.id);
    expect(Number(after.storageUsed)).toBe(500);
    expect(Number(after.storageReserved)).toBe(0);
  });

  it('release frees a reservation', async () => {
    const u = await makeUser(1000n);
    await quota.reserve(u.id, 500);
    await quota.release(u.id, 500);
    expect(Number((await reload(u.id)).storageReserved)).toBe(0);
  });

  it('subUsed clamps at zero', async () => {
    const u = await makeUser(1000n);
    await quota.addUsed(u.id, 200);
    await quota.subUsed(u.id, 999);
    expect(Number((await reload(u.id)).storageUsed)).toBe(0);
  });
});
