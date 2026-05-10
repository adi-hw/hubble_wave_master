import { Module } from '@nestjs/common';
import { ControlPlaneModule } from '../../../control-plane/src/app/app.module';

/**
 * apps/svc-control-plane is a thin adapter that imports ControlPlaneModule
 * from apps/control-plane. The canonical control-plane logic lives at
 * apps/control-plane (a separate Nest app per spec §2).
 *
 * Per canon §18, the control plane is multi-tenant by design — its own DB,
 * its own port, its own deployment vehicle. This adapter preserves
 * parallel-deployment compatibility on svc-control-plane's port until W1
 * final cutover removes apps/svc-control-plane entirely.
 */
@Module({
  imports: [ControlPlaneModule],
})
export class AppModule {}
