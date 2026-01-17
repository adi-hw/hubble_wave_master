import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TerraformJob } from '@hubblewave/control-plane-db';
import { TerraformController } from './terraform.controller';
import { TerraformService } from './terraform.service';
import { TerraformWorker } from './terraform.worker';
import { TerraformExecutor } from './terraform.executor';
import { TerraformWorkspaceService } from './terraform.workspace.service';
import { InstancesModule } from '../instances/instances.module';

@Module({
  imports: [TypeOrmModule.forFeature([TerraformJob]), forwardRef(() => InstancesModule)],
  controllers: [TerraformController],
  providers: [TerraformService, TerraformWorker, TerraformExecutor, TerraformWorkspaceService],
  exports: [TerraformService, TerraformWorker, TerraformExecutor, TerraformWorkspaceService],
})
export class TerraformModule {}
