import { Module } from '@nestjs/common';
import { InstanceDbModule } from '@hubblewave/instance-db';
import { AuthGuardModule } from '@hubblewave/auth-guard';
import { IamController } from './iam.controller';
import { RolesModule } from '../roles/roles.module';

@Module({
  imports: [InstanceDbModule, AuthGuardModule, RolesModule],
  controllers: [IamController],
})
export class IamModule {}

