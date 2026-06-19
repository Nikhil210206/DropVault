'use client';

import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SidebarContent } from './sidebar';

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0 lg:hidden" />
        <Dialog.Content
          className="fixed inset-y-0 left-0 z-50 flex w-[17rem] flex-col border-r border-border bg-card shadow-lg data-[state=open]:animate-in data-[state=open]:slide-in-from-left lg:hidden"
          onClick={(e) => {
            // Close when a nav link inside is tapped.
            if ((e.target as HTMLElement).closest('a')) setOpen(false);
          }}
        >
          <Dialog.Title className="sr-only">Navigation</Dialog.Title>
          <Dialog.Close asChild>
            <Button variant="ghost" size="icon" className="absolute right-3 top-3" aria-label="Close menu">
              <X className="h-5 w-5" />
            </Button>
          </Dialog.Close>
          <SidebarContent onNavigate={() => setOpen(false)} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
