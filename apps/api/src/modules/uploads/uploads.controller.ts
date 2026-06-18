import type { Request, Response } from 'express';
import type { InitUploadInput, PartUrlsInput } from '@dropvault/shared';
import { uploadsService } from './uploads.service';

export async function initUpload(req: Request, res: Response): Promise<void> {
  res.status(201).json(await uploadsService.init(req.user!.id, req.body as InitUploadInput));
}

export async function uploadStatus(req: Request, res: Response): Promise<void> {
  res.json(await uploadsService.status(req.user!.id, req.params.id as string));
}

export async function uploadPartUrls(req: Request, res: Response): Promise<void> {
  const { partNumbers } = req.body as PartUrlsInput;
  res.json({ parts: await uploadsService.partUrls(req.user!.id, req.params.id as string, partNumbers) });
}

export async function completeUpload(req: Request, res: Response): Promise<void> {
  res.status(201).json({ file: await uploadsService.complete(req.user!.id, req.params.id as string) });
}

export async function abortUpload(req: Request, res: Response): Promise<void> {
  await uploadsService.abort(req.user!.id, req.params.id as string);
  res.status(204).send();
}
