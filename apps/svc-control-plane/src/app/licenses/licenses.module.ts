import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { License } from '@hubblewave/control-plane-db';
import { LicensesController } from './licenses.controller';
import { LicensesService } from './licenses.service';
import { AuditModule } from '../../../../control-plane/src/app/audit/audit.module';

@Module({
  imports: [TypeOrmModule.forFeature([License]), AuditModule],
  controllers: [LicensesController],
  providers: [LicensesService],
  exports: [LicensesService],
})
export class LicensesModule {}
