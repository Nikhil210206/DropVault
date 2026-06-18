import {
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  ListPartsCommand,
  HeadObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  CopyObjectCommand,
  type CompletedPart,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3, S3_BUCKET } from '../config/s3';

export interface S3Part {
  partNumber: number;
  etag: string;
  size: number;
}

interface PresignGetOptions {
  expiresIn?: number;
  fileName?: string;
  inline?: boolean;
  contentType?: string;
}

/** Thin wrapper over the S3 operations the upload/file modules need. */
export const storage = {
  async createMultipartUpload(key: string, contentType: string): Promise<string> {
    const out = await s3.send(
      new CreateMultipartUploadCommand({ Bucket: S3_BUCKET, Key: key, ContentType: contentType }),
    );
    if (!out.UploadId) throw new Error('S3 did not return an UploadId');
    return out.UploadId;
  },

  presignUploadPart(key: string, uploadId: string, partNumber: number, expiresIn = 3600): Promise<string> {
    return getSignedUrl(
      s3,
      new UploadPartCommand({ Bucket: S3_BUCKET, Key: key, UploadId: uploadId, PartNumber: partNumber }),
      { expiresIn },
    );
  },

  /** S3 is the source of truth for which parts were uploaded (drives resume + complete). */
  async listParts(key: string, uploadId: string): Promise<S3Part[]> {
    const parts: S3Part[] = [];
    let marker: string | undefined;
    do {
      const out = await s3.send(
        new ListPartsCommand({
          Bucket: S3_BUCKET,
          Key: key,
          UploadId: uploadId,
          PartNumberMarker: marker,
        }),
      );
      for (const p of out.Parts ?? []) {
        if (p.PartNumber && p.ETag) {
          parts.push({ partNumber: p.PartNumber, etag: p.ETag, size: p.Size ?? 0 });
        }
      }
      marker = out.IsTruncated ? out.NextPartNumberMarker : undefined;
    } while (marker);
    return parts;
  },

  completeMultipartUpload(key: string, uploadId: string, parts: CompletedPart[]) {
    return s3.send(
      new CompleteMultipartUploadCommand({
        Bucket: S3_BUCKET,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: { Parts: parts },
      }),
    );
  },

  abortMultipartUpload(key: string, uploadId: string) {
    return s3.send(new AbortMultipartUploadCommand({ Bucket: S3_BUCKET, Key: key, UploadId: uploadId }));
  },

  async headObject(key: string): Promise<{ size: number; contentType?: string }> {
    const out = await s3.send(new HeadObjectCommand({ Bucket: S3_BUCKET, Key: key }));
    return { size: Number(out.ContentLength ?? 0), contentType: out.ContentType };
  },

  presignGetObject(key: string, opts: PresignGetOptions = {}): Promise<string> {
    const name = opts.fileName?.replace(/"/g, '');
    const disposition = `${opts.inline ? 'inline' : 'attachment'}${name ? `; filename="${name}"` : ''}`;
    return getSignedUrl(
      s3,
      new GetObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
        ResponseContentDisposition: disposition,
        ResponseContentType: opts.contentType,
      }),
      { expiresIn: opts.expiresIn ?? 300 },
    );
  },

  deleteObject(key: string) {
    return s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }));
  },

  copyObject(srcKey: string, destKey: string) {
    return s3.send(
      new CopyObjectCommand({ Bucket: S3_BUCKET, Key: destKey, CopySource: `${S3_BUCKET}/${srcKey}` }),
    );
  },
};
