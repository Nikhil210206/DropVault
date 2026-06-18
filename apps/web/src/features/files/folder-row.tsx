'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Folder, Link2, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import type { PublicFolder } from '@dropvault/shared';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatDate } from '@/lib/utils';
import { ShareDialog } from '@/features/share/share-dialog';

interface Props {
  folder: PublicFolder;
  onRename: () => void;
  onDelete: () => void;
}

export function FolderRow({ folder, onRename, onDelete }: Props) {
  const router = useRouter();
  const [shareOpen, setShareOpen] = useState(false);

  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 hover:bg-accent/50">
      <button
        type="button"
        className="flex flex-1 items-center gap-3 overflow-hidden text-left"
        onClick={() => router.push(`/folders/${folder.id}`)}
      >
        <Folder className="h-5 w-5 shrink-0 text-primary" />
        <span className="flex-1 truncate text-sm font-medium">{folder.name}</span>
        <span className="hidden text-xs text-muted-foreground sm:block">{formatDate(folder.createdAt)}</span>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Folder actions">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setShareOpen(true)}>
            <Link2 className="h-4 w-4" /> Share
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onRename}>
            <Pencil className="h-4 w-4" /> Rename
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive" onClick={onDelete}>
            <Trash2 className="h-4 w-4" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ShareDialog open={shareOpen} onOpenChange={setShareOpen} folderId={folder.id} targetName={folder.name} />
    </div>
  );
}
