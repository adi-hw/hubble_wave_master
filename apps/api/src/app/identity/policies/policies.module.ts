import { Module } from '@nestjs/common';
import { InstanceDbModule } from '@hubblewave/instance-db';
import { PoliciesController } from './policies.controller';
import { PoliciesService } from './policies.service';

@Module({
  imports: [InstanceDbModule],
  controllers: [PoliciesController],
  providers: [PoliciesService],
  exports: [PoliciesService],
})
export class PoliciesModule {}
