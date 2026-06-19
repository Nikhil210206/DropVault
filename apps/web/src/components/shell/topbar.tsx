'use client';

import { HardDrive } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { MobileNav } from './mobile-nav';
import { UserMenu } from './user-menu';

export function Topbar() {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md lg:px-8">
      <div className="flex items-center gap-2">
        <MobileNav />
        <div className="flex items-center gap-2 lg:hidden">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <HardDrive className="h-4 w-4" />
          </div>
          <span className="text-[15px] font-semibold tracking-tight">DropVault</span>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
