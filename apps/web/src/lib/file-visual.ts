import {
  Archive,
  Code,
  File,
  FileSpreadsheet,
  FileText,
  Film,
  Image as ImageIcon,
  Music,
  type LucideIcon,
} from 'lucide-react';

export interface FileVisual {
  Icon: LucideIcon;
  /** Restrained icon color + soft tint for the grid chip (literal classes, never purged). */
  color: string;
  tint: string;
}

const has = (ext: string, list: string[]) => list.includes(ext);

export function fileVisual(mimeType: string, name: string): FileVisual {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';

  if (mimeType.startsWith('image/')) return { Icon: ImageIcon, color: 'text-blue-500', tint: 'bg-blue-500/10' };
  if (mimeType.startsWith('video/')) return { Icon: Film, color: 'text-rose-500', tint: 'bg-rose-500/10' };
  if (mimeType.startsWith('audio/')) return { Icon: Music, color: 'text-violet-500', tint: 'bg-violet-500/10' };
  if (mimeType === 'application/pdf' || ext === 'pdf')
    return { Icon: FileText, color: 'text-red-500', tint: 'bg-red-500/10' };
  if (has(ext, ['zip', 'rar', '7z', 'tar', 'gz']))
    return { Icon: Archive, color: 'text-amber-500', tint: 'bg-amber-500/10' };
  if (has(ext, ['js', 'ts', 'tsx', 'jsx', 'json', 'html', 'css', 'py', 'go', 'rs', 'java', 'sh']))
    return { Icon: Code, color: 'text-emerald-500', tint: 'bg-emerald-500/10' };
  if (has(ext, ['xls', 'xlsx', 'csv']))
    return { Icon: FileSpreadsheet, color: 'text-green-500', tint: 'bg-green-500/10' };
  if (has(ext, ['doc', 'docx', 'txt', 'md', 'rtf']))
    return { Icon: FileText, color: 'text-sky-500', tint: 'bg-sky-500/10' };

  return { Icon: File, color: 'text-muted-foreground', tint: 'bg-muted' };
}
