'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, FolderPlus, Home, LayoutGrid, List, Search, UploadCloud } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { UploadDropzone } from '@/features/upload/upload-dropzone';
import { useFiles, useFileMutations } from './use-files';
import { useFolder, useFolders, useFolderMutations } from './use-folders';
import { FileRow } from './file-row';
import { FolderRow } from './folder-row';
import { FileCard } from './file-card';
import { FolderCard } from './folder-card';

export function FileExplorer({ folderId }: { folderId: string | null }) {
  const [view, setView] = useState<'list' | 'grid'>('list');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const searching = debounced.length > 0;
  const files = useFiles(folderId, searching ? debounced : undefined);
  const folders = useFolders(folderId);
  const current = useFolder(folderId);
  const fileMut = useFileMutations(folderId);
  const folderMut = useFolderMutations(folderId);

  const loading = files.isLoading || folders.isLoading;
  const failed = (files.isError || folders.isError) && !loading;
  const folderList = searching ? [] : (folders.data?.folders ?? []);
  const fileList = files.data?.data ?? [];
  const isEmpty = !loading && !failed && folderList.length === 0 && fileList.length === 0;

  const toastErr = (e: unknown) => toast.error(e instanceof ApiError ? e.message : 'Something went wrong');

  function newFolder() {
    const name = window.prompt('New folder name');
    if (name) folderMut.create.mutate(name, { onError: toastErr });
  }

  const renameFolder = (id: string, currentName: string) => {
    const name = window.prompt('Rename folder', currentName);
    if (name && name !== currentName) folderMut.rename.mutate({ id, name }, { onError: toastErr });
  };

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <nav className="flex min-w-0 items-center gap-0.5 text-sm">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Home className="h-4 w-4" />
            <span className="hidden sm:inline">My Files</span>
          </Link>
          {folderId && current.data && (
            <>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />
              <span className="truncate rounded-md px-2 py-1 font-medium">{current.data.folder.name}</span>
            </>
          )}
        </nav>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-60 sm:flex-none">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search this folder"
              className="pl-9"
            />
          </div>
          <div className="flex items-center rounded-lg border border-border bg-card p-0.5">
            {(['list', 'grid'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                aria-label={`${v} view`}
                aria-pressed={view === v}
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-md transition-colors',
                  view === v ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {v === 'list' ? <List className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
              </button>
            ))}
          </div>
          <Button onClick={newFolder} className="hidden sm:inline-flex">
            <FolderPlus className="h-4 w-4" /> New folder
          </Button>
          <Button onClick={newFolder} size="icon" className="sm:hidden" aria-label="New folder">
            <FolderPlus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <UploadDropzone folderId={folderId} />

      {/* States */}
      {loading && <LoadingState view={view} />}

      {failed && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card py-16 text-center">
          <p className="text-sm font-medium">Couldn’t load this folder</p>
          <Button variant="outline" size="sm" onClick={() => void files.refetch()}>
            Try again
          </Button>
        </div>
      )}

      {isEmpty && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-20 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
            <UploadCloud className="h-6 w-6 text-muted-foreground" strokeWidth={1.75} />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">{searching ? 'No matches' : 'This folder is empty'}</p>
            <p className="text-sm text-muted-foreground">
              {searching ? 'Try a different search.' : 'Drop files above or create a folder.'}
            </p>
          </div>
        </div>
      )}

      {/* Content */}
      {!loading && !failed && !isEmpty && view === 'list' && (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="hidden items-center gap-3 border-b border-border px-4 py-2.5 text-xs font-medium text-muted-foreground sm:flex">
            <span className="flex-1">Name</span>
            <span className="w-24 text-right">Size</span>
            <span className="hidden w-32 text-right md:block">Modified</span>
            <span className="w-9" />
          </div>
          {folderList.map((f) => (
            <FolderRow
              key={f.id}
              folder={f}
              onRename={() => renameFolder(f.id, f.name)}
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

      {!loading && !failed && !isEmpty && view === 'grid' && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {folderList.map((f) => (
            <FolderCard
              key={f.id}
              folder={f}
              onRename={() => renameFolder(f.id, f.name)}
              onDelete={() => {
                if (window.confirm(`Delete “${f.name}” and everything inside it?`))
                  folderMut.remove.mutate(f.id, { onError: toastErr });
              }}
            />
          ))}
          {fileList.map((f) => (
            <FileCard
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

function LoadingState({ view }: { view: 'list' | 'grid' }) {
  if (view === 'grid') {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-3">
            <Skeleton className="mb-3 aspect-[4/3] w-full rounded-lg" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="mt-1.5 h-3 w-1/2" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-0">
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-4 flex-1 max-w-[14rem]" />
          <Skeleton className="hidden h-4 w-16 sm:block" />
        </div>
      ))}
    </div>
  );
}
