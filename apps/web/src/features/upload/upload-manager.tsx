'use client';

import { CheckCircle2, Loader2, X, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useUploadStore } from './upload-store';

export function UploadManager() {
  const items = useUploadStore((s) => s.items);
  const clearFinished = useUploadStore((s) => s.clearFinished);
  if (items.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40 w-80 overflow-hidden rounded-xl border border-border bg-card shadow-lg animate-fade-up">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <span className="text-sm font-medium">Uploads</span>
        <Button variant="ghost" size="icon" onClick={clearFinished} aria-label="Clear finished">
          <X className="h-4 w-4" />
        </Button>
      </div>
      <ul className="max-h-64 space-y-2 overflow-y-auto p-3">
        {items.map((it) => (
          <li key={it.id} className="space-y-1">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate">{it.name}</span>
              {it.status === 'uploading' && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />}
              {it.status === 'done' && <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />}
              {it.status === 'error' && <XCircle className="h-4 w-4 shrink-0 text-destructive" />}
            </div>
            {it.status === 'uploading' && <Progress value={it.progress} />}
            {it.status === 'error' && <p className="text-xs text-destructive">{it.error}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
