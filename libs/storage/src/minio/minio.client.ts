import { StorageConfig } from '../storage.config';
import { S3StorageClient } from '../s3/s3.client';

export function createMinioClient(config: StorageConfig): S3StorageClient {
  return new S3StorageClient({ ...config, forcePathStyle: true });
}
