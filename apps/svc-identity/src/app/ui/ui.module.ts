import { Module } from '@nestjs/common';
import { UiController } from './ui.controller';
import { UiService } from './ui.service';
import { TenantDbModule } from '@eam-platform/tenant-db';

@Module({
  imports: [
    TenantDbModule,
  ],
  controllers: [UiController],
  providers: [UiService],
})
export class UiModule {}
