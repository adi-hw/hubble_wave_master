import { Module } from '@nestjs/common';
import { TenantDbModule } from '@eam-platform/tenant-db';
import { AuthGuardModule } from '@eam-platform/auth-guard';
import { IamController } from './iam.controller';

@Module({
  imports: [TenantDbModule, AuthGuardModule],
  controllers: [IamController],
})
export class IamModule {}
