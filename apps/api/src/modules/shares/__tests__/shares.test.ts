import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../app';
import { registerUser, createReadyFile } from '../../../tests/helpers';

const app = createApp();
const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

async function shareFor(token: string, userId: string, body: Record<string, unknown> = {}) {
  const file = await createReadyFile(userId);
  const res = await request(app)
    .post('/api/v1/shares')
    .set(bearer(token))
    .send({ fileId: file.id, ...body });
  return res.body.share as { id: string; token: string };
}

describe('shares', () => {
  it('creates a public file share and resolves it', async () => {
    const { token, user } = await registerUser(app);
    const share = await shareFor(token, user.id);
    const res = await request(app).get(`/api/v1/shares/${share.token}`);
    expect(res.status).toBe(200);
    expect(res.body.type).toBe('file');
    expect(res.body.needsPassword).toBe(false);
    expect(res.body.file.name).toBe('file.bin');
  });

  it('enforces a one-time limit atomically under concurrency', async () => {
    const { token, user } = await registerUser(app);
    const share = await shareFor(token, user.id, { oneTime: true });
    const [a, b] = await Promise.all([
      request(app).get(`/api/v1/shares/${share.token}/download`),
      request(app).get(`/api/v1/shares/${share.token}/download`),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 410]);
  });

  it('hides the target until the password is verified, then grants download', async () => {
    const { token, user } = await registerUser(app);
    const share = await shareFor(token, user.id, { password: 'pw1234' });

    const resolved = await request(app).get(`/api/v1/shares/${share.token}`);
    expect(resolved.body.needsPassword).toBe(true);
    expect(resolved.body.file).toBeUndefined();

    expect((await request(app).get(`/api/v1/shares/${share.token}/download`)).status).toBe(401);
    expect(
      (await request(app).post(`/api/v1/shares/${share.token}/verify`).send({ password: 'nope' })).status,
    ).toBe(401);

    const verify = await request(app)
      .post(`/api/v1/shares/${share.token}/verify`)
      .send({ password: 'pw1234' });
    expect(verify.body.grant).toBeTruthy();

    const ok = await request(app).get(
      `/api/v1/shares/${share.token}/download?grant=${encodeURIComponent(verify.body.grant)}`,
    );
    expect(ok.status).toBe(200);
  });

  it('returns 404 after the owner revokes the link', async () => {
    const { token, user } = await registerUser(app);
    const share = await shareFor(token, user.id);
    await request(app).delete(`/api/v1/shares/${share.id}`).set(bearer(token));
    expect((await request(app).get(`/api/v1/shares/${share.token}`)).status).toBe(404);
  });
});
