import { Module } from '@nestjs/common';
import { AuthGuardModule } from '@eam-platform/auth-guard';
import { AuthorizationModule } from '@eam-platform/authorization';
import { PlatformDbModule } from '@eam-platform/platform-db';
import { TenantDbModule } from '@eam-platform/tenant-db';
import { DataController } from './data.controller';
import { DataService } from './data.service';
import { HealthController } from './health.controller';
import { ModelRegistryService } from './model-registry.service';
import { CollectionDataController } from './collection-data.controller';
import { CollectionDataService } from './collection-data.service';

@Module({
  imports: [PlatformDbModule, TenantDbModule, AuthGuardModule, AuthorizationModule],
  controllers: [DataController, HealthController, CollectionDataController],
  providers: [DataService, ModelRegistryService, CollectionDataService],
})
export class AppModule {}
