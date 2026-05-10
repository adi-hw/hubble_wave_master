import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlertDefinition, AuditLog, MetricDefinition, MetricPoint } from '@hubblewave/instance-db';
import { AuditIntegrityService } from './audit-integrity.service';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([AuditLog, MetricDefinition, MetricPoint, AlertDefinition]),
  ],
  providers: [AuditIntegrityService],
})
export class AuditIntegrityModule {}
