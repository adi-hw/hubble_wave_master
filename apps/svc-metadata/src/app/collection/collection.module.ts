import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  CollectionDefinition,
  CollectionDefinitionRevision,
  PropertyDefinition,
  PropertyDefinitionRevision,
  PropertyType,
  CollectionAccessRule,
  InstanceDbModule,
} from '@hubblewave/instance-db';
import { CollectionController } from './collection.controller';
import { CollectionService } from './collection.service';
import { CollectionStorageService } from './collection-storage.service';
import { CollectionAvaService } from './collection-ava.service';
import { AccessModule } from '../access/access.module';
import { PublishImpactModule } from '../publish-impact/publish-impact.module';

/**
 * NOTE: At time of writing, this module is NOT imported by AppModule —
 * AppModule registers CollectionController and CollectionService
 * directly in its `controllers` and `providers` arrays, with the
 * cross-module dependencies (PublishImpactModule, AccessModule, etc.)
 * imported at the AppModule level. Runtime DI works correctly through
 * that path.
 *
 * The module is kept here as the canonical declaration of the
 * collection feature's dependency graph so that:
 *   1. Future migration to module-per-feature registration is trivial
 *      — drop the direct registrations from AppModule and add this
 *      module to AppModule.imports.
 *   2. Tests that want an isolated test harness can import this module
 *      without standing up the full AppModule.
 *
 * Imports must include every module CollectionService and
 * CollectionController inject from. As of Phase 1 §6.6 that means
 * AccessModule (AccessAuditService) and PublishImpactModule
 * (PublishImpactService, DependentReviewQueueService).
 */
@Module({
  imports: [
    InstanceDbModule,
    AccessModule,
    PublishImpactModule,
    TypeOrmModule.forFeature([
      CollectionDefinition,
      CollectionDefinitionRevision,
      PropertyDefinition,
      PropertyDefinitionRevision,
      PropertyType,
      CollectionAccessRule,
    ]),
  ],
  controllers: [CollectionController],
  providers: [CollectionService, CollectionStorageService, CollectionAvaService],
  exports: [CollectionService, CollectionStorageService],
})
export class CollectionModule {}
