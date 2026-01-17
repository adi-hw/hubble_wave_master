import { z } from 'zod';

const providerSchema = z.enum(['s3', 'minio']);

const bucketsSchema = z.object({
  attachments: z.string().min(1),
  packArtifacts: z.string().min(1),
  modelVault: z.string().min(1),
  backups: z.string().min(1),
});

export type StorageBuckets = z.infer<typeof bucketsSchema>;

export interface StorageConfig {
  provider: z.infer<typeof providerSchema>;
  region: string;
  endpoint?: string;
  forcePathStyle: boolean;
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
  buckets: StorageBuckets;
}

function resolveBucket(
  env: Record<string, string | undefined>,
  primary: string,
  fallback: string,
  shared?: string
): string {
  return env[primary] || env[fallback] || shared || '';
}

function buildMinioEndpoint(env: Record<string, string | undefined>): string {
  const raw = env.MINIO_ENDPOINT || 'localhost';
  const hasScheme = raw.startsWith('http://') || raw.startsWith('https://');
  if (hasScheme) {
    return raw;
  }
  const useSsl = env.MINIO_USE_SSL === 'true';
  const port = env.MINIO_PORT || (useSsl ? '443' : '9000');
  return `${useSsl ? 'https' : 'http'}://${raw}:${port}`;
}

export function loadStorageConfig(
  env: Record<string, string | undefined> = process.env
): StorageConfig {
  const providerInput = env.STORAGE_PROVIDER || (env.MINIO_ENDPOINT ? 'minio' : 's3');
  const provider = providerSchema.parse(providerInput);
  const isProd = env.NODE_ENV === 'production';

  const region = env.S3_REGION || env.AWS_REGION || 'us-east-1';
  if (provider === 's3' && isProd && !env.S3_REGION && !env.AWS_REGION) {
    throw new Error('S3_REGION or AWS_REGION must be set in production');
  }

  const sharedBucket = env.STORAGE_BUCKET || env.S3_BUCKET || env.MINIO_BUCKET;
  const buckets = bucketsSchema.parse({
    attachments: resolveBucket(
      env,
      'MINIO_BUCKET_ATTACHMENTS',
      'S3_BUCKET_ATTACHMENTS',
      sharedBucket
    ) || 'hw-instance-attachments',
    packArtifacts: resolveBucket(
      env,
      'MINIO_BUCKET_PACK_ARTIFACTS',
      'S3_BUCKET_PACK_ARTIFACTS',
      sharedBucket
    ) || 'hw-pack-artifacts',
    modelVault: resolveBucket(
      env,
      'MINIO_BUCKET_MODEL_VAULT',
      'S3_BUCKET_MODEL_VAULT',
      sharedBucket
    ) || 'hw-model-vault',
    backups: resolveBucket(
      env,
      'MINIO_BUCKET_BACKUPS',
      'S3_BUCKET_BACKUPS',
      sharedBucket
    ) || 'hw-instance-backups',
  });

  const endpoint = provider === 'minio'
    ? buildMinioEndpoint(env)
    : env.S3_ENDPOINT || env.AWS_ENDPOINT_URL;

  const forcePathStyle = provider === 'minio' || env.S3_FORCE_PATH_STYLE === 'true';

  const accessKeyId = provider === 'minio'
    ? env.MINIO_ROOT_USER
    : env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = provider === 'minio'
    ? env.MINIO_ROOT_PASSWORD
    : env.AWS_SECRET_ACCESS_KEY;
  const sessionToken = env.AWS_SESSION_TOKEN;

  if (provider === 'minio' && (!accessKeyId || !secretAccessKey)) {
    throw new Error('MINIO_ROOT_USER and MINIO_ROOT_PASSWORD are required for MinIO');
  }

  return {
    provider,
    region,
    endpoint,
    forcePathStyle,
    accessKeyId,
    secretAccessKey,
    sessionToken,
    buckets,
  };
}
