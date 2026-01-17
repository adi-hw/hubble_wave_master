import 'dotenv/config';
import {
  loadStorageConfig,
  ensureBuckets,
  createMinioClient,
  S3StorageClient,
} from '../libs/storage/src';

async function main(): Promise<void> {
  const config = loadStorageConfig();
  const client =
    config.provider === 'minio'
      ? createMinioClient(config)
      : new S3StorageClient(config);

  await ensureBuckets(client, config.buckets);
  console.log(`Buckets ready: ${Object.values(config.buckets).join(', ')}`);
}

main().catch((error) => {
  console.error('Bucket bootstrap failed:', error);
  process.exit(1);
});
