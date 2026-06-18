'use client';

import { useCallback, useRef, useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { filesKey } from '@/features/files/use-files';
import { useUploadStore } from './upload-store';
import { uploadFile } from './upload-client';

export function UploadDropzone({ folderId }: { folderId: string | null }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const add = useUploadStore((s) => s.add);
  const update = useUploadStore((s) => s.update);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return;
      for (const file of Array.from(files)) {
        const id = crypto.randomUUID();
        add({ id, name: file.name, progress: 0, status: 'uploading' });
        uploadFile(file, folderId, (pct) => update(id, { progress: pct }))
          .then(() => {
            update(id, { status: 'done', progress: 100 });
            void qc.invalidateQueries({ queryKey: filesKey(folderId) });
          })
          .catch((e: unknown) => {
            update(id, { status: 'error', error: e instanceof Error ? e.message : 'Upload failed' });
            toast.error(`${file.name}: upload failed`);
          });
      }
    },
    [folderId, add, update, qc],
  );

  return (
    <div
      role="button"
      tabIndex={0}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        handleFiles(e.dataTransfer.files);
      }}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors',
        dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50',
      )}
    >
      <UploadCloud className="h-8 w-8 text-muted-foreground" />
      <p className="text-sm font-medium">Drag &amp; drop files here, or click to browse</p>
      <p className="text-xs text-muted-foreground">Resumable multipart uploads, up to 5&nbsp;GiB each</p>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
