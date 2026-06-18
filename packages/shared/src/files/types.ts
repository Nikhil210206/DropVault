export type FileStatus = 'UPLOADING' | 'SCANNING' | 'READY' | 'QUARANTINED' | 'FAILED';

export interface PublicFile {
  id: string;
  name: string;
  originalName: string;
  mimeType: string;
  size: string;
  status: FileStatus;
  folderId: string | null;
  thumbnailKey: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UploadPartUrl {
  partNumber: number;
  url: string;
}

export interface UploadInitResponse {
  sessionId: string;
  chunkSize: number;
  totalParts: number;
  parts: UploadPartUrl[];
  expiresAt: string;
}

export interface UploadStatusResponse {
  status: string;
  totalParts: number;
  chunkSize: number;
  uploadedParts: number[];
  expiresAt: string;
}
