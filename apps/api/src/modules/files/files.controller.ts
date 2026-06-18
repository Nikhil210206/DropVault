import type { Request, Response } from 'express';
import type { ListFilesQuery, UpdateFileInput } from '@dropvault/shared';
import { filesService, type RequestContext } from './files.service';

function ctxOf(req: Request): RequestContext {
  return { ip: req.ip, userAgent: req.get('user-agent') ?? undefined };
}

export async function listFiles(req: Request, res: Response): Promise<void> {
  res.json(await filesService.list(req.user!.id, req.validatedQuery as ListFilesQuery));
}

export async function getFile(req: Request, res: Response): Promise<void> {
  res.json({ file: await filesService.get(req.user!.id, req.params.id as string) });
}

export async function updateFile(req: Request, res: Response): Promise<void> {
  const file = await filesService.update(req.user!.id, req.params.id as string, req.body as UpdateFileInput);
  res.json({ file });
}

export async function copyFile(req: Request, res: Response): Promise<void> {
  res.status(201).json({ file: await filesService.copy(req.user!.id, req.params.id as string) });
}

export async function deleteFile(req: Request, res: Response): Promise<void> {
  await filesService.remove(req.user!.id, req.params.id as string);
  res.status(204).send();
}

export async function downloadFile(req: Request, res: Response): Promise<void> {
  res.json(await filesService.getDownloadUrl(req.user!.id, req.params.id as string, ctxOf(req)));
}

export async function previewFile(req: Request, res: Response): Promise<void> {
  res.json(await filesService.getPreviewUrl(req.user!.id, req.params.id as string));
}
