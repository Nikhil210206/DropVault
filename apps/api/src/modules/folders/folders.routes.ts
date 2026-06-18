import { Router } from 'express';
import { createFolderSchema, renameFolderSchema, listFoldersQuerySchema } from '@dropvault/shared';
import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import {
  createFolder,
  listFolders,
  getFolder,
  renameFolder,
  deleteFolder,
} from './folders.controller';

export const foldersRouter: Router = Router();

foldersRouter.use(authenticate);
foldersRouter.post('/', validate({ body: createFolderSchema }), createFolder);
foldersRouter.get('/', validate({ query: listFoldersQuerySchema }), listFolders);
foldersRouter.get('/:id', getFolder);
foldersRouter.patch('/:id', validate({ body: renameFolderSchema }), renameFolder);
foldersRouter.delete('/:id', deleteFolder);
