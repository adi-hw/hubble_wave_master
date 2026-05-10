import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  CollectionDefinition,
  InstanceEventOutbox,
  PropertyDefinition,
} from '@hubblewave/instance-db';
import { FormulaModule } from '../../../../api/src/app/data/formula/formula.module';
import { ComputedPropertyDispatcher } from './computed-property-dispatcher.service';
import { ComputedOutboxProcessor } from './computed-outbox-processor.service';

/**
 * Plan §6.5 — computed property dispatch module. Imports the
 * already-shipped `FormulaModule` (Formula / Rollup / Lookup /
 * Hierarchical services) and exposes the orchestration layer that
 * wires them into the record save pipeline.
 *
 * Also runs the `ComputedOutboxProcessor` which actually consumes
 * the `computed.rollup.recompute` events the dispatcher writes —
 * without it, those events would sit at status='pending' forever.
 */
@Module({
  imports: [
    ConfigModule,
    FormulaModule,
    TypeOrmModule.forFeature([InstanceEventOutbox, PropertyDefinition, CollectionDefinition]),
  ],
  providers: [ComputedPropertyDispatcher, ComputedOutboxProcessor],
  exports: [ComputedPropertyDispatcher],
})
export class ComputedModule {}
