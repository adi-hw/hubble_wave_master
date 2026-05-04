import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { RedisModule } from '@hubblewave/redis';
import { MaintenanceModeInterceptor } from './maintenance-mode.interceptor';

/**
 * Registers `MaintenanceModeInterceptor` as a global APP_INTERCEPTOR so that
 * every state-changing request (POST/PUT/PATCH/DELETE) handled by the
 * importing service is blocked while a pack install or rollback is in
 * progress.
 *
 * Services that import this module must also have RedisModule available;
 * the import is declared here for self-containment, but RedisModule is
 * @Global so a single forRoot() call earlier in the graph satisfies it.
 *
 * Endpoints that must continue to work during install opt out via the
 * @SkipMaintenanceMode() decorator from this library.
 */
@Module({
  imports: [RedisModule],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: MaintenanceModeInterceptor,
    },
  ],
})
export class MaintenanceModeModule {}
