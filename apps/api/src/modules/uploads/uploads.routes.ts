import { Router } from 'express';
import { initUploadSchema, partUrlsSchema } from '@dropvault/shared';
import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import {
  initUpload,
  uploadStatus,
  uploadPartUrls,
  completeUpload,
  abortUpload,
} from './uploads.controller';

export const uploadsRouter: Router = Router();

uploadsRouter.use(authenticate);
uploadsRouter.post('/', validate({ body: initUploadSchema }), initUpload);
uploadsRouter.get('/:id', uploadStatus);
uploadsRouter.post('/:id/parts', validate({ body: partUrlsSchema }), uploadPartUrls);
uploadsRouter.post('/:id/complete', completeUpload);
uploadsRouter.delete('/:id', abortUpload);
