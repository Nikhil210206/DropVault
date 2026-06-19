import type { Paginated, PublicFile, UpdateFileInput } from '@dropvault/shared';
import { api } from '@/lib/api-client';

export const filesApi = {
  list: (folderId: string | null, q?: string) => {
    const params = new URLSearchParams();
    if (folderId) params.set('folderId', folderId);
    if (q) params.set('q', q);
    const qs = params.toString();
    return api.get<Paginated<PublicFile>>(`/files${qs ? `?${qs}` : ''}`);
  },
  update: (id: string, input: UpdateFileInput) => api.patch<{ file: PublicFile }>(`/files/${id}`, input),
  remove: (id: string) => api.del<void>(`/files/${id}`),
  copy: (id: string) => api.post<{ file: PublicFile }>(`/files/${id}/copy`),
  downloadUrl: (id: string) => api.get<{ url: string }>(`/files/${id}/download`),
};
