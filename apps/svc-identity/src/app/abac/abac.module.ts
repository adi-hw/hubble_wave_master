import { Module } from '@nestjs/common';
import { TenantDbModule } from '@eam-platform/tenant-db';
import { AbacService } from './abac.service';
import { AbacGuard } from './abac.guard';

@Module({
  imports: [TenantDbModule],
  providers: [AbacService, AbacGuard],
  exports: [AbacService, AbacGuard],
})
export class AbacModule {}
