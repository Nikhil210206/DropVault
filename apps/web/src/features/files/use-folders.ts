'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { foldersApi } from './folders-api';

export const foldersKey = (parentId: string | null) => ['folders', parentId ?? 'root'] as const;

export function useFolders(parentId: string | null) {
  return useQuery({ queryKey: foldersKey(parentId), queryFn: () => foldersApi.list(parentId) });
}

export function useFolder(id: string | null) {
  return useQuery({
    queryKey: ['folder', id],
    queryFn: () => foldersApi.get(id as string),
    enabled: Boolean(id),
  });
}

export function useFolderMutations(parentId: string | null) {
  const qc = useQueryClient();
  const invalidate = () => void qc.invalidateQueries({ queryKey: foldersKey(parentId) });
  return {
    create: useMutation({
      mutationFn: (name: string) => foldersApi.create({ name, parentId: parentId ?? undefined }),
      onSuccess: invalidate,
    }),
    rename: useMutation({
      mutationFn: ({ id, name }: { id: string; name: string }) => foldersApi.rename(id, name),
      onSuccess: invalidate,
    }),
    remove: useMutation({ mutationFn: (id: string) => foldersApi.remove(id), onSuccess: invalidate }),
  };
}
