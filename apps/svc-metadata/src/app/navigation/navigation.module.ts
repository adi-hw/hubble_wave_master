import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  AuditLog,
  NavigationModule as NavigationModuleEntity,
  NavigationModuleRevision,
  NavigationVariant,
} from '@hubblewave/instance-db';
import { NavigationController } from './navigation.controller';
import { NavigationService } from './navigation.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      NavigationModuleEntity,
      NavigationModuleRevision,
      NavigationVariant,
      AuditLog,
    ]),
  ],
  controllers: [NavigationController],
  providers: [NavigationService],
  exports: [NavigationService],
})
export class NavigationMetadataModule {}
