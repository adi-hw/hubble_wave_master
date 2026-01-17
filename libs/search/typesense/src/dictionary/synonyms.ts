import { Client } from 'typesense';

export interface SynonymDefinition {
  id: string;
  synonyms: string[];
  root?: string;
}

export const defaultSynonymSets: SynonymDefinition[] = [];

export async function ensureSynonyms(
  client: Client,
  collectionName: string,
  synonymSets: SynonymDefinition[] = defaultSynonymSets
): Promise<void> {
  if (synonymSets.length === 0) {
    return;
  }

  const synonyms = client.collections(collectionName).synonyms();
  for (const synonym of synonymSets) {
    await synonyms.upsert(synonym.id, {
      synonyms: synonym.synonyms,
      root: synonym.root,
    });
  }
}
