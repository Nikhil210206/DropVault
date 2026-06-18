import { z } from 'zod';

export const folderNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .refine((n) => !n.includes('/') && !n.includes('\\'), 'Folder name cannot contain slashes');

export const createFolderSchema = z.object({
  name: folderNameSchema,
  parentId: z.string().uuid().nullish(),
});
export type CreateFolderInput = z.infer<typeof createFolderSchema>;

export const renameFolderSchema = z.object({
  name: folderNameSchema,
});
export type RenameFolderInput = z.infer<typeof renameFolderSchema>;

export const listFoldersQuerySchema = z.object({
  parentId: z.string().uuid().optional(),
});
export type ListFoldersQuery = z.infer<typeof listFoldersQuerySchema>;
