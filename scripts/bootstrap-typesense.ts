import 'dotenv/config';
import {
  loadTypesenseConfig,
  createTypesenseClient,
  checkTypesenseHealth,
  ensureCollections,
  ensureSynonyms,
  AVA_DOCUMENTS_COLLECTION,
} from '../libs/search/typesense/src';

async function main(): Promise<void> {
  const config = loadTypesenseConfig();
  const client = createTypesenseClient(config);

  const health = await checkTypesenseHealth(client);
  if (!health.ok) {
    throw new Error('Typesense health check failed');
  }

  await ensureCollections(client);
  await ensureSynonyms(client, AVA_DOCUMENTS_COLLECTION);
  console.log('Typesense collections are ready');
}

main().catch((error) => {
  console.error('Typesense bootstrap failed:', error);
  process.exit(1);
});
