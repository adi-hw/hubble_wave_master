/**
 * FormulaModule
 * HubbleWave Platform - Phase 2
 *
 * Module for formula calculation and computed property resolution.
 */

import { Module } from '@nestjs/common';
import { FormulaService } from './formula.service';
import { FormulaController } from './formula.controller';
import { FormulaCacheService } from './formula-cache.service';
import { DependencyService } from './dependency.service';
import { RollupService } from './rollup.service';
import { LookupService } from './lookup.service';
import { InstanceDbModule } from '@hubblewave/instance-db';

@Module({
  imports: [InstanceDbModule],
  controllers: [FormulaController],
  providers: [
    FormulaService,
    FormulaCacheService,
    DependencyService,
    RollupService,
    LookupService,
  ],
  exports: [FormulaService, RollupService, LookupService],
})
export class FormulaModule {}
