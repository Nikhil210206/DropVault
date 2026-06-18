'use client';

import { useState } from 'react';
import { Copy, Download, FileIcon, Link2, MoreVertical, Pencil, Trash2 } from 'lucide-react';
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
import { formatBytes, formatDate } from '@/lib/utils';
import { ApiError } from '@/lib/api-client';
import { ShareDialog } from '@/features/share/share-dialog';
import { filesApi } from './files-api';

interface Props {
  file: PublicFile;
  onRename: (name: string) => void;
  onDelete: () => void;
  onCopy: () => void;
}

export function FileRow({ file, onRename, onDelete, onCopy }: Props) {
  const [shareOpen, setShareOpen] = useState(false);

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
    <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 hover:bg-accent/50">
      <FileIcon className="h-5 w-5 shrink-0 text-muted-foreground" />
      <span className="flex-1 truncate text-sm font-medium">{file.name}</span>
      <span className="hidden w-20 text-right text-xs text-muted-foreground sm:block">{formatBytes(file.size)}</span>
      <span className="hidden w-24 text-right text-xs text-muted-foreground md:block">{formatDate(file.createdAt)}</span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="File actions">
            <MoreVertical className="h-4 w-4" />
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
          <DropdownMenuItem className="text-destructive" onClick={onDelete}>
            <Trash2 className="h-4 w-4" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ShareDialog open={shareOpen} onOpenChange={setShareOpen} fileId={file.id} targetName={file.name} />
    </div>
  );
}
