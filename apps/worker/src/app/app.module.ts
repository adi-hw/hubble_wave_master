import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { ServiceTokenClient } from '@hubblewave/auth-guard';

/**
 * apps/worker root module.
 *
 * Houses BullMQ consumers, scheduled jobs, and AI background-task workers.
 * Modules migrate in dependency order alongside apps/api per spec §2.
 *
 * Canon §29.7 — the worker carries `ServiceTokenClient` so any future
 * HTTP callbacks from a BullMQ consumer into apps/api can mint a
 * short-lived ES256 service token (no shared secrets, no static API
 * keys). The seeded principal is `svc-worker` (see
 * `migrations/instance/1000000000004-seed-service-principals.ts`).
 * Today no consumer in this module actually makes outbound HTTP calls
 * — the client is wired for parity with the canon §29.7 contract so
 * the first consumer to ship can inject it directly.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 5,
    }),
  ],
  providers: [ServiceTokenClient],
  exports: [ServiceTokenClient],
})
export class AppModule {}
