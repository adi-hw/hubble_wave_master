import { Module } from '@nestjs/common';
import { AuthGuardModule } from '@hubblewave/auth-guard';
import { AuthorizationModule } from '@hubblewave/authorization';
import { InstanceDbModule } from '@hubblewave/instance-db';
import { ModuleController } from './module.controller';
import { ModuleService } from './module.service';
import { FormController } from './form.controller';
import { FormService } from './form.service';
import { ModelRegistryService } from './model-registry.service';
import { ModelController } from './model.controller';
import { MetadataController } from './metadata.controller';

import { PropertyModule } from './property/property.module';
import { AccessModule } from './access/access.module';
// import { FlowsModule } from './flows/flows.module'; // TODO: Fix type errors
import { CollectionController } from './collection/collection.controller';
import { CollectionService } from './collection/collection.service';
import { CollectionStorageService } from './collection/collection-storage.service';
import { CollectionAvaService } from './collection/collection-ava.service';

// import { CommitmentController } from './commitment.controller';
// import { CommitmentService } from './commitment.service';

// import { CommitmentModule } from './commitment/commitment.module'; // TODO: Fix type errors
import { ThemeModule } from './theme/theme.module';
import { PreferencesModule } from './preferences/preferences.module';

// NOTE: Data CRUD operations have been consolidated to svc-data service.
// Use svc-data endpoints for all record create/read/update/delete operations.
// svc-metadata focuses on configuration, workflows, and business rules.
// Table schema is now discovered from information_schema (database-first approach).

@Module({
  imports: [
    InstanceDbModule,

    AuthGuardModule,
    AuthorizationModule,
    PropertyModule,
    AccessModule,
    ThemeModule,
    PreferencesModule,
    // FlowsModule,
    // CommitmentModule,
  ],
  controllers: [
    ModuleController,
    ModelController,
    FormController,
    MetadataController,

    CollectionController,
    // CommitmentController,

  ],
  providers: [
    ModuleService,
    FormService,
    ModelRegistryService,
    CollectionService,
    CollectionStorageService,
    CollectionAvaService,
    // CommitmentService,

  ],
})
export class AppModule {}

