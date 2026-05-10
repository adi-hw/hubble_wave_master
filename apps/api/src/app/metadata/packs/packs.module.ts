import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  PackInstallLock,
  PackObjectRevision,
  PackObjectState,
  PackReleaseRecord,
  AuditLog,
} from '@hubblewave/instance-db';
import { AuthGuardModule, JwtAuthGuard } from '@hubblewave/auth-guard';
import { PacksController } from './packs.controller';
import { PacksService } from './packs.service';
import { PackInstallGuard } from './pack-install.guard';
import { MetadataIngestService } from '../metadata/metadata-ingest.service';
import { PackCatalogService } from './pack-catalog.service';
import { AccessIngestService } from '../access/services/access-ingest.service';
import { SearchIngestService } from '../search/search-ingest.service';
import { AvaIngestService } from '../ava/ava-ingest.service';
import { InsightsIngestService } from '../insights/insights-ingest.service';
import { ConnectorsIngestService } from '../connectors/connectors-ingest.service';
import { LocalizationIngestService } from '../localization/localization-ingest.service';

@Module({
  imports: [
    AuthGuardModule,
    TypeOrmModule.forFeature([
      PackReleaseRecord,
      PackObjectRevision,
      PackObjectState,
      PackInstallLock,
      AuditLog,
    ]),
  ],
  controllers: [PacksController],
  providers: [
    PacksService,
    PackCatalogService,
    PackInstallGuard,
    JwtAuthGuard,
    MetadataIngestService,
    AccessIngestService,
    SearchIngestService,
    AvaIngestService,
    InsightsIngestService,
    ConnectorsIngestService,
    LocalizationIngestService,
  ],
})
export class PacksModule {}
