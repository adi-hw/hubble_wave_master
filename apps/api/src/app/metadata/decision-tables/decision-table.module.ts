import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  CollectionDefinition,
  DecisionInput,
  DecisionRow,
  DecisionTable,
} from '@hubblewave/instance-db';
import { DecisionTableController } from './decision-table.controller';
import { DecisionTableService } from './decision-table.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CollectionDefinition,
      DecisionTable,
      DecisionInput,
      DecisionRow,
    ]),
  ],
  controllers: [DecisionTableController],
  providers: [DecisionTableService],
  exports: [DecisionTableService],
})
export class DecisionTableModule {}
