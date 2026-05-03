import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  AuditLog,
  CollectionDefinition,
  PropertyDefinition,
  PropertyDefinitionRevision,
  PropertyType,
  InstanceDbModule,
} from '@hubblewave/instance-db';
import { PropertyController } from './property.controller';
import { PropertyService } from './property.service';
import { PropertyStorageService } from './property-storage.service';
import { PropertyAvaService } from './property-ava.service';
import { BehavioralAttributesService } from './behavioral-attributes.service';

@Module({
  imports: [
    InstanceDbModule,
    TypeOrmModule.forFeature([
      CollectionDefinition,
      PropertyDefinition,
      PropertyDefinitionRevision,
      PropertyType,
      AuditLog,
    ]),
  ],
  controllers: [PropertyController],
  providers: [
    PropertyService,
    PropertyStorageService,
    PropertyAvaService,
    BehavioralAttributesService,
  ],
  exports: [PropertyService, PropertyStorageService, BehavioralAttributesService],
})
export class PropertyModule {}

