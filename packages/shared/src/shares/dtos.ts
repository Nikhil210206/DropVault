import { z } from 'zod';

export const createShareSchema = z
  .object({
    fileId: z.string().uuid().optional(),
    folderId: z.string().uuid().optional(),
    password: z.string().min(4).max(128).optional(),
    expiresInHours: z.number().int().positive().max(8760).optional(), // up to 1 year
    maxDownloads: z.number().int().positive().max(100_000).optional(),
    oneTime: z.boolean().optional(),
    allowDownload: z.boolean().optional(),
  })
  .refine((d) => (d.fileId ? 1 : 0) + (d.folderId ? 1 : 0) === 1, {
    message: 'Provide exactly one of fileId or folderId',
  });
export type CreateShareInput = z.infer<typeof createShareSchema>;

export const verifyShareSchema = z.object({
  password: z.string().min(1).max(128),
});
export type VerifyShareInput = z.infer<typeof verifyShareSchema>;
