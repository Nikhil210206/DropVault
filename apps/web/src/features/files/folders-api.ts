import type { CreateFolderInput, PublicFolder } from '@dropvault/shared';
import { api } from '@/lib/api-client';

export const foldersApi = {
  list: (parentId: string | null) =>
    api.get<{ folders: PublicFolder[] }>(`/folders${parentId ? `?parentId=${parentId}` : ''}`),
  get: (id: string) => api.get<{ folder: PublicFolder }>(`/folders/${id}`),
  create: (input: CreateFolderInput) => api.post<{ folder: PublicFolder }>('/folders', input),
  rename: (id: string, name: string) => api.patch<{ folder: PublicFolder }>(`/folders/${id}`, { name }),
  remove: (id: string) => api.del<void>(`/folders/${id}`),
};
