import { Module } from '@nestjs/common';
import { InstanceDbModule } from '@hubblewave/instance-db';
import { PropertyController } from './property.controller';
import { PropertyService } from './property.service';
import { PropertyStorageService } from './property-storage.service';
import { PropertyAvaService } from './property-ava.service';
import { PropertyReferenceScanner } from './reference-scanner.service';

@Module({
  imports: [InstanceDbModule],
  controllers: [PropertyController],
  providers: [
    PropertyService,
    PropertyStorageService,
    PropertyAvaService,
    PropertyReferenceScanner,
  ],
  exports: [PropertyService, PropertyStorageService, PropertyReferenceScanner],
})
export class PropertyModule {}

