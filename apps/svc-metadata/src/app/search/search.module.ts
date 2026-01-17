import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  AuditLog,
  SearchDictionary,
  SearchExperience,
  SearchIndexState,
  SearchSource,
} from '@hubblewave/instance-db';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SearchExperience,
      SearchSource,
      SearchDictionary,
      SearchIndexState,
      AuditLog,
    ]),
  ],
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
