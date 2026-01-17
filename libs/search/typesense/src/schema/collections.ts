import { CollectionCreateSchema } from 'typesense/lib/Typesense/Collections';

export const AVA_DOCUMENTS_COLLECTION = 'ava_documents';

export const avaDocumentsSchema: CollectionCreateSchema = {
  name: AVA_DOCUMENTS_COLLECTION,
  fields: [
    { name: 'id', type: 'string' },
    { name: 'source_type', type: 'string', facet: true },
    { name: 'source_id', type: 'string', facet: true },
    { name: 'title', type: 'string', optional: true },
    { name: 'content', type: 'string' },
    { name: 'tags', type: 'string[]', optional: true, facet: true },
    { name: 'created_at', type: 'int64' },
    { name: 'updated_at', type: 'int64' },
  ],
  default_sorting_field: 'updated_at',
};

export const defaultCollections: CollectionCreateSchema[] = [avaDocumentsSchema];
