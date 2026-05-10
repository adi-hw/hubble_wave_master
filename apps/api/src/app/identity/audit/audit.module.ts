import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthEvent, AuditLog } from '@hubblewave/instance-db';
import { AuditLogsController } from './audit-logs.controller';
import { AuditEventsController } from './audit-events.controller';
import { RolesModule } from '../roles/roles.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AuthEvent, AuditLog]),
    RolesModule,
  ],
  controllers: [AuditLogsController, AuditEventsController],
})
export class AuditModule {}
