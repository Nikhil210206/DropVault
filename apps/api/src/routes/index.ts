import { Router } from 'express';
import { authRouter } from '../modules/auth/auth.routes';
import { foldersRouter } from '../modules/folders/folders.routes';
import { filesRouter } from '../modules/files/files.routes';
import { uploadsRouter } from '../modules/uploads/uploads.routes';
import { sharesRouter } from '../modules/shares/shares.routes';

/** Versioned API router. Feature modules mount here. */
export const apiRouter: Router = Router();

apiRouter.get('/', (_req, res) => {
  res.json({ name: 'DropVault API', version: 'v1' });
});

apiRouter.use('/auth', authRouter);
apiRouter.use('/folders', foldersRouter);
apiRouter.use('/files', filesRouter);
apiRouter.use('/uploads', uploadsRouter);
apiRouter.use('/shares', sharesRouter);
