'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Files, HardDrive } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { cn, formatBytes } from '@/lib/utils';

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const user = useAuthStore((s) => s.user);
  const pathname = usePathname();
  const used = Number(user?.storageUsed ?? 0);
  const quota = Number(user?.storageQuota ?? 1);
  const pct = Math.min(100, Math.round((used / quota) * 100));
  const active = pathname === '/dashboard' || pathname.startsWith('/folders');

  return (
    <>
      <div className="flex h-16 items-center gap-2.5 px-5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <HardDrive className="h-4 w-4" />
        </div>
        <span className="text-[15px] font-semibold tracking-tight">DropVault</span>
      </div>

      <nav className="flex-1 space-y-0.5 px-3">
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className={cn(
            'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
            active ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
          )}
        >
          <Files className="h-[18px] w-[18px]" />
          My Files
        </Link>
      </nav>

      <div className="px-3 pb-5">
        <div className="rounded-xl border border-border p-3.5">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="font-medium text-muted-foreground">Storage</span>
            <span className="tabular-nums text-muted-foreground">{pct}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {formatBytes(used)} of {formatBytes(quota)}
          </p>
        </div>
      </div>
    </>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-card lg:flex">
      <SidebarContent />
    </aside>
  );
}
