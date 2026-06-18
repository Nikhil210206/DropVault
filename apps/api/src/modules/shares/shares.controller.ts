import type { Request, Response } from 'express';
import type { CreateShareInput, VerifyShareInput } from '@dropvault/shared';
import { sharesService } from './shares.service';

function ctxOf(req: Request): { ip?: string; userAgent?: string } {
  return { ip: req.ip, userAgent: req.get('user-agent') ?? undefined };
}

// ── Owner (authenticated) ──────────────────────────────────────────────
export async function createShare(req: Request, res: Response): Promise<void> {
  res.status(201).json({ share: await sharesService.create(req.user!.id, req.body as CreateShareInput) });
}

export async function listShares(req: Request, res: Response): Promise<void> {
  res.json({ shares: await sharesService.listMine(req.user!.id) });
}

export async function revokeShare(req: Request, res: Response): Promise<void> {
  await sharesService.revoke(req.user!.id, req.params.id as string);
  res.status(204).send();
}

// ── Public (recipient, no auth) ────────────────────────────────────────
export async function resolveShare(req: Request, res: Response): Promise<void> {
  res.json(await sharesService.resolve(req.params.token as string));
}

export async function verifyShare(req: Request, res: Response): Promise<void> {
  res.json(await sharesService.verify(req.params.token as string, (req.body as VerifyShareInput).password));
}

export async function downloadShare(req: Request, res: Response): Promise<void> {
  const grant = typeof req.query.grant === 'string' ? req.query.grant : undefined;
  const fileId = typeof req.query.fileId === 'string' ? req.query.fileId : undefined;
  res.json(await sharesService.download(req.params.token as string, { grant, fileId }, ctxOf(req)));
}
