'use client';

import { useState } from 'react';
import { Copy, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError } from '@/lib/api-client';
import { sharesApi } from './shares-api';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileId?: string;
  folderId?: string;
  targetName: string;
}

export function ShareDialog({ open, onOpenChange, fileId, folderId, targetName }: Props) {
  const [password, setPassword] = useState('');
  const [expiresInHours, setExpiresInHours] = useState('');
  const [maxDownloads, setMaxDownloads] = useState('');
  const [oneTime, setOneTime] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function createLink() {
    setBusy(true);
    try {
      const res = await sharesApi.create({
        fileId,
        folderId,
        password: password || undefined,
        expiresInHours: expiresInHours ? Number(expiresInHours) : undefined,
        maxDownloads: maxDownloads ? Number(maxDownloads) : undefined,
        oneTime: oneTime || undefined,
      });
      setUrl(res.share.url);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Failed to create link');
    } finally {
      setBusy(false);
    }
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      setUrl(null);
      setPassword('');
      setExpiresInHours('');
      setMaxDownloads('');
      setOneTime(false);
    }
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="truncate">Share “{targetName}”</DialogTitle>
          <DialogDescription>Create a secure link anyone can use.</DialogDescription>
        </DialogHeader>

        {url ? (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
              <Button
                size="icon"
                onClick={() => {
                  void navigator.clipboard.writeText(url);
                  toast.success('Link copied');
                }}
                aria-label="Copy link"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {password ? 'Recipients must enter the password to access it.' : 'Anyone with this link can access it.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Password (optional, min 4 chars)</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Protect with a password"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Expires in (hours)</Label>
                <Input
                  type="number"
                  min={1}
                  value={expiresInHours}
                  onChange={(e) => setExpiresInHours(e.target.value)}
                  placeholder="Never"
                />
              </div>
              <div className="space-y-2">
                <Label>Max downloads</Label>
                <Input
                  type="number"
                  min={1}
                  value={maxDownloads}
                  onChange={(e) => setMaxDownloads(e.target.value)}
                  placeholder="Unlimited"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={oneTime} onChange={(e) => setOneTime(e.target.checked)} />
              One-time link (single download)
            </label>
            <Button onClick={createLink} disabled={busy} className="w-full">
              <Link2 className="h-4 w-4" />
              {busy ? 'Creating…' : 'Create link'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
