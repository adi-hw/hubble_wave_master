import { Module } from '@nestjs/common';
import { InstanceDbModule } from '@hubblewave/instance-db';
import { ConfigServiceLocal } from './config.service';
import { ConfigController } from './config.controller';

@Module({
  imports: [InstanceDbModule],
  providers: [ConfigServiceLocal],
  controllers: [ConfigController],
  exports: [ConfigServiceLocal],
})
export class SettingsModule {}

