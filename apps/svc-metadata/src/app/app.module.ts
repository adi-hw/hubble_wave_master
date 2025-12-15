import { Module } from '@nestjs/common';
import { AuthGuardModule } from '@eam-platform/auth-guard';
import { AuthorizationModule } from '@eam-platform/authorization';
import { PlatformDbModule } from '@eam-platform/platform-db';
import { TenantDbModule } from '@eam-platform/tenant-db';
import { ModuleController } from './module.controller';
import { ModuleService } from './module.service';
import { FormController } from './form.controller';
import { FormService } from './form.service';
import { ModelRegistryService } from './model-registry.service';
import { ModelController } from './model.controller';
import { MetadataController } from './metadata.controller';
import { StudioTablesController } from './studio-tables.controller';
import { StudioScriptsController } from './studio-scripts.controller';
import { StudioConfigController } from './studio-config.controller';
import { BusinessRulesController } from './business-rules.controller';
import { EventsController } from './events.controller';
import { NotificationsController } from './notifications.controller';
import { ApprovalsController } from './approvals.controller';
import { WorkflowsController } from './workflows.controller';
import { UpgradeController } from './upgrade.controller';
import { ExportController } from './export.controller';
import { CollectionController } from './collection.controller';
import { CollectionService } from './collection.service';
import { PropertyController } from './property.controller';
import { PropertyService } from './property.service';
import { ViewController } from './view.controller';
import { ViewService } from './view.service';
import { CommitmentController } from './commitment.controller';
import { CommitmentService } from './commitment.service';
import { ImportExportController } from './import-export.controller';
import { ImportExportService } from './import-export.service';

// NOTE: Data CRUD operations have been consolidated to svc-data service.
// Use svc-data endpoints for all record create/read/update/delete operations.
// svc-metadata focuses on configuration, workflows, and business rules.
// Table schema is now discovered from information_schema (database-first approach).

@Module({
  imports: [PlatformDbModule, TenantDbModule, AuthGuardModule, AuthorizationModule],
  controllers: [
    ModuleController,
    ModelController,
    FormController,
    MetadataController,
    StudioTablesController,
    StudioScriptsController,
    StudioConfigController,
    BusinessRulesController,
    EventsController,
    NotificationsController,
    ApprovalsController,
    WorkflowsController,
    UpgradeController,
    ExportController,
    CollectionController,
    PropertyController,
    ViewController,
    CommitmentController,
    ImportExportController,
  ],
  providers: [ModuleService, FormService, ModelRegistryService, CollectionService, PropertyService, ViewService, CommitmentService, ImportExportService],
})
export class AppModule {}
