import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../app';
import { registerUser } from '../../../tests/helpers';

const app = createApp();

describe('folders', () => {
  it('creates nested folders with correct materialized paths', async () => {
    const { token } = await registerUser(app);
    const auth = { Authorization: `Bearer ${token}` };

    const a = await request(app).post('/api/v1/folders').set(auth).send({ name: 'A' });
    expect(a.status).toBe(201);
    expect(a.body.folder.path).toBe('/A/');

    const b = await request(app)
      .post('/api/v1/folders')
      .set(auth)
      .send({ name: 'B', parentId: a.body.folder.id });
    expect(b.body.folder.path).toBe('/A/B/');
  });

  it('rewrites descendant paths on rename', async () => {
    const { token } = await registerUser(app);
    const auth = { Authorization: `Bearer ${token}` };
    const a = (await request(app).post('/api/v1/folders').set(auth).send({ name: 'A' })).body.folder;
    const b = (
      await request(app).post('/api/v1/folders').set(auth).send({ name: 'B', parentId: a.id })
    ).body.folder;

    await request(app).patch(`/api/v1/folders/${a.id}`).set(auth).send({ name: 'Renamed' });

    const bAfter = await request(app).get(`/api/v1/folders/${b.id}`).set(auth);
    expect(bAfter.body.folder.path).toBe('/Renamed/B/');
  });

  it('rejects a duplicate folder name in the same parent', async () => {
    const { token } = await registerUser(app);
    const auth = { Authorization: `Bearer ${token}` };
    await request(app).post('/api/v1/folders').set(auth).send({ name: 'Dup' });
    const dup = await request(app).post('/api/v1/folders').set(auth).send({ name: 'Dup' });
    expect(dup.status).toBe(409);
  });

  it("does not expose another user's folder", async () => {
    const owner = await registerUser(app);
    const folder = (
      await request(app)
        .post('/api/v1/folders')
        .set({ Authorization: `Bearer ${owner.token}` })
        .send({ name: 'Private' })
    ).body.folder;

    const other = await registerUser(app);
    const res = await request(app)
      .get(`/api/v1/folders/${folder.id}`)
      .set({ Authorization: `Bearer ${other.token}` });
    expect(res.status).toBe(404);
  });
});
