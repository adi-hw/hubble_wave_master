import { Module } from '@nestjs/common';
import { TenantDbModule } from '@eam-platform/tenant-db';
import { RbacService } from './rbac.service';
import { RbacController } from './rbac.controller';

@Module({
  imports: [TenantDbModule],
  providers: [RbacService],
  controllers: [RbacController],
  exports: [RbacService],
})
export class RbacModule {}
