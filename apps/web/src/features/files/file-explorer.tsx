'use client';

import { FolderPlus, Home } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api-client';
import { UploadDropzone } from '@/features/upload/upload-dropzone';
import { useFiles, useFileMutations } from './use-files';
import { useFolder, useFolders, useFolderMutations } from './use-folders';
import { FileRow } from './file-row';
import { FolderRow } from './folder-row';

export function FileExplorer({ folderId }: { folderId: string | null }) {
  const files = useFiles(folderId);
  const folders = useFolders(folderId);
  const current = useFolder(folderId);
  const fileMut = useFileMutations(folderId);
  const folderMut = useFolderMutations(folderId);

  const loading = files.isLoading || folders.isLoading;
  const failed = (files.isError || folders.isError) && !loading;
  const folderList = folders.data?.folders ?? [];
  const fileList = files.data?.data ?? [];
  const empty = !loading && !failed && folderList.length === 0 && fileList.length === 0;

  const toastErr = (e: unknown) => toast.error(e instanceof ApiError ? e.message : 'Something went wrong');

  function newFolder() {
    const name = window.prompt('New folder name');
    if (name) folderMut.create.mutate(name, { onError: toastErr });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Link href="/dashboard" className="flex items-center gap-1 hover:text-foreground">
            <Home className="h-4 w-4" /> My Files
          </Link>
          {folderId && current.data && (
            <>
              <span>/</span>
              <span className="font-medium text-foreground">{current.data.folder.name}</span>
            </>
          )}
        </div>
        <Button variant="outline" onClick={newFolder}>
          <FolderPlus className="h-4 w-4" /> New folder
        </Button>
      </div>

      <UploadDropzone folderId={folderId} />

      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      )}

      {failed && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          Failed to load this folder. Please try again.
        </p>
      )}

      {empty && (
        <div className="rounded-xl border border-dashed p-12 text-center text-sm text-muted-foreground">
          This folder is empty. Upload a file or create a folder to get started.
        </div>
      )}

      {!loading && !failed && (folderList.length > 0 || fileList.length > 0) && (
        <div className="space-y-2">
          {folderList.map((f) => (
            <FolderRow
              key={f.id}
              folder={f}
              onRename={() => {
                const name = window.prompt('Rename folder', f.name);
                if (name && name !== f.name) folderMut.rename.mutate({ id: f.id, name }, { onError: toastErr });
              }}
              onDelete={() => {
                if (window.confirm(`Delete “${f.name}” and everything inside it?`))
                  folderMut.remove.mutate(f.id, { onError: toastErr });
              }}
            />
          ))}
          {fileList.map((f) => (
            <FileRow
              key={f.id}
              file={f}
              onRename={(name) => fileMut.rename.mutate({ id: f.id, name }, { onError: toastErr })}
              onCopy={() => fileMut.copy.mutate(f.id, { onError: toastErr })}
              onDelete={() => {
                if (window.confirm(`Delete “${f.name}”?`)) fileMut.remove.mutate(f.id, { onError: toastErr });
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
