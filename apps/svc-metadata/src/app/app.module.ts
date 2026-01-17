import { Module } from '@nestjs/common';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AuthGuardModule } from '@hubblewave/auth-guard';
import {
  AuthorizationModule,
  COLLECTION_ACL_REPOSITORY,
  PROPERTY_ACL_REPOSITORY,
} from '@hubblewave/authorization';
import {
  InstanceDbModule,
  CollectionAccessRule,
  PropertyAccessRule,
} from '@hubblewave/instance-db';
import { ModuleController } from './module.controller';
import { ModuleService } from './module.service';
import { ModelRegistryService } from './model-registry.service';
import { ModelController } from './model.controller';
import { MetadataController } from './metadata.controller';
import { HealthController } from './health.controller';

import { PropertyModule } from './property/property.module';
import { AccessModule } from './access/access.module';
import { CollectionController } from './collection/collection.controller';
import { CollectionService } from './collection/collection.service';
import { CollectionStorageService } from './collection/collection-storage.service';
import { CollectionAvaService } from './collection/collection-ava.service';
import { SchemaDiffService } from './schema/schema-diff.service';
import { ThemeModule } from './theme/theme.module';
import { PreferencesModule } from './preferences/preferences.module';
import { ViewModule } from './view/view.module';
import { NavigationMetadataModule } from './navigation/navigation.module';
import { ScriptModule } from './script/script.module';
import { PacksModule } from './packs/packs.module';
import { SchemaController } from './schema/schema.controller';
import { SchemaDeployService } from './schema/schema-deploy.service';
import { SearchModule } from './search/search.module';
import { LocalizationModule } from './localization/localization.module';

@Module({
  imports: [
    InstanceDbModule,
    AuthGuardModule,
    EventEmitterModule.forRoot(),
    TypeOrmModule.forFeature([CollectionAccessRule, PropertyAccessRule]),
    AuthorizationModule.forRoot({
      enableCaching: true,
    }),
    PropertyModule,
    AccessModule,
    ThemeModule,
    PreferencesModule,
    ViewModule,
    NavigationMetadataModule,
    ScriptModule,
    PacksModule,
    SearchModule,
    LocalizationModule,
  ],
  controllers: [
    HealthController,
    ModuleController,
    ModelController,
    MetadataController,
    CollectionController,
    SchemaController,
  ],
  providers: [
    ModuleService,
    ModelRegistryService,
    CollectionService,
    CollectionStorageService,
    CollectionAvaService,
    SchemaDiffService,
    SchemaDeployService,
    {
      provide: COLLECTION_ACL_REPOSITORY,
      useFactory: (repo: Repository<CollectionAccessRule>) => repo,
      inject: [getRepositoryToken(CollectionAccessRule)],
    },
    {
      provide: PROPERTY_ACL_REPOSITORY,
      useFactory: (repo: Repository<PropertyAccessRule>) => repo,
      inject: [getRepositoryToken(PropertyAccessRule)],
    },
  ],
})
export class AppModule {}

