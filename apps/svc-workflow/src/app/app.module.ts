import { Module } from '@nestjs/common';
import { AutomationModule } from '../../../api/src/app/automation/automation.module';
import { HealthController } from './health.controller';

/**
 * apps/svc-workflow is a thin adapter that imports AutomationModule from
 * apps/api. AutomationModule includes workflow as a sub-area (per canon §8
 * INVERT: automation + workflow merge into one engine), so svc-workflow's
 * port serves the same workflow + automation endpoints.
 *
 * HealthController stays here to serve /health on svc-workflow's port for
 * the k8s probe (AutomationHealthController in apps/api serves /automation/health).
 */
@Module({
  imports: [AutomationModule],
  controllers: [HealthController],
})
export class AppModule {}
