'use client';

import { create } from 'zustand';

export interface UploadItem {
  id: string;
  name: string;
  progress: number;
  status: 'uploading' | 'done' | 'error';
  error?: string;
}

interface UploadState {
  items: UploadItem[];
  add: (item: UploadItem) => void;
  update: (id: string, patch: Partial<UploadItem>) => void;
  clearFinished: () => void;
}

export const useUploadStore = create<UploadState>((set) => ({
  items: [],
  add: (item) => set((s) => ({ items: [item, ...s.items] })),
  update: (id, patch) => set((s) => ({ items: s.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) })),
  clearFinished: () => set((s) => ({ items: s.items.filter((it) => it.status === 'uploading') })),
}));
