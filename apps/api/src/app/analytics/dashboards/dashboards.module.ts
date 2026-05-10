import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog, DashboardDefinition } from '@hubblewave/instance-db';
import { DashboardsService } from './dashboards.service';
import { DashboardsController } from './dashboards.controller';

@Module({
  imports: [TypeOrmModule.forFeature([DashboardDefinition, AuditLog])],
  providers: [DashboardsService],
  controllers: [DashboardsController],
})
export class DashboardsModule {}
