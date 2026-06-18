import { randomUUID } from 'node:crypto';
import { VerificationTokenType, type User } from '@prisma/client';
import type {
  ForgotPasswordInput,
  LoginInput,
  PublicUser,
  RegisterInput,
} from '@dropvault/shared';

import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { AppError } from '../../utils/app-error';
import { hashPassword, verifyPassword } from '../../utils/password';
import { generateToken, hashToken } from '../../utils/tokens';
import { signAccessToken } from '../../services/jwt.service';
import { mailer } from '../../services/mail/mailer';
import { verificationEmail, passwordResetEmail } from '../../services/mail/templates';
import { authRepository } from './auth.repository';

export interface RequestContext {
  ip?: string;
  userAgent?: string;
}

export interface SessionResult {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
  refreshMaxAgeMs: number;
}

const REFRESH_TTL_MS = () => env.REFRESH_TOKEN_TTL_DAYS * 86_400_000;

function toPublicUser(u: User): PublicUser {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    emailVerified: u.emailVerified,
    storageUsed: u.storageUsed.toString(),
    storageQuota: u.storageQuota.toString(),
    createdAt: u.createdAt.toISOString(),
  };
}

// Cached dummy hash so a login for a non-existent email costs the same as a real one
// (mitigates user-enumeration via timing).
let dummyHashCache: Promise<string> | undefined;
const dummyHash = () => (dummyHashCache ??= hashPassword('timing-equalizer-not-a-real-password'));

async function startSession(user: User, ctx: RequestContext): Promise<SessionResult> {
  const familyId = randomUUID();
  const raw = generateToken();
  const ttlMs = REFRESH_TTL_MS();
  await authRepository.createRefreshToken({
    userId: user.id,
    tokenHash: hashToken(raw),
    familyId,
    expiresAt: new Date(Date.now() + ttlMs),
    userAgent: ctx.userAgent,
    ip: ctx.ip,
  });
  const accessToken = await signAccessToken({ sub: user.id, role: user.role, email: user.email });
  return { user: toPublicUser(user), accessToken, refreshToken: raw, refreshMaxAgeMs: ttlMs };
}

async function sendVerificationEmail(user: User): Promise<void> {
  const raw = generateToken();
  await authRepository.createVerificationToken({
    userId: user.id,
    type: VerificationTokenType.EMAIL_VERIFY,
    tokenHash: hashToken(raw),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });
  // Best-effort: an email outage must not block signup (user can request a resend).
  await mailer
    .send(user.email, verificationEmail(`${env.WEB_URL}/verify-email?token=${raw}`))
    .catch((e: unknown) => logger.warn('Verification email failed', { err: String(e) }));
}

export const authService = {
  async register(input: RegisterInput, ctx: RequestContext): Promise<SessionResult> {
    const existing = await authRepository.findActiveUserByEmail(input.email);
    if (existing) throw AppError.conflict('Email already registered');

    const passwordHash = await hashPassword(input.password);
    const user = await authRepository.createUser({
      email: input.email,
      name: input.name,
      passwordHash,
    });
    await sendVerificationEmail(user);
    return startSession(user, ctx);
  },

  async login(input: LoginInput, ctx: RequestContext): Promise<SessionResult> {
    const user = await authRepository.findActiveUserByEmail(input.email);
    if (!user) {
      await verifyPassword(await dummyHash(), input.password).catch(() => undefined);
      throw AppError.unauthorized('Invalid email or password');
    }
    const ok = await verifyPassword(user.passwordHash, input.password);
    if (!ok) throw AppError.unauthorized('Invalid email or password');
    return startSession(user, ctx);
  },

  async refresh(rawToken: string | undefined, ctx: RequestContext): Promise<SessionResult> {
    if (!rawToken) throw AppError.unauthorized('Missing refresh token');

    const token = await authRepository.findRefreshToken(hashToken(rawToken));
    if (!token) throw AppError.unauthorized('Invalid refresh token');

    // Reuse of an already-rotated/revoked token → likely theft. Burn the whole family.
    if (token.revokedAt) {
      await authRepository.revokeFamily(token.familyId);
      throw AppError.unauthorized('Refresh token reuse detected');
    }
    if (token.expiresAt.getTime() < Date.now()) {
      await authRepository.revokeRefreshToken(token.id);
      throw AppError.unauthorized('Refresh token expired');
    }

    const user = await authRepository.findUserById(token.userId);
    if (!user || user.deletedAt) {
      await authRepository.revokeFamily(token.familyId);
      throw AppError.unauthorized('Account no longer active');
    }

    const raw = generateToken();
    const ttlMs = REFRESH_TTL_MS();
    await authRepository.rotateRefreshToken(token.id, {
      userId: user.id,
      tokenHash: hashToken(raw),
      familyId: token.familyId,
      expiresAt: new Date(Date.now() + ttlMs),
      userAgent: ctx.userAgent,
      ip: ctx.ip,
    });
    const accessToken = await signAccessToken({ sub: user.id, role: user.role, email: user.email });
    return { user: toPublicUser(user), accessToken, refreshToken: raw, refreshMaxAgeMs: ttlMs };
  },

  async logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken) return;
    const token = await authRepository.findRefreshToken(hashToken(rawToken));
    if (token && !token.revokedAt) await authRepository.revokeRefreshToken(token.id);
  },

  async forgotPassword(input: ForgotPasswordInput): Promise<void> {
    const user = await authRepository.findActiveUserByEmail(input.email);
    // Always return success to avoid revealing whether an account exists.
    if (!user) return;
    const raw = generateToken();
    await authRepository.createVerificationToken({
      userId: user.id,
      type: VerificationTokenType.PASSWORD_RESET,
      tokenHash: hashToken(raw),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    await mailer
      .send(user.email, passwordResetEmail(`${env.WEB_URL}/reset-password?token=${raw}`))
      .catch((e: unknown) => logger.warn('Password-reset email failed', { err: String(e) }));
  },

  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const vt = await authRepository.findVerificationToken(
      hashToken(rawToken),
      VerificationTokenType.PASSWORD_RESET,
    );
    if (!vt || vt.usedAt || vt.expiresAt.getTime() < Date.now()) {
      throw AppError.badRequest('Invalid or expired reset token');
    }
    await authRepository.updatePassword(vt.userId, await hashPassword(newPassword));
    await authRepository.markVerificationTokenUsed(vt.id);
    // Force re-login everywhere after a password change.
    await authRepository.revokeAllUserTokens(vt.userId);
  },

  async verifyEmail(rawToken: string): Promise<void> {
    const vt = await authRepository.findVerificationToken(
      hashToken(rawToken),
      VerificationTokenType.EMAIL_VERIFY,
    );
    if (!vt || vt.usedAt || vt.expiresAt.getTime() < Date.now()) {
      throw AppError.badRequest('Invalid or expired verification token');
    }
    await authRepository.markEmailVerified(vt.userId);
    await authRepository.markVerificationTokenUsed(vt.id);
  },

  async getMe(userId: string): Promise<PublicUser> {
    const user = await authRepository.findUserById(userId);
    if (!user || user.deletedAt) throw AppError.unauthorized();
    return toPublicUser(user);
  },
};
