import { z } from 'zod';

export const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024; // 5 GiB

// Names are metadata only (S3 keys are uuid-based), so we just forbid path separators.
export const fileNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .refine((n) => !n.includes('/') && !n.includes('\\'), 'File name cannot contain slashes');

export const initUploadSchema = z.object({
  fileName: fileNameSchema,
  size: z.number().int().positive().max(MAX_FILE_SIZE),
  mimeType: z.string().min(1).max(255),
  folderId: z.string().uuid().nullish(),
});
export type InitUploadInput = z.infer<typeof initUploadSchema>;

export const partUrlsSchema = z.object({
  partNumbers: z.array(z.number().int().positive()).min(1).max(1000),
});
export type PartUrlsInput = z.infer<typeof partUrlsSchema>;

export const updateFileSchema = z
  .object({
    name: fileNameSchema.optional(),
    folderId: z.string().uuid().nullable().optional(),
  })
  .refine((d) => d.name !== undefined || d.folderId !== undefined, 'Nothing to update');
export type UpdateFileInput = z.infer<typeof updateFileSchema>;

export const listFilesQuerySchema = z.object({
  folderId: z.string().uuid().optional(),
  q: z.string().trim().max(255).optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type ListFilesQuery = z.infer<typeof listFilesQuerySchema>;
