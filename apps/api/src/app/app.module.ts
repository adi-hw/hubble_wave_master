import { Module } from '@nestjs/common';
import { KernelModule } from './kernel/kernel.module';

/**
 * apps/api root module.
 *
 * Modules are migrated in dependency order per spec §2 module layout:
 *   kernel → db → identity → audit → metadata → data → automation → views
 *   → forms → dashboards → notifications → integrations → ai → packs
 *   → plugins → upgrade → storage → search
 *
 * This plan (ARC-W0+W1 foundation) lands kernel → db → identity → audit → metadata.
 * Subsequent modules land in a follow-on plan.
 */
@Module({
  imports: [KernelModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
