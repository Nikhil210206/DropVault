'use client';

import type { ComponentProps } from 'react';
import { useTheme } from 'next-themes';
import { Toaster as Sonner } from 'sonner';

type ToasterProps = ComponentProps<typeof Sonner>;

export function Toaster(props: ToasterProps) {
  const { theme = 'system' } = useTheme();
  return <Sonner theme={theme as ToasterProps['theme']} richColors closeButton {...props} />;
}
