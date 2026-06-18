'use client';

import { useParams } from 'next/navigation';
import { FileExplorer } from '@/features/files/file-explorer';

export default function FolderPage() {
  const { id } = useParams<{ id: string }>();
  return <FileExplorer folderId={id} />;
}
