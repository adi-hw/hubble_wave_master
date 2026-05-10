import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AVA_DOCUMENTS_COLLECTION,
  createTypesenseClient,
  ensureCollections,
  ensureSynonyms,
  SynonymDefinition,
  TypesenseIndexer,
  loadTypesenseConfig,
} from '@hubblewave/search-typesense';
import { SearchDictionary } from '@hubblewave/instance-db';

@Injectable()
export class SearchTypesenseService implements OnModuleInit {
  private client!: ReturnType<typeof createTypesenseClient>;
  private indexer!: TypesenseIndexer;

  constructor(
    @InjectRepository(SearchDictionary)
    private readonly dictionaryRepo: Repository<SearchDictionary>,
  ) {}

  async onModuleInit(): Promise<void> {
    const config = loadTypesenseConfig(process.env);
    this.client = createTypesenseClient(config);
    await ensureCollections(this.client);
    await this.refreshSynonyms();
    this.indexer = new TypesenseIndexer(this.client, AVA_DOCUMENTS_COLLECTION);
  }

  getIndexer(): TypesenseIndexer {
    return this.indexer;
  }

  async searchDocuments(params: Record<string, unknown>) {
    return this.client.collections(AVA_DOCUMENTS_COLLECTION).documents().search(params);
  }

  async refreshSynonyms(): Promise<void> {
    const dictionaries = await this.dictionaryRepo.find({ where: { isActive: true } });
    if (!dictionaries.length) {
      return;
    }

    const synonyms: SynonymDefinition[] = [];
    for (const dictionary of dictionaries) {
      const locale = dictionary.locale || 'en';
      for (const entry of dictionary.entries || []) {
        const term = typeof entry.term === 'string' ? entry.term.trim() : '';
        const values = Array.isArray(entry.synonyms)
          ? entry.synonyms.map((value) => String(value).trim()).filter(Boolean)
          : [];
        if (!term || values.length === 0) {
          continue;
        }
        synonyms.push({
          id: `${dictionary.code}:${locale}:${term}`,
          root: term,
          synonyms: values,
        });
      }
    }

    await ensureSynonyms(this.client, AVA_DOCUMENTS_COLLECTION, synonyms);
  }
}
