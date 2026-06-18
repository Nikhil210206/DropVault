import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../app';

const app = createApp();
const register = (email: string) =>
  request(app).post('/api/v1/auth/register').send({ email, name: 'T', password: 'Secret123' });

describe('auth', () => {
  it('registers and returns an access token + user', async () => {
    const res = await register('a@dropvault.test');
    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.user.emailVerified).toBe(false);
  });

  it('returns the current user from GET /me', async () => {
    const reg = await register('b@dropvault.test');
    const me = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${reg.body.accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe('b@dropvault.test');
  });

  it('rejects /me without a token', async () => {
    expect((await request(app).get('/api/v1/auth/me')).status).toBe(401);
  });

  it('rejects duplicate registration', async () => {
    await register('c@dropvault.test');
    expect((await register('c@dropvault.test')).status).toBe(409);
  });

  it('rejects login with a wrong password', async () => {
    await register('d@dropvault.test');
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'd@dropvault.test', password: 'WrongPass9' });
    expect(res.status).toBe(401);
  });

  it('rotates the refresh token and detects reuse', async () => {
    const reg = await register('e@dropvault.test');
    const cookie = ((reg.headers['set-cookie'] as unknown as string[])[0] ?? '').split(';')[0] ?? '';

    const first = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);
    expect(first.status).toBe(200);

    const reuse = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);
    expect(reuse.status).toBe(401); // rotated token replayed → family revoked
  });
});
