'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Download, FileIcon, Folder, HardDrive, Loader2, Lock } from 'lucide-react';
import { toast } from 'sonner';
import type { ShareResolution, ShareTargetDetails, ShareVerifyResponse } from '@dropvault/shared';
import { apiFetch, ApiError } from '@/lib/api-client';
import { BrandBackdrop } from '@/components/brand-backdrop';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatBytes } from '@/lib/utils';

function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <BrandBackdrop />
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <HardDrive className="h-4 w-4" />
        </div>
        <span className="text-[15px] font-semibold tracking-tight">DropVault</span>
      </div>
      {children}
    </main>
  );
}

const card = 'w-full shadow-lg animate-fade-up';

export function PublicShare({ token }: { token: string }) {
  const [loading, setLoading] = useState(true);
  const [resolution, setResolution] = useState<ShareResolution | null>(null);
  const [details, setDetails] = useState<ShareTargetDetails | null>(null);
  const [grant, setGrant] = useState<string | undefined>();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const r = await apiFetch<ShareResolution>(`/shares/${token}`, { auth: false });
        setResolution(r);
        if (!r.needsPassword) setDetails(r);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Share not found');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  async function verify() {
    try {
      const r = await apiFetch<ShareVerifyResponse>(`/shares/${token}/verify`, {
        method: 'POST',
        body: { password },
        auth: false,
      });
      setDetails(r);
      setGrant(r.grant);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Incorrect password');
    }
  }

  async function download(fileId?: string) {
    try {
      const q = new URLSearchParams();
      if (grant) q.set('grant', grant);
      if (fileId) q.set('fileId', fileId);
      const qs = q.toString();
      const { url } = await apiFetch<{ url: string }>(`/shares/${token}/download${qs ? `?${qs}` : ''}`, {
        auth: false,
      });
      window.location.href = url;
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Download unavailable');
    }
  }

  if (loading) {
    return (
      <Shell>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </Shell>
    );
  }

  if (error) {
    return (
      <Shell>
        <Card className={`${card} max-w-md`}>
          <CardHeader>
            <CardTitle>Link unavailable</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </Shell>
    );
  }

  if (resolution?.needsPassword && !details) {
    return (
      <Shell>
        <Card className={`${card} max-w-sm`}>
          <CardHeader className="items-center text-center">
            <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-xl bg-muted">
              <Lock className="h-5 w-5 text-muted-foreground" />
            </div>
            <CardTitle>Password required</CardTitle>
            <CardDescription>This link is protected.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              onKeyDown={(e) => e.key === 'Enter' && verify()}
            />
            <Button className="w-full" onClick={verify}>
              Unlock
            </Button>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  if (resolution?.type === 'file' && details?.file) {
    return (
      <Shell>
        <Card className={`${card} max-w-md`}>
          <CardContent className="flex flex-col items-center gap-5 pt-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500/10">
              <FileIcon className="h-8 w-8 text-blue-500" strokeWidth={1.5} />
            </div>
            <div className="space-y-0.5">
              <p className="break-all font-semibold">{details.file.name}</p>
              <p className="text-sm text-muted-foreground">
                {formatBytes(details.file.size)} · {details.file.mimeType}
              </p>
            </div>
            {resolution.allowDownload ? (
              <Button size="lg" className="w-full" onClick={() => download()}>
                <Download className="h-4 w-4" /> Download
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">Downloads are disabled for this link.</p>
            )}
          </CardContent>
        </Card>
      </Shell>
    );
  }

  if (resolution?.type === 'folder' && details?.folder) {
    return (
      <Shell>
        <Card className={`${card} max-w-lg`}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
                <Folder className="h-4 w-4 text-amber-500" strokeWidth={1.75} />
              </span>
              {details.folder.name}
            </CardTitle>
            <CardDescription>{details.files?.length ?? 0} files</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            {(details.files ?? []).map((f) => (
              <div
                key={f.id}
                className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/60"
              >
                <FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate text-sm">{f.name}</span>
                <span className="text-xs tabular-nums text-muted-foreground">{formatBytes(f.size)}</span>
                {resolution.allowDownload && (
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => download(f.id)} aria-label="Download">
                    <Download className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </Shell>
    );
  }

  return (
    <Shell>
      <p className="text-sm text-muted-foreground">Nothing to show.</p>
    </Shell>
  );
}
