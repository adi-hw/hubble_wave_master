/**
 * Transform Module
 * HubbleWave Platform - Phase 2
 *
 * Module for data transformation and view-specific query optimization.
 */

import { Module } from '@nestjs/common';
import { TransformController } from './transform.controller';
import { TransformService } from './transform.service';
import { PivotTransformService } from './pivot-transform.service';
import { TimelineTransformService } from './timeline-transform.service';

@Module({
  controllers: [TransformController],
  providers: [TransformService, PivotTransformService, TimelineTransformService],
  exports: [TransformService],
})
export class TransformModule {}
