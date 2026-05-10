import { Module } from '@nestjs/common';
import { DataModule } from '../../../api/src/app/data/data.module';

/**
 * apps/svc-data is kept alive in parallel during the ARC-W1 migration
 * for parallel-deployment safety. The actual module logic now lives in
 * apps/api/src/app/data/DataModule. This thin adapter re-imports
 * DataModule wholesale so the legacy service serves the same endpoints
 * at its old port.
 *
 * Legacy service deletion is deferred to the W1 final-cutover plan.
 */
@Module({
  imports: [DataModule],
})
export class AppModule {}
