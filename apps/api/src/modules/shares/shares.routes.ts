import { Router } from 'express';
import { createShareSchema, verifyShareSchema } from '@dropvault/shared';
import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import { createRateLimiter, failOpen } from '../../middleware/rate-limit';
import {
  createShare,
  listShares,
  revokeShare,
  resolveShare,
  verifyShare,
  downloadShare,
} from './shares.controller';

// Brute-force protection on share-password verification.
const verifyLimiter = failOpen(createRateLimiter('share-verify', { windowMs: 60_000, limit: 10 }));

export const sharesRouter: Router = Router();

// Owner endpoints (authenticated).
sharesRouter.post('/', authenticate, validate({ body: createShareSchema }), createShare);
sharesRouter.get('/', authenticate, listShares);
sharesRouter.delete('/:id', authenticate, revokeShare);

// Public recipient endpoints (token in the URL is the secret; no auth).
sharesRouter.get('/:token', resolveShare);
sharesRouter.post('/:token/verify', verifyLimiter, validate({ body: verifyShareSchema }), verifyShare);
sharesRouter.get('/:token/download', downloadShare);
