import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Default presigned-URL TTL for S3 GET/PUT operations. One hour balances UX
 * for large downloads against credential exposure window. Operators can tune
 * via `S3_SIGNED_URL_TTL_SECONDS`; values are clamped to the AWS hard ceiling
 * of 7 days (604800 seconds).
 */
const FALLBACK_TTL_SECONDS = 3600;
const MIN_TTL_SECONDS = 1;
const MAX_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days, S3 hard ceiling

function resolveDefaultTtl(): number {
  const raw = process.env['S3_SIGNED_URL_TTL_SECONDS'];
  if (!raw) {
    return FALLBACK_TTL_SECONDS;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    return FALLBACK_TTL_SECONDS;
  }
  return clampTtl(parsed);
}

function clampTtl(seconds: number): number {
  if (seconds < MIN_TTL_SECONDS) return MIN_TTL_SECONDS;
  if (seconds > MAX_TTL_SECONDS) return MAX_TTL_SECONDS;
  return seconds;
}

export async function signGetObjectUrl(
  client: S3Client,
  bucket: string,
  key: string,
  expiresInSeconds: number = resolveDefaultTtl()
): Promise<string> {
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(client, command, { expiresIn: clampTtl(expiresInSeconds) });
}

export async function signPutObjectUrl(
  client: S3Client,
  bucket: string,
  key: string,
  contentType?: string,
  expiresInSeconds: number = resolveDefaultTtl()
): Promise<string> {
  const command = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType });
  return getSignedUrl(client, command, { expiresIn: clampTtl(expiresInSeconds) });
}
