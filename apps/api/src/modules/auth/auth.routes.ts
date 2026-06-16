import { Router } from 'express';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from '@dropvault/shared';

import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/authenticate';
import { verifyOrigin } from '../../middleware/verify-origin';
import { createRateLimiter, failOpen } from '../../middleware/rate-limit';
import {
  register,
  login,
  refresh,
  logout,
  me,
  verifyEmail,
  forgotPassword,
  resetPassword,
} from './auth.controller';

// Stricter limits on credential endpoints than the global API limiter.
const authLimiter = failOpen(createRateLimiter('auth', { windowMs: 60_000, limit: 10 }));

export const authRouter: Router = Router();

authRouter.post('/register', authLimiter, validate({ body: registerSchema }), register);
authRouter.post('/login', authLimiter, validate({ body: loginSchema }), login);
authRouter.post('/refresh', verifyOrigin, refresh);
authRouter.post('/logout', verifyOrigin, logout);
authRouter.get('/me', authenticate, me);
authRouter.post('/verify-email', validate({ body: verifyEmailSchema }), verifyEmail);
authRouter.post('/forgot-password', authLimiter, validate({ body: forgotPasswordSchema }), forgotPassword);
authRouter.post('/reset-password', authLimiter, validate({ body: resetPasswordSchema }), resetPassword);
