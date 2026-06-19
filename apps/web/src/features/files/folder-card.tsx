'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Folder, Link2, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import type { PublicFolder } from '@dropvault/shared';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ShareDialog } from '@/features/share/share-dialog';

interface Props {
  folder: PublicFolder;
  onRename: () => void;
  onDelete: () => void;
}

export function FolderCard({ folder, onRename, onDelete }: Props) {
  const router = useRouter();
  const [shareOpen, setShareOpen] = useState(false);

  return (
    <div className="group relative rounded-xl border border-border bg-card p-3 transition-all hover:border-foreground/20 hover:shadow-sm">
      <button
        type="button"
        onClick={() => router.push(`/folders/${folder.id}`)}
        className="block w-full text-left"
        title="Open folder"
      >
        <div className="mb-3 flex aspect-[4/3] items-center justify-center rounded-lg bg-amber-500/10">
          <Folder className="h-8 w-8 text-amber-500" strokeWidth={1.5} />
        </div>
        <p className="truncate text-sm font-medium">{folder.name}</p>
        <p className="text-xs text-muted-foreground">Folder</p>
      </button>

      <div className="absolute right-2.5 top-2.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 [&:has([data-state=open])]:opacity-100">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="h-7 w-7" aria-label="Folder actions">
              <MoreHorizontal className="h-4 w-4" />
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
            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onDelete}>
              <Trash2 className="h-4 w-4" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ShareDialog open={shareOpen} onOpenChange={setShareOpen} folderId={folder.id} targetName={folder.name} />
    </div>
  );
}
