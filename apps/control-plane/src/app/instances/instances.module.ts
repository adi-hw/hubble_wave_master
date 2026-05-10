import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Customer, Instance } from '@hubblewave/control-plane-db';
import { InstancesController } from './instances.controller';
import { InstancesService } from './instances.service';

import { AuditModule } from '../audit/audit.module';
import { TerraformModule } from '../terraform/terraform.module';
import { LicensesModule } from '../licenses/licenses.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Instance, Customer]),
    AuditModule,
    forwardRef(() => TerraformModule),
    LicensesModule,
  ],
  controllers: [InstancesController],
  providers: [InstancesService],
  exports: [InstancesService],
})
export class InstancesModule {}
