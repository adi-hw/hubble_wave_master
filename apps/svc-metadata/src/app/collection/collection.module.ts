import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CollectionDefinition, PropertyDefinition, PropertyType, CollectionAccessRule, InstanceDbModule } from '@hubblewave/instance-db';
import { CollectionController } from './collection.controller';
import { CollectionService } from './collection.service';
import { CollectionStorageService } from './collection-storage.service';
import { CollectionAvaService } from './collection-ava.service';

@Module({
  imports: [
    InstanceDbModule,
    TypeOrmModule.forFeature([
      CollectionDefinition,
      PropertyDefinition,
      PropertyType,
      CollectionAccessRule,
    ]),
  ],
  controllers: [CollectionController],
  providers: [CollectionService, CollectionStorageService, CollectionAvaService],
  exports: [CollectionService, CollectionStorageService],
})
export class CollectionModule {}
