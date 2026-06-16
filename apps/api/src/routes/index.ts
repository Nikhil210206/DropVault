import { Router } from 'express';

/** Versioned API router. Feature modules (auth, files, shares, …) mount here in later phases. */
export const apiRouter: Router = Router();

apiRouter.get('/', (_req, res) => {
  res.json({ name: 'DropVault API', version: 'v1' });
});
