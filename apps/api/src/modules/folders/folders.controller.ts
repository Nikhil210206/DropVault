import type { Request, Response } from 'express';
import type { CreateFolderInput, ListFoldersQuery, RenameFolderInput } from '@dropvault/shared';
import { foldersService } from './folders.service';

export async function createFolder(req: Request, res: Response): Promise<void> {
  const folder = await foldersService.create(req.user!.id, req.body as CreateFolderInput);
  res.status(201).json({ folder });
}

export async function listFolders(req: Request, res: Response): Promise<void> {
  const { parentId } = req.validatedQuery as ListFoldersQuery;
  res.json({ folders: await foldersService.listChildren(req.user!.id, parentId ?? null) });
}

export async function getFolder(req: Request, res: Response): Promise<void> {
  res.json({ folder: await foldersService.get(req.user!.id, req.params.id as string) });
}

export async function renameFolder(req: Request, res: Response): Promise<void> {
  const { name } = req.body as RenameFolderInput;
  res.json({ folder: await foldersService.rename(req.user!.id, req.params.id as string, name) });
}

export async function deleteFolder(req: Request, res: Response): Promise<void> {
  await foldersService.remove(req.user!.id, req.params.id as string);
  res.status(204).send();
}
