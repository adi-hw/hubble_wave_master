import { Module } from '@nestjs/common';
import { TenantDbModule } from '@eam-platform/tenant-db';
import { ConfigServiceLocal } from './config.service';
import { ConfigController } from './config.controller';

@Module({
  imports: [TenantDbModule],
  providers: [ConfigServiceLocal],
  controllers: [ConfigController],
  exports: [ConfigServiceLocal],
})
export class SettingsModule {}
