import { StorageClient } from '../storage.client';
import { StorageBuckets } from '../storage.config';

export async function ensureBuckets(
  client: StorageClient,
  buckets: StorageBuckets
): Promise<void> {
  await client.ensureBucket(buckets.attachments);
  await client.ensureBucket(buckets.packArtifacts);
  await client.ensureBucket(buckets.modelVault);
  await client.ensureBucket(buckets.backups);
}
