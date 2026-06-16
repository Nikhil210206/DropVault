import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../app';
import { prisma } from '../../../config/db';

// Integration test against the live local stack (Postgres + Redis). Self-cleaning.
const app = createApp();
const email = `flowtest_${Date.now()}@dropvault.test`;
const password = 'Secret123';

let accessToken = '';
let refreshCookie = '';

const cookieValue = (setCookie: string[] | undefined): string =>
  (setCookie?.[0] ?? '').split(';')[0] ?? '';

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { email } });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email } });
  await prisma.$disconnect();
});

describe('auth flow', () => {
  it('registers a new user and logs them in', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email, name: 'Flow Test', password });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe(email);
    expect(res.body.user.emailVerified).toBe(false);
    expect(res.body.accessToken).toBeTruthy();
    accessToken = res.body.accessToken;
    refreshCookie = cookieValue(res.headers['set-cookie'] as unknown as string[]);
    expect(refreshCookie.startsWith('dv_rt=')).toBe(true);
  });

  it('rejects duplicate registration', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email, name: 'Dupe', password });
    expect(res.status).toBe(409);
  });

  it('returns the current user from GET /me', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(email);
  });

  it('rejects /me without a token', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('rejects login with a wrong password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: 'WrongPass9' });
    expect(res.status).toBe(401);
  });

  it('rotates the refresh token and detects reuse', async () => {
    const first = await request(app).post('/api/v1/auth/refresh').set('Cookie', refreshCookie);
    expect(first.status).toBe(200);
    expect(first.body.accessToken).toBeTruthy();

    // Replaying the now-rotated original cookie must trip reuse detection.
    const reuse = await request(app).post('/api/v1/auth/refresh').set('Cookie', refreshCookie);
    expect(reuse.status).toBe(401);
  });
});
