import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Instance } from '@hubblewave/control-plane-db';
import { HealthAggregatorService } from './health-aggregator.service';
import { HealthAggregatorController } from './health-aggregator.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Instance]),
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 3,
    }),
    AuditModule,
  ],
  controllers: [HealthAggregatorController],
  providers: [HealthAggregatorService],
  exports: [HealthAggregatorService],
})
export class HealthAggregatorModule {}
