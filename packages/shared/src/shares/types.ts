/** Owner-facing view of a share link. */
export interface PublicShare {
  id: string;
  token: string;
  url: string;
  type: 'file' | 'folder';
  targetId: string;
  targetName: string;
  hasPassword: boolean;
  expiresAt: string | null;
  maxDownloads: number | null;
  downloadCount: number;
  oneTime: boolean;
  allowDownload: boolean;
  revoked: boolean;
  createdAt: string;
}

/** Target details exposed publicly once a share is accessible (post-password). */
export interface ShareTargetDetails {
  file?: { name: string; mimeType: string; size: string };
  folder?: { name: string };
  files?: { id: string; name: string; mimeType: string; size: string }[];
}

/** Public resolution of a share link (recipient view). */
export interface ShareResolution extends ShareTargetDetails {
  type: 'file' | 'folder';
  needsPassword: boolean;
  allowDownload: boolean;
  expiresAt: string | null;
  oneTime: boolean;
}

/** Returned after a correct password; `grant` authorizes downloads for a short window. */
export interface ShareVerifyResponse extends ShareTargetDetails {
  grant: string;
}
