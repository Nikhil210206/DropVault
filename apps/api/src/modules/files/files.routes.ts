import { Router } from 'express';
import { listFilesQuerySchema, updateFileSchema } from '@dropvault/shared';
import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import {
  listFiles,
  getFile,
  updateFile,
  copyFile,
  deleteFile,
  downloadFile,
  previewFile,
} from './files.controller';

export const filesRouter: Router = Router();

filesRouter.use(authenticate);
filesRouter.get('/', validate({ query: listFilesQuerySchema }), listFiles);
filesRouter.get('/:id', getFile);
filesRouter.patch('/:id', validate({ body: updateFileSchema }), updateFile);
filesRouter.post('/:id/copy', copyFile);
filesRouter.delete('/:id', deleteFile);
filesRouter.get('/:id/download', downloadFile);
filesRouter.get('/:id/preview', previewFile);
