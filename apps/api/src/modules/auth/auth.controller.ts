import type { Request, Response } from 'express';
import type {
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  VerifyEmailInput,
} from '@dropvault/shared';

import { AppError } from '../../utils/app-error';
import { setRefreshCookie, clearRefreshCookie, REFRESH_COOKIE } from '../../utils/cookies';
import { authService, type RequestContext } from './auth.service';

function ctxOf(req: Request): RequestContext {
  return { ip: req.ip, userAgent: req.get('user-agent') ?? undefined };
}

export async function register(req: Request, res: Response): Promise<void> {
  const result = await authService.register(req.body as RegisterInput, ctxOf(req));
  setRefreshCookie(res, result.refreshToken, result.refreshMaxAgeMs);
  res.status(201).json({ user: result.user, accessToken: result.accessToken });
}

export async function login(req: Request, res: Response): Promise<void> {
  const result = await authService.login(req.body as LoginInput, ctxOf(req));
  setRefreshCookie(res, result.refreshToken, result.refreshMaxAgeMs);
  res.status(200).json({ user: result.user, accessToken: result.accessToken });
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const result = await authService.refresh(req.cookies?.[REFRESH_COOKIE], ctxOf(req));
  setRefreshCookie(res, result.refreshToken, result.refreshMaxAgeMs);
  res.status(200).json({ user: result.user, accessToken: result.accessToken });
}

export async function logout(req: Request, res: Response): Promise<void> {
  await authService.logout(req.cookies?.[REFRESH_COOKIE]);
  clearRefreshCookie(res);
  res.status(204).send();
}

export async function me(req: Request, res: Response): Promise<void> {
  if (!req.user) throw AppError.unauthorized();
  res.status(200).json({ user: await authService.getMe(req.user.id) });
}

export async function verifyEmail(req: Request, res: Response): Promise<void> {
  await authService.verifyEmail((req.body as VerifyEmailInput).token);
  res.status(200).json({ message: 'Email verified' });
}

export async function forgotPassword(req: Request, res: Response): Promise<void> {
  await authService.forgotPassword(req.body as ForgotPasswordInput);
  res.status(200).json({ message: 'If an account exists, a reset link has been sent' });
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  const { token, password } = req.body as ResetPasswordInput;
  await authService.resetPassword(token, password);
  res.status(200).json({ message: 'Password reset; please log in again' });
}
