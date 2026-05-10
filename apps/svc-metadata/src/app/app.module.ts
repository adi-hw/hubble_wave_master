import { Module } from '@nestjs/common';
import { MetadataModule } from '../../../api/src/app/metadata/metadata.module';

/**
 * apps/svc-metadata is kept alive in parallel during the ARC-W1 migration
 * for parallel-deployment safety. The actual module logic now lives in
 * apps/api/src/app/metadata/MetadataModule. This thin adapter re-imports
 * MetadataModule wholesale so the legacy service serves the same endpoints
 * at its old port.
 *
 * Legacy service deletion is deferred to the W1 final-cutover plan.
 */
@Module({
  imports: [MetadataModule],
})
export class AppModule {}
