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
        'flex cursor-pointer items-center justify-center gap-2.5 rounded-xl border border-dashed px-6 py-4 text-sm transition-colors',
        dragging
          ? 'border-primary bg-accent text-foreground'
          : 'border-border text-muted-foreground hover:border-foreground/25 hover:bg-muted/40',
      )}
    >
      <UploadCloud className="h-5 w-5 shrink-0" strokeWidth={1.75} />
      <span>
        Drop files to upload, or <span className="font-medium text-primary">browse</span>
        <span className="hidden text-muted-foreground sm:inline"> · up to 5&nbsp;GiB each</span>
      </span>
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
