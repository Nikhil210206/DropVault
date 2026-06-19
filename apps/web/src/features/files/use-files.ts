'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { filesApi } from './files-api';

export const filesKey = (folderId: string | null) => ['files', folderId ?? 'root'] as const;

export function useFiles(folderId: string | null, q?: string) {
  return useQuery({
    queryKey: [...filesKey(folderId), q ?? ''],
    queryFn: () => filesApi.list(folderId, q),
  });
}

export function useFileMutations(folderId: string | null) {
  const qc = useQueryClient();
  const invalidate = () => void qc.invalidateQueries({ queryKey: filesKey(folderId) });
  return {
    rename: useMutation({
      mutationFn: ({ id, name }: { id: string; name: string }) => filesApi.update(id, { name }),
      onSuccess: invalidate,
    }),
    remove: useMutation({ mutationFn: (id: string) => filesApi.remove(id), onSuccess: invalidate }),
    copy: useMutation({ mutationFn: (id: string) => filesApi.copy(id), onSuccess: invalidate }),
  };
}
