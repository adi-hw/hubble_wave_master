import { Module } from '@nestjs/common';
// FlowsExecutorModule remains disabled (flow entities removed with tenant-db)
// import { FlowsExecutorModule } from './flows/flows-executor.module';
import { AuthGuardModule } from '@hubblewave/auth-guard';
import { AuthorizationModule } from '@hubblewave/authorization';
import { InstanceDbModule } from '@hubblewave/instance-db';
import { DataController } from './data.controller';
import { DataService } from './data.service';
import { HealthController } from './health.controller';
import { ModelRegistryService } from './model-registry.service';
import { CollectionDataController } from './collection-data.controller';
import { CollectionDataService } from './collection-data.service';

import { AutomationModule } from './automation/automation.module';

import { ValidationModule } from './validation/validation.module';
import { DefaultsModule } from './defaults/defaults.module';
import { GridModule } from './grid/grid.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    InstanceDbModule,
    AuthGuardModule,
    AuthorizationModule,
    // FlowsExecutorModule, // Disabled - flow engine not included in instance-db yet
    AutomationModule,
    ValidationModule,
    DefaultsModule,
    GridModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [DataController, HealthController, CollectionDataController],
  providers: [DataService, ModelRegistryService, CollectionDataService],
})
export class AppModule {}

