import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../password';
import { generateToken, hashToken } from '../tokens';
import { signAccessToken, verifyAccessToken } from '../../services/jwt.service';

describe('password', () => {
  it('hashes and verifies (argon2id)', async () => {
    const hash = await hashPassword('Secret123');
    expect(hash).not.toBe('Secret123');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(await verifyPassword(hash, 'Secret123')).toBe(true);
    expect(await verifyPassword(hash, 'wrong-password')).toBe(false);
  });
});

describe('tokens', () => {
  it('generates random tokens and a deterministic hash', () => {
    expect(generateToken()).not.toBe(generateToken());
    expect(hashToken('abc')).toBe(hashToken('abc'));
    expect(hashToken('abc')).not.toBe(hashToken('abd'));
  });
});

describe('jwt (EdDSA)', () => {
  it('signs and verifies an access token', async () => {
    const token = await signAccessToken({ sub: 'u1', role: 'USER', email: 'a@b.co' });
    const claims = await verifyAccessToken(token);
    expect(claims.sub).toBe('u1');
    expect(claims.role).toBe('USER');
    expect(claims.email).toBe('a@b.co');
  });

  it('rejects a tampered token', async () => {
    const token = await signAccessToken({ sub: 'u1', role: 'USER', email: 'a@b.co' });
    await expect(verifyAccessToken(`${token}tamper`)).rejects.toThrow();
  });
});
