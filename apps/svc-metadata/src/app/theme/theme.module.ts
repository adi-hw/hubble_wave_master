import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThemeDefinition, UserThemePreference, InstanceBranding } from '@hubblewave/instance-db';
import { ThemeController } from './theme.controller';
import { ThemeService } from './theme.service';

@Module({
  imports: [TypeOrmModule.forFeature([ThemeDefinition, UserThemePreference, InstanceBranding])],
  controllers: [ThemeController],
  providers: [ThemeService],
  exports: [ThemeService],
})
export class ThemeModule {}

