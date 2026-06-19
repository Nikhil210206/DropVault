'use client';

import { HardDrive } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { UserMenu } from './user-menu';

export function Header() {
  return (
    <header className="glass flex h-16 shrink-0 items-center justify-between gap-2 px-6">
      {/* Brand mark on mobile (sidebar is hidden there) */}
      <div className="flex items-center gap-2 md:invisible">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500">
          <HardDrive className="h-4 w-4 text-white" />
        </div>
        <span className="font-semibold tracking-tight">DropVault</span>
      </div>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
