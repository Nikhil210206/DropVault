import type { Paginated, PublicFile, UpdateFileInput } from '@dropvault/shared';
import { api } from '@/lib/api-client';

export const filesApi = {
  list: (folderId: string | null) =>
    api.get<Paginated<PublicFile>>(`/files${folderId ? `?folderId=${folderId}` : ''}`),
  update: (id: string, input: UpdateFileInput) => api.patch<{ file: PublicFile }>(`/files/${id}`, input),
  remove: (id: string) => api.del<void>(`/files/${id}`),
  copy: (id: string) => api.post<{ file: PublicFile }>(`/files/${id}/copy`),
  downloadUrl: (id: string) => api.get<{ url: string }>(`/files/${id}/download`),
};
