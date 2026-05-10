import { Module } from '@nestjs/common';
import { ViewsModule } from '../../../api/src/app/views/views.module';

/**
 * Thin adapter module. All logic has migrated to ViewsModule in apps/api
 * per the ARC-W1 fold-ins plan. This module exists solely so svc-view-engine
 * continues to boot during the service cutover window.
 */
@Module({
  imports: [ViewsModule],
})
export class AppModule {}
