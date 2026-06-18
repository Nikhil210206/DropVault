'use client';

import { ThemeToggle } from '@/components/theme-toggle';
import { UserMenu } from './user-menu';

export function Header() {
  return (
    <header className="flex h-14 shrink-0 items-center justify-end gap-2 border-b px-6">
      <ThemeToggle />
      <UserMenu />
    </header>
  );
}
