import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from '@hubblewave/instance-db';
import { StorageModule } from '@hubblewave/storage';
import { BackupController } from './backup.controller';
import { BackupService } from './backup.service';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLog]), StorageModule],
  controllers: [BackupController],
  providers: [BackupService],
})
export class BackupModule {}
