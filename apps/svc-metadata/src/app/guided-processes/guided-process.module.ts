import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  CollectionDefinition,
  DecisionTable,
  GuidedProcessActivity,
  GuidedProcessDefinition,
  GuidedProcessStage,
  ProcessFlowDefinition,
} from '@hubblewave/instance-db';
import { GuidedProcessController } from './guided-process.controller';
import { GuidedProcessService } from './guided-process.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CollectionDefinition,
      GuidedProcessDefinition,
      GuidedProcessStage,
      GuidedProcessActivity,
      ProcessFlowDefinition,
      DecisionTable,
    ]),
  ],
  controllers: [GuidedProcessController],
  providers: [GuidedProcessService],
  exports: [GuidedProcessService],
})
export class GuidedProcessModule {}
