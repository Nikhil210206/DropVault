'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Download, FileIcon, Folder, Loader2, Lock } from 'lucide-react';
import { toast } from 'sonner';
import type { ShareResolution, ShareTargetDetails, ShareVerifyResponse } from '@dropvault/shared';
import { apiFetch, ApiError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatBytes } from '@/lib/utils';

function Centered({ children }: { children: ReactNode }) {
  return <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">{children}</main>;
}

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

  if (loading)
    return (
      <Centered>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </Centered>
    );

  if (error)
    return (
      <Centered>
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Link unavailable</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </Centered>
    );

  if (resolution?.needsPassword && !details)
    return (
      <Centered>
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" /> Password required
            </CardTitle>
            <CardDescription>This link is password-protected.</CardDescription>
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
      </Centered>
    );

  if (resolution?.type === 'file' && details?.file)
    return (
      <Centered>
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 truncate">
              <FileIcon className="h-5 w-5 text-primary" /> {details.file.name}
            </CardTitle>
            <CardDescription>
              {formatBytes(details.file.size)} · {details.file.mimeType}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {resolution.allowDownload ? (
              <Button className="w-full" onClick={() => download()}>
                <Download className="h-4 w-4" /> Download
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">Downloads are disabled for this link.</p>
            )}
          </CardContent>
        </Card>
      </Centered>
    );

  if (resolution?.type === 'folder' && details?.folder)
    return (
      <Centered>
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Folder className="h-5 w-5 text-primary" /> {details.folder.name}
            </CardTitle>
            <CardDescription>{details.files?.length ?? 0} files</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {(details.files ?? []).map((f) => (
              <div key={f.id} className="flex items-center gap-3 rounded-lg border px-3 py-2">
                <FileIcon className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1 truncate text-sm">{f.name}</span>
                <span className="text-xs text-muted-foreground">{formatBytes(f.size)}</span>
                {resolution.allowDownload && (
                  <Button size="sm" variant="ghost" onClick={() => download(f.id)} aria-label="Download">
                    <Download className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </Centered>
    );

  return (
    <Centered>
      <p className="text-sm text-muted-foreground">Nothing to show.</p>
    </Centered>
  );
}
