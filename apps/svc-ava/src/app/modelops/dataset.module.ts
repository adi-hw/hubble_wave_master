import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  AuditLog,
  CollectionDefinition,
  DatasetDefinition,
  DatasetSnapshot,
  InstanceEventOutbox,
  AnalyticsEvent,
} from '@hubblewave/instance-db';
import { DatasetController } from './dataset.controller';
import { DatasetService } from './dataset.service';
import { DatasetSnapshotProcessorService } from './dataset-snapshot-processor.service';
import { StorageModule } from '@hubblewave/storage';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DatasetDefinition,
      DatasetSnapshot,
      InstanceEventOutbox,
      CollectionDefinition,
      AuditLog,
      AnalyticsEvent,
    ]),
    StorageModule,
  ],
  controllers: [DatasetController],
  providers: [DatasetService, DatasetSnapshotProcessorService],
})
export class DatasetModule {}
