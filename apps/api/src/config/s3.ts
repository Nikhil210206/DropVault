import { S3Client } from '@aws-sdk/client-s3';
import { env } from './env';

// forcePathStyle is required for MinIO (and any non-AWS S3) so URLs look like
// http://host/bucket/key instead of the virtual-hosted http://bucket.host/key.
export const s3 = new S3Client({
  region: env.S3_REGION,
  endpoint: env.S3_ENDPOINT,
  forcePathStyle: env.S3_FORCE_PATH_STYLE,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  },
});

export const S3_BUCKET = env.S3_BUCKET;
