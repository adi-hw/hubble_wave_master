import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Customer, TenantInstance } from '@hubblewave/control-plane-db';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import { InstancesModule } from '../instances/instances.module';

@Module({
  imports: [TypeOrmModule.forFeature([Customer, TenantInstance]), InstancesModule],
  controllers: [MetricsController],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class MetricsModule {}
