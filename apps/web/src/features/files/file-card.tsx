'use client';

import { useState } from 'react';
import { Copy, Download, Link2, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { PublicFile } from '@dropvault/shared';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn, formatBytes } from '@/lib/utils';
import { fileVisual } from '@/lib/file-visual';
import { ApiError } from '@/lib/api-client';
import { ShareDialog } from '@/features/share/share-dialog';
import { filesApi } from './files-api';

interface Props {
  file: PublicFile;
  onRename: (name: string) => void;
  onDelete: () => void;
  onCopy: () => void;
}

export function FileCard({ file, onRename, onDelete, onCopy }: Props) {
  const [shareOpen, setShareOpen] = useState(false);
  const { Icon, color, tint } = fileVisual(file.mimeType, file.name);
  const ready = file.status === 'READY';

  async function download() {
    try {
      const { url } = await filesApi.downloadUrl(file.id);
      window.location.href = url;
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Download failed');
    }
  }

  function rename() {
    const name = window.prompt('Rename file', file.name);
    if (name && name !== file.name) onRename(name);
  }

  return (
    <div className="group relative rounded-xl border border-border bg-card p-3 transition-all hover:border-foreground/20 hover:shadow-sm">
      <button
        type="button"
        onClick={download}
        disabled={!ready}
        className="block w-full text-left disabled:cursor-default"
        title={ready ? 'Download' : 'Processing…'}
      >
        <div className={cn('mb-3 flex aspect-[4/3] items-center justify-center rounded-lg', tint)}>
          <Icon className={cn('h-8 w-8', color)} strokeWidth={1.5} />
        </div>
        <p className="truncate text-sm font-medium">{file.name}</p>
        <p className="text-xs text-muted-foreground">{ready ? formatBytes(file.size) : 'Processing…'}</p>
      </button>

      <div className="absolute right-2.5 top-2.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 [&:has([data-state=open])]:opacity-100">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="h-7 w-7" aria-label="File actions">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={download}>
              <Download className="h-4 w-4" /> Download
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShareOpen(true)}>
              <Link2 className="h-4 w-4" /> Share
            </DropdownMenuItem>
            <DropdownMenuItem onClick={rename}>
              <Pencil className="h-4 w-4" /> Rename
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onCopy}>
              <Copy className="h-4 w-4" /> Make a copy
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onDelete}>
              <Trash2 className="h-4 w-4" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ShareDialog open={shareOpen} onOpenChange={setShareOpen} fileId={file.id} targetName={file.name} />
    </div>
  );
}
