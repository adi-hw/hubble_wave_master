import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  CollectionDefinition,
  PropertyDefinition,
  ViewDefinition,
  ViewDefinitionRevision,
  ViewVariant,
} from '@hubblewave/instance-db';
import { ViewController } from './view.controller';
import { ViewService } from './view.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CollectionDefinition,
      PropertyDefinition,
      ViewDefinition,
      ViewDefinitionRevision,
      ViewVariant,
    ]),
  ],
  controllers: [ViewController],
  providers: [ViewService],
  exports: [ViewService],
})
export class ViewModule {}
