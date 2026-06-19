'use client';

import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { logout } from '@/features/auth/auth-api';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function UserMenu() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const initials = (user?.name ?? '?').slice(0, 2).toUpperCase();

  async function onLogout() {
    await logout();
    router.replace('/login');
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/20"
          aria-label="Account"
        >
          {initials}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="truncate text-sm font-medium">{user?.name}</div>
          <div className="truncate text-xs text-muted-foreground">{user?.email}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onLogout}>
          <LogOut className="h-4 w-4" /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
