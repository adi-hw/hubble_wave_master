import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RuntimeAnomaly } from '../entities/runtime-anomaly.entity';
import { RuntimeAnomalyService } from './runtime-anomaly.service';

/**
 * Provides the RuntimeAnomalyService and registers the RuntimeAnomaly
 * entity for repository injection. Apps that want to record anomalies
 * should import this module and inject RuntimeAnomalyService.
 */
@Module({
  imports: [TypeOrmModule.forFeature([RuntimeAnomaly])],
  providers: [RuntimeAnomalyService],
  exports: [RuntimeAnomalyService],
})
export class RuntimeAnomalyModule {}
