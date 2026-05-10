import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChangePackage } from '@hubblewave/instance-db';
import { ChangePackageController } from './change-package.controller';
import { ChangePackageService } from './change-package.service';

@Module({
  imports: [TypeOrmModule.forFeature([ChangePackage])],
  controllers: [ChangePackageController],
  providers: [ChangePackageService],
  exports: [ChangePackageService],
})
export class ChangePackageModule {}
