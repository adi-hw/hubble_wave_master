import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantInstance } from '@hubblewave/control-plane-db';
import { InstancesController } from './instances.controller';
import { InstancesService } from './instances.service';

import { AuditModule } from '../audit/audit.module';
import { TerraformModule } from '../terraform/terraform.module';
import { LicensesModule } from '../licenses/licenses.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TenantInstance]),
    AuditModule,
    forwardRef(() => TerraformModule),
    LicensesModule,
  ],
  controllers: [InstancesController],
  providers: [InstancesService],
  exports: [InstancesService],
})
export class InstancesModule {}
