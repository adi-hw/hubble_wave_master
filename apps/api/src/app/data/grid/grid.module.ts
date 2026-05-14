/**
 * GridModule - Module for HubbleDataGrid SSRM backend
 */

import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { AuthorizationModule } from '@hubblewave/authorization';
import { GridController } from './grid.controller';
import { GridQueryService } from './grid-query.service';
import { ModelRegistryService } from '../model-registry.service';

@Module({
  imports: [
    CacheModule.register({ ttl: 30_000, max: 1000 }),
    AuthorizationModule.forFeature(),
  ],
  controllers: [GridController],
  providers: [GridQueryService, ModelRegistryService],
  exports: [GridQueryService],
})
export class GridModule {}
