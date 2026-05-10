import { Module } from '@nestjs/common';

/**
 * apps/worker root module.
 *
 * Houses BullMQ consumers, scheduled jobs, and AI background-task workers.
 * Modules migrate in dependency order alongside apps/api per spec §2.
 *
 * This plan (ARC-W0+W1 foundation) lands the scaffold only; consumer
 * registration begins when the automation module migrates (later W1 plan).
 */
@Module({
  imports: [],
  providers: [],
})
export class AppModule {}
