import { Module } from '@nestjs/common';
import { InstanceApiModule } from '../../../api/src/app/instance-api/instance-api.module';

/**
 * Thin adapter — ARC-W1 Task 3 (svc-instance-api fold-in).
 *
 * All instance-api logic (identity auth flows, pack install guards, health
 * endpoints, global infrastructure) now lives in
 * apps/api/src/app/instance-api/instance-api.module.ts.
 *
 * This adapter re-exports InstanceApiModule so svc-instance-api continues
 * serving its endpoints during the parallel-deployment window. At W1 final
 * cutover, apps/svc-instance-api is deleted entirely and apps/api serves
 * all instance-api endpoints.
 */
@Module({
  imports: [InstanceApiModule],
})
export class AppModule {}
