import { Module } from '@nestjs/common';
import { KernelModule } from './kernel/kernel.module';
import { DbModule } from './db/db.module';
import { AuditModule } from './audit/audit.module';
import { IdentityModule } from './identity/identity.module';
import { MetadataModule } from './metadata/metadata.module';
import { DataModule } from './data/data.module';

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
  imports: [KernelModule, DbModule, AuditModule, IdentityModule, MetadataModule, DataModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
