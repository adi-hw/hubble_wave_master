import { Module } from '@nestjs/common';
import { InstanceDbModule } from '@hubblewave/instance-db';
import { AbacService } from './abac.service';
import { AbacGuard } from './abac.guard';

@Module({
  imports: [InstanceDbModule],
  providers: [AbacService, AbacGuard],
  exports: [AbacService, AbacGuard],
})
export class AbacModule {}

