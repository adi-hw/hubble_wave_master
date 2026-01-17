import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const DEFAULT_EXPIRES_IN = 900;

export async function signGetObjectUrl(
  client: S3Client,
  bucket: string,
  key: string,
  expiresInSeconds: number = DEFAULT_EXPIRES_IN
): Promise<string> {
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

export async function signPutObjectUrl(
  client: S3Client,
  bucket: string,
  key: string,
  contentType?: string,
  expiresInSeconds: number = DEFAULT_EXPIRES_IN
): Promise<string> {
  const command = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType });
  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}
