import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  CollectionDefinition,
  PropertyDefinitionRevision,
  InstanceDbModule,
} from '@hubblewave/instance-db';
import { PropertyController } from './property.controller';
import { PropertyService } from './property.service';
import { PropertyStorageService } from './property-storage.service';
import { PropertyAvaService } from './property-ava.service';

@Module({
  imports: [
    InstanceDbModule,
    TypeOrmModule.forFeature([CollectionDefinition, PropertyDefinitionRevision]),
  ],
  controllers: [PropertyController],
  providers: [PropertyService, PropertyStorageService, PropertyAvaService],
  exports: [PropertyService, PropertyStorageService],
})
export class PropertyModule {}

