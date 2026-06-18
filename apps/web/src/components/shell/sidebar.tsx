'use client';

import Link from 'next/link';
import { Files, HardDrive } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { formatBytes } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

export function Sidebar() {
  const user = useAuthStore((s) => s.user);
  const used = Number(user?.storageUsed ?? 0);
  const quota = Number(user?.storageQuota ?? 1);
  const pct = Math.min(100, Math.round((used / quota) * 100));

  return (
    <aside className="hidden w-64 flex-col border-r bg-card md:flex">
      <div className="flex h-14 items-center gap-2 border-b px-6 font-semibold">
        <HardDrive className="h-5 w-5 text-primary" /> DropVault
      </div>
      <nav className="flex-1 p-3">
        <Link href="/dashboard" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent">
          <Files className="h-4 w-4" /> My Files
        </Link>
      </nav>
      <div className="border-t p-4">
        <p className="mb-2 text-xs text-muted-foreground">Storage</p>
        <Progress value={pct} />
        <p className="mt-2 text-xs text-muted-foreground">
          {formatBytes(used)} of {formatBytes(quota)}
        </p>
      </div>
    </aside>
  );
}
