import { Module } from '@nestjs/common';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import {
  AuthGuardModule,
  GlobalGuardsModule,
  MaintenanceModeModule,
} from '@hubblewave/auth-guard';
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
import { RedisModule } from '@hubblewave/redis';
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
import { ThemeModule } from '../../../api/src/app/metadata/theme/theme.module';
import { PreferencesModule } from './preferences/preferences.module';
import { ViewModule } from '../../../api/src/app/metadata/view/view.module';
import { NavigationMetadataModule } from '../../../api/src/app/metadata/navigation/navigation.module';
import { ScriptModule } from '../../../api/src/app/metadata/script/script.module';
import { PacksModule } from './packs/packs.module';
import { SchemaController } from './schema/schema.controller';
import { SchemaDeployService } from './schema/schema-deploy.service';
import { SearchModule } from './search/search.module';
import { LocalizationModule } from './localization/localization.module';
import { ApplicationModule } from '../../../api/src/app/metadata/application/application.module';
import { PublishImpactModule } from './publish-impact/publish-impact.module';
import { DisplayRuleModule } from '../../../api/src/app/metadata/display-rules/display-rule.module';
import { DecisionTableModule } from '../../../api/src/app/metadata/decision-tables/decision-table.module';
import { GuidedProcessModule } from '../../../api/src/app/metadata/guided-processes/guided-process.module';
import { WorkspaceModule } from './workspaces/workspace.module';
import { ChangePackageModule } from './change-packages/change-package.module';

@Module({
  imports: [
    InstanceDbModule,
    AuthGuardModule,
    GlobalGuardsModule,
    RedisModule.forRoot(),
    MaintenanceModeModule,
    EventEmitterModule.forRoot(),
    TypeOrmModule.forFeature([CollectionAccessRule, PropertyAccessRule]),
    AuthorizationModule.forRoot({
      enableCaching: true,
    }),
    ApplicationModule,
    PropertyModule,
    AccessModule,
    PublishImpactModule,
    DisplayRuleModule,
    DecisionTableModule,
    GuidedProcessModule,
    WorkspaceModule,
    ChangePackageModule,
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

