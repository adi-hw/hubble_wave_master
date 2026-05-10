/**
 * GridModule - Module for HubbleDataGrid SSRM backend
 */

import { Module } from '@nestjs/common';
import { AuthorizationModule } from '@hubblewave/authorization';
import { GridController } from './grid.controller';
import { GridQueryService } from './grid-query.service';
import { ModelRegistryService } from '../model-registry.service';

@Module({
  imports: [AuthorizationModule.forFeature()],
  controllers: [GridController],
  providers: [GridQueryService, ModelRegistryService],
  exports: [GridQueryService],
})
export class GridModule {}
