import type { PublicFile, UploadInitResponse } from '@dropvault/shared';
import { api } from '@/lib/api-client';

/** PUT one part directly to S3/MinIO via the presigned URL, reporting byte progress. */
function putPart(url: string, blob: Blob, onProgress: (loaded: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded);
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Part upload failed (${xhr.status})`));
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(blob);
  });
}

/**
 * Resumable multipart upload: init session → PUT each chunk straight to S3 → complete.
 * Bytes never pass through our API.
 */
export async function uploadFile(
  file: File,
  folderId: string | null,
  onProgress: (pct: number) => void,
): Promise<PublicFile> {
  const init = await api.post<UploadInitResponse>('/uploads', {
    fileName: file.name,
    size: file.size,
    mimeType: file.type || 'application/octet-stream',
    folderId: folderId ?? undefined,
  });

  const { sessionId, chunkSize, parts } = init;
  const loaded = new Array<number>(parts.length).fill(0);

  for (const [i, part] of parts.entries()) {
    const blob = file.slice((part.partNumber - 1) * chunkSize, part.partNumber * chunkSize);
    // Parts go one at a time so progress is monotonic and memory stays bounded.
    await putPart(part.url, blob, (bytes) => {
      loaded[i] = bytes;
      const total = loaded.reduce((a, b) => a + b, 0);
      onProgress(Math.min(99, Math.round((total / file.size) * 100)));
    });
  }

  const res = await api.post<{ file: PublicFile }>(`/uploads/${sessionId}/complete`);
  onProgress(100);
  return res.file;
}
