import { Client } from 'typesense';
import { CollectionCreateSchema } from 'typesense/lib/Typesense/Collections';
import { defaultCollections } from '../schema/collections';

export async function ensureCollections(
  client: Client,
  collections: CollectionCreateSchema[] = defaultCollections
): Promise<void> {
  for (const schema of collections) {
    try {
      await client.collections(schema.name).retrieve();
    } catch (error: unknown) {
      const status = (error as { httpStatus?: number }).httpStatus;
      if (status === 404) {
        await client.collections().create(schema);
        continue;
      }
      throw error;
    }
  }
}

export class TypesenseIndexer {
  constructor(
    private readonly client: Client,
    private readonly collectionName: string
  ) {}

  async upsert(document: Record<string, unknown>): Promise<void> {
    await this.client
      .collections(this.collectionName)
      .documents()
      .upsert(document, { dirty_values: 'coerce_or_drop' });
  }

  async delete(id: string): Promise<void> {
    await this.client.collections(this.collectionName).documents(id).delete();
  }
}
