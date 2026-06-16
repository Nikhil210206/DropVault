import { Router } from 'express';
import { authRouter } from '../modules/auth/auth.routes';

/** Versioned API router. Feature modules mount here. */
export const apiRouter: Router = Router();

apiRouter.get('/', (_req, res) => {
  res.json({ name: 'DropVault API', version: 'v1' });
});

apiRouter.use('/auth', authRouter);
