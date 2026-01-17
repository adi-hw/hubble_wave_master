import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  AuditLog,
  CollectionDefinition,
  InstanceEventOutbox,
  SearchDictionary,
  SearchExperience,
  SearchIndexState,
  SearchSource,
} from '@hubblewave/instance-db';
import { SearchIndexingService } from './search-indexing.service';
import { SearchOutboxProcessorService } from './search-outbox-processor.service';
import { SearchQueryService } from './search-query.service';
import { SearchTypesenseService } from './search-typesense.service';
import { SearchController } from './search.controller';
import { SearchReindexService } from './search-reindex.service';
import { SearchEmbeddingService } from './search-embedding.service';
import { SearchExperienceService } from './search-experience.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SearchExperience,
      SearchSource,
      SearchDictionary,
      SearchIndexState,
      CollectionDefinition,
      InstanceEventOutbox,
      AuditLog,
    ]),
  ],
  providers: [
    SearchTypesenseService,
    SearchIndexingService,
    SearchOutboxProcessorService,
    SearchQueryService,
    SearchReindexService,
    SearchEmbeddingService,
    SearchExperienceService,
  ],
  controllers: [SearchController],
})
export class SearchModule {}
